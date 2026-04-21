import { SupabaseClient } from '../services/SupabaseClient.js';
import { GlobalStateManager } from './GlobalStateManager.js';
import { LoginDialog } from '../ui/LoginDialog.js';
import { Blackjack } from '../games/blackjack/games/Blackjack.js';
import { BlackjackUI } from '../games/blackjack/ui/BlackjackUI.js';
import { TexasHoldem } from '../games/poker/games/TexasHoldem.js';
import { TexasHoldemUI } from '../games/poker/ui/TexasHoldemUI.js';
import { Dialog } from '../ui/Dialog.js';
import { UserStatsService } from '../services/UserStatsService.js';
import { DataService } from '../services/DataService.js';
import { AuthService } from '../services/AuthService.js';
import { UIManager } from './UIManager.js';
import { TableLoader } from './TableLoader.js';
import { ColourFactory } from '../utils/ColourFactory.js';

/**
 * App - The main application class that orchestrates everything.
 * All data flows through the relational Supabase schema.
 */
export class App {
    constructor() {
        this.globalState = GlobalStateManager.getInstance();
        this.tables = {};
        this.tableConfigs = [];
        this.peopleData = [];
        this.uiManager = new UIManager(this);
        this.tableElements = {};
        // Track newly created games in session to prevent 'Deleted' status
        this.sessionNewGames = new Map();
    }

    /**
     * Entry point to start the application.
     */
    async init() {
        try {
            this._initTheme();
            await this._loadInitialData();
            await this._handleAuthentication();
            this.tables = await TableLoader.loadAllTables(this.peopleData, this.tableConfigs);
            this.uiManager.setupLayout(this.tableConfigs);
            await this.uiManager.loadTables(this.tables, this.peopleData);
            this.uiManager.setupEventListeners();
            this.uiManager.showInitialView();

            // SINGLE SUMMARY LOG
            console.log(`%c[System] %cBereit. %c${Object.keys(this.tables).length} Tabellen für "${this.globalState.getCurrentUser()}" geladen (%c${this.globalState.getCurrentRole()}%c)`,
                'color: #0052cc; font-weight: bold;', 
                'color: #28a745; font-weight: bold;',
                'color: #555;',
                'color: #0052cc; font-weight: bold;',
                'color: #555;');

            // Listen for cross-component data refresh requests
            window.addEventListener('refresh-data', async () => {
                try {
                    await this._refreshApp(true);
                } catch (e) {
                    console.error('[App] Refresh failed:', e);
                }
            });
        } catch (error) {
            console.error('[App] Initialization failed:', error);
        }
    }

    // ── Private Initialization Methods ─────────────────────────

    _initTheme() {
        const initialTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.dataset.theme = initialTheme;
        this._setFavicon();
    }

    _setFavicon() {
        const logoChar = '⬡';
        const color = ColourFactory.getBrandBlue();
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text x='50%' y='50%' font-size='120' fill='${color}' dominant-baseline='central' text-anchor='middle' font-weight='bold'>${logoChar}</text></svg>`;

        let link = document.querySelector("link[rel*='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'shortcut icon';
            document.head.appendChild(link);
        }
        link.type = 'image/svg+xml';
        link.href = `data:image/svg+xml,${svg.replace(/#/g, '%23')}`;
    }

    async _loadInitialData() {
        const base = import.meta.env.BASE_URL;

        try {
            // Priority 1: New structured table_definitions
            let configs = await DataService.loadTableDefinitions();

            if (!configs) {
                // Priority 2: Legacy app_config JSON
                const res = await SupabaseClient.get('app_config', '?id=eq.tables_config');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0 && data[0].config) {
                        configs = data[0].config;
                    }
                }
            }

            if (configs) {
                this.tableConfigs = configs;
                this.globalState.setTableConfigs(configs);
            } else {
                throw new Error('Database config is empty or unreachable.');
            }
        } catch (e) {
            try {
                const localRes = await fetch(`${base}data/tables.json`);
                if (localRes.ok) {
                    this.tableConfigs = await localRes.json();
                } else {
                    throw new Error('Local tables.json not found or invalid.');
                }
            } catch (err) {
                this.tableConfigs = [];
            }
        }

        try {
            // Find the ID for the people table from configs (it might have a prefix now)
            const peopleConfig = this.tableConfigs.find(c => c.supa_table === 'people');
            const peopleId = peopleConfig ? peopleConfig.id : 'tbl_people';
            
            this.peopleData = await DataService.loadRows(peopleId);
            await this.globalState.loadAvailableTeams();
        } catch (e) {
            console.error('[App] Failed to load people or teams:', e);
            this.peopleData = [];
        }
    }

    async _handleAuthentication() {
        let authUser = localStorage.getItem('auth_user');
        let authPass = localStorage.getItem('auth_pass');
        let authRole = null;
        let userId = null;
        let perms = null;
        let personId = null; 

        if (authUser && authPass) {
            try {
                const result = await AuthService.authenticate(authUser, authPass);
                authRole = result.role;
                userId = result.userId;
                perms = result.permissions;
                personId = result.personId; // Capturing the UUID link
            } catch (e) {
                authUser = null;
            }
        }

        if (!authUser) {
            const creds = await LoginDialog.show(this.peopleData);
            authUser = creds.username;
            authPass = creds.password;
            authRole = creds.role;
            userId = creds.userId;
            perms = creds.permissions;
            personId = creds.personId; 
            localStorage.setItem('auth_user', authUser);
            localStorage.setItem('auth_pass', authPass);
        }

        // Store the user's UUID for stats/favorites
        if (userId) {
            this.globalState.setCurrentUserId(userId);
        } else {
            const userRecord = await AuthService.getUserByUsername(authUser);
            if (userRecord) {
                this.globalState.setCurrentUserId(userRecord.id);
                authRole = userRecord.role || authRole;
                perms = userRecord.permissions || perms;
                personId = userRecord.person_id;
            }
        }

        // FIND THE DIRECTORY ENTRY (Robust way via person_id, fallback to name)
        const person = personId 
            ? this.peopleData.find(p => p.id === personId)
            : this.peopleData.find(p => `${p.vorname || ''} ${p.nachname || ''}`.trim() === authUser);
            
        let teams = [];

        // Unified Role/Permission Handling: 
        if (person) {
            const isInactiveDir = (person.Status || '').toLowerCase() === 'inaktiv';
            if (isInactiveDir || (authRole || '').toLowerCase() === 'inaktiv') {
                authRole = 'Inaktiv';
                // Initialize default permission object for inactive users
                perms = {
                    type: 'all',
                    managementAccess: 'stats_only',
                    canEditRoles: true,
                    canUseEditMode: false,
                    canViewLogs: true
                };
            }

            const rawTeams = person.Team || '';
            teams = rawTeams.split(',').map(t => t.trim()).filter(Boolean);
        }

        this.globalState.setCurrentUser(authUser, authRole || 'User', perms, teams, person?.image_url || null);

        await this.globalState.loadFavorites();
        await this.globalState.loadGlobalEnums();
    }

    // ── Interaction Handlers ─────────────────────────────────────

    _handleLogout() {
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_pass');
        window.location.reload();
    }

    async _handleChangePassword() {
        const newPass = await Dialog.prompt({ message: 'Neues Passwort eingeben:', confirmText: 'Ändern', type: 'password', placeholder: 'Neues Passwort' });
        if (!newPass) return;
        try {
            const authUser = this.globalState.getCurrentUser();
            await AuthService.changePassword(authUser, newPass);
            localStorage.setItem('auth_pass', newPass);
            this._handleLogout();
        } catch (e) { alert(e.message); }
    }

    async _handleChangeAvatar() {
        const personId = this.globalState.getPermissionContext().perms?.personId || this.globalState.getPermissionContext().teams?.personId;
        // Wait, personId is stored directly in GlobalStateManager too if I added it.
        // Let's check GlobalStateManager.
        
        const currentPersonId = this.peopleData.find(p => `${p.vorname || ''} ${p.nachname || ''}`.trim() === this.globalState.getCurrentUser())?.id;
        
        if (!currentPersonId) {
            alert('Personen-Eintrag nicht gefunden.');
            return;
        }

        const personRow = {
            id: currentPersonId,
            data: this.peopleData.find(p => p.id === currentPersonId),
            schema: this.globalState.getTableConfig('tbl_people')?.schema || [],
            tableId: 'tbl_people',
            render: () => {
                // Refresh header after change
                const updatedPerson = this.peopleData.find(p => p.id === currentPersonId);
                this.globalState.setCurrentUser(
                    this.globalState.getCurrentUser(),
                    this.globalState.getCurrentRole(),
                    this.globalState.getPermissions(),
                    this.globalState.getCurrentTeams(),
                    updatedPerson.image_url
                );
                this.uiManager.header.render(); // Re-render header to show new image
            }
        };

        const { PersonEditDialog } = await import('../ui/PersonEditDialog.js');
        await PersonEditDialog.show(personRow, true);
    }

    async _handleSaveAll() {
        const unsavedIds = this.globalState.getUnsavedTableIds();
        if (unsavedIds.length === 0) return;

        document.body.classList.add('global-loading');
        this.uiManager.header.setLoading(true);
        try {
            for (const id of unsavedIds) {
                const entry = this.tables[id];
                if (entry) {
                    if (entry.instances) {
                        const rowMap = new Map();
                        entry.instances.forEach(inst => {
                            inst.rows.forEach(row => {
                                const id = row.id || (row.data ? row.data.id : null);
                                if (id) rowMap.set(id, row);
                            });
                        });
                        const allRows = Array.from(rowMap.values());
                        const mainInst = entry.instances[0];
                        if (mainInst?.editor) {
                            const originalRows = mainInst.rows;
                            mainInst.rows = allRows;
                            await mainInst.editor._saveTable(mainInst);
                            mainInst.rows = originalRows;
                        }
                    } else if (entry.instance?.editor) {
                        await entry.instance.editor._saveTable(entry.instance);
                    }
                } else if (id === 'people_table' || id === 'tbl_people') {
                    const dirtyRowIds = this.globalState.getDirtyRowIds('tbl_people');
                    const deletedIds = this.globalState.getDeletedRowIds('tbl_people');
                    const dirtyRows = (this.peopleData || []).filter(p => dirtyRowIds.includes(p.id)).map(d => ({...d}));
                    await DataService.saveTable('tbl_people', 'people.json', dirtyRows, deletedIds);
                    this.globalState.clearDirtyRowIds('tbl_people');
                    this.globalState.clearDeletedRowIds('tbl_people');
                }
                this.globalState.markTableAsSaved(id);
            }
            this.uiManager.header.hideUnsavedBanner();
            
            // Full refresh to ensure all derived data/views are in sync
            await this._refreshApp(true);
            
        } catch (e) {
            if (e.message.includes('Reload requested due to concurrent edits.')) {
                alert('Daten wurden von einem anderen Benutzer geändert. Daten werden neu geladen.');
                await this._refreshApp(true);
            } else {
                alert(`Fehler beim Speichern: ${e.message}`);
            }
        } finally {
            this.uiManager.header.setLoading(false);
            document.body.classList.remove('global-loading');
        }
    }

    async _refreshApp(preserveState = true) {
        this.peopleData = await DataService.loadRows('tbl_people');
        this.tables = await TableLoader.loadAllTables(this.peopleData, this.tableConfigs);
        await this.uiManager.loadTables(this.tables, this.peopleData, preserveState);
    }

    async _handleDiscardAll() {
        if (await Dialog.confirm({ message: 'Änderungen verwerfen?', confirmText: 'Verwerfen', confirmStyle: 'warning' })) {
            document.body.classList.add('global-loading');
            this.uiManager.header.setLoading(true);
            try {
                this.globalState.clearAllUnsaved();
                // Ensure loading bar is visible
                await new Promise(r => setTimeout(r, 50)); 
                await this._refreshApp(true);
                this.uiManager.header.hideUnsavedBanner();
            } catch (e) {
                console.error('[App] Discard failed:', e);
                window.location.reload(); 
            } finally {
                this.uiManager.header.setLoading(false);
                document.body.classList.remove('global-loading');
            }
        }
    }

    _handleFavoritesToggle(active) {
        this.globalState.setFavoritesFilterActive(active);
        document.body.classList.toggle('favorites-active', active);
    }

    async _launchBlackjack() {
        const game = new Blackjack();
        const userId = this.globalState.getCurrentUserId();
        game.onRoundUpdate = (res) => UserStatsService.recordBlackjackResult(userId, res);
        const ui = new BlackjackUI(game, () => overlay.remove());
        const overlay = ui.render();
        document.body.appendChild(overlay);
    }

    async _launchTexasHoldem() {
        const game = new TexasHoldem();
        const ui = new TexasHoldemUI(game, () => overlay.remove());
        const overlay = ui.render();
        document.body.appendChild(overlay);
    }
}
