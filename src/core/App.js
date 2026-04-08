import { SupabaseClient } from '../services/SupabaseClient.js';
import { GlobalStateManager } from './GlobalStateManager.js';
import { PermissionService } from '../services/PermissionService.js';
import { LoginDialog } from '../ui/LoginDialog.js';
import { Blackjack } from '../games/blackjack/games/Blackjack.js';
import { BlackjackUI } from '../games/blackjack/ui/BlackjackUI.js';
import { Dialog } from '../ui/Dialog.js';
import { UserStatsService } from '../services/UserStatsService.js';
import { DataService } from '../services/DataService.js';
import { AuthService } from '../services/AuthService.js';
import { UIManager } from './UIManager.js';
import { TableLoader } from './TableLoader.js';

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

            // Listen for cross-component data refresh requests
            window.addEventListener('refresh-data', async () => {
                console.log('[App] Refreshing data...');
                try {
                    this.peopleData = await DataService.loadRows('tbl_people');
                    this.tables = await TableLoader.loadAllTables(this.peopleData, this.tableConfigs);
                    await this.uiManager.loadTables(this.tables, this.peopleData);
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
        const color = '#0084ff'; 
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
            const res = await SupabaseClient.get('app_config', '?id=eq.tables_config');
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0 && data[0].config) {
                    this.tableConfigs = data[0].config;
                    console.log('[App] Table configurations successfully loaded from Supabase.');
                } else {
                    throw new Error('Database config is empty or unreachable.');
                }
            } else {
                throw new Error('Database config fetch failed.');
            }
        } catch (e) {
            console.warn('[App] Falling back to check local tables.json:', e.message);
            
            try {
                const localRes = await fetch(`${base}data/tables.json`);
                if (localRes.ok) {
                    const ct = localRes.headers.get('content-type');
                    if (ct && ct.includes('application/json')) {
                        this.tableConfigs = await localRes.json();
                        console.log('[App] Falling back to local tables.json.');
                    } else {
                        throw new Error('Local tables.json not found or invalid.');
                    }
                } else {
                    throw new Error('Local tables.json not found or invalid.');
                }
            } catch (err) {
                console.error('[App] CRITICAL: No table configurations found anywhere!', err.message);
                this.tableConfigs = [];
            }
        }

        try {
            this.peopleData = await DataService.loadPeople();
        } catch (e) {
            console.error('[App] Failed to load people:', e);
            this.peopleData = [];
        }
    }

    async _handleAuthentication() {
        let authUser = localStorage.getItem('auth_user');
        let authPass = localStorage.getItem('auth_pass');
        let authRole = null;
        let userId = null;

        if (authUser && authPass) {
            try {
                const result = await AuthService.authenticate(authUser, authPass);
                authRole = result.role;
                userId = result.userId;
            } catch (e) {
                console.error('Auth check error:', e);
                authUser = null;
            }
        }

        if (!authUser) {
            const creds = await LoginDialog.show(this.peopleData);
            authUser = creds.username;
            authPass = creds.password;
            authRole = creds.role;
            userId = creds.userId;
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
            }
        }

        const person = this.peopleData.find(p => `${p.vorname || ''} ${p.nachname || ''}`.trim() === authUser);
        if (!person) {
            this.globalState.setCurrentUser(authUser, authRole || 'User', { type: 'readonly', tables: [] });
        } else {
            // Apply Status-based role override
            if ((person.Status || '').toLowerCase() === 'inaktiv' || (person.role || '').toLowerCase() === 'inaktiv') {
                authRole = 'Inaktiv';
            } else {
                authRole = person.role || authRole || 'User';
            }
            
            let perms = null;
            if (authRole === 'Inaktiv') {
                perms = PermissionService.getPermissionsForRole('Inaktiv');
            } else {
                const permissionsMap = JSON.parse(localStorage.getItem('app_permissions_map') || '{}');
                perms = permissionsMap[authUser];
            }
            
            this.globalState.setCurrentUser(authUser, authRole, perms);
        }

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

    async _handleSaveAll() {
        const unsavedIds = this.globalState.getUnsavedTableIds();
        if (unsavedIds.length === 0) return;

        this.uiManager.header.setLoading(true);
        try {
            for (const id of unsavedIds) {
                const entry = this.tables[id];
                if (entry) {
                    if (entry.instances) {
                        const allRows = [];
                        entry.instances.forEach(inst => allRows.push(...inst.rows));
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
                } else if (id === 'people_table') {
                    const allRows = [];
                    if (this.uiManager.personsTable) allRows.push(...this.uiManager.personsTable.rows);
                    if (this.uiManager.inactivePersonsTable) allRows.push(...this.uiManager.inactivePersonsTable.rows);

                    if (this.uiManager.personsTable?.editor) {
                        const originalRows = this.uiManager.personsTable.rows;
                        this.uiManager.personsTable.rows = allRows;
                        await this.uiManager.personsTable.editor._saveTable(this.uiManager.personsTable);
                        this.uiManager.personsTable.rows = originalRows;
                    }
                }
                this.globalState.markTableAsSaved(id);
            }
            this.uiManager.header.hideUnsavedBanner();
            if (unsavedIds.includes('tbl_people') || unsavedIds.includes('people_table')) {
                this.peopleData = await DataService.loadPeople();
            }
        } catch (e) {
            alert(`Fehler beim Speichern: ${e.message}`);
        } finally {
            this.uiManager.header.setLoading(false);
        }
    }

    async _handleDiscardAll() {
        if (await Dialog.confirm({ message: 'Änderungen verwerfen?', confirmText: 'Verwerfen', confirmStyle: 'warning' })) {
            window.location.reload();
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
}
