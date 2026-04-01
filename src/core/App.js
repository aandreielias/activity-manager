import { Header } from '../ui/Header.js';
import { TableLoader } from './TableLoader.js';
import { GlobalStateManager } from './GlobalStateManager.js';
import { Table } from './Table.js';
import { LoginDialog } from '../ui/LoginDialog.js';
import { UserInfoPage } from '../ui/UserInfoPage.js';
import { Blackjack } from '../games/blackjack/games/Blackjack.js';
import { BlackjackUI } from '../games/blackjack/ui/BlackjackUI.js';
import { SUPABASE_CONFIG } from '../config.js';
import { Dialog } from '../ui/Dialog.js';
import { UserStatsService } from '../services/UserStatsService.js';
import { DataService } from '../services/DataService.js';

/**
 * App - The main application class that orchestrates everything.
 */
export class App {
    constructor() {
        this.globalState = GlobalStateManager.getInstance();
        this.tables = {};
        this.tableConfigs = [];
        this.peopleData = [];
        this.header = null;
        this.mainElement = null;
        this.tablesContainer = null;
        this.splitSideContainer = null;
        this.resizer = null;
        this.currentTableId = 'all-spiele';
        this.tableElements = {};
        this.personsTable = null;
        this.inventoryTable = null;
    }

    /**
     * Entry point to start the application.
     */
    async init() {
        try {
            await this._initTheme();
            await this._loadInitialData();
            await this._handleAuthentication();
            this._setupLayout();
            await this._loadTables();
            this._setupEventListeners();
            this._showInitialView();
        } catch (error) {
            console.error('[App] Initialization failed:', error);
        }
    }

    // ── Private Initialization Methods ─────────────────────────

    async _initTheme() {
        const initialTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.dataset.theme = initialTheme;
    }

    async _loadInitialData() {
        const base = import.meta.env.BASE_URL;
        this.tableConfigs = await fetch(`${base}data/tables.json`).then(r => r.json());

        // Try to load people data from Supabase first
        try {
            const sbPeopleRes = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data?id=eq.tbl_people&select=rows`, {
                headers: { 'apikey': SUPABASE_CONFIG.ANON_KEY, 'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}` }
            });
            if (sbPeopleRes.ok) {
                const sbPeopleData = await sbPeopleRes.json();
                if (sbPeopleData && sbPeopleData.length > 0) {
                    this.peopleData = sbPeopleData[0].rows;
                    console.log('[App] Loaded people data from Supabase');
                }
            }
        } catch (e) {
            console.warn('[App] Failed to load people from Supabase, using local fallback');
        }

        if (!this.peopleData || this.peopleData.length === 0) {
            this.peopleData = await fetch(`${base}data/rows/people.json`).then(r => r.json());
        }
    }

    async _handleAuthentication() {
        const base = import.meta.env.BASE_URL;
        let authUser = localStorage.getItem('auth_user');
        let authPass = localStorage.getItem('auth_pass');
        let authRole = null;

        if (authUser && authPass) {
            try {
                const supabaseAuthRes = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data?id=eq.app_auth&select=rows`, {
                    headers: { 'apikey': SUPABASE_CONFIG.ANON_KEY, 'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}` }
                });
                const sbAuthData = await supabaseAuthRes.json();
                let authData = sbAuthData && sbAuthData[0] ? sbAuthData[0].rows : null;

                if (!authData) {
                    authData = await fetch(`${base}data/auth.json`).then(r => r.json());
                }

                if (!authData[authUser]) {
                    authData[authUser] = authPass;
                    await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_CONFIG.ANON_KEY, 'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`, 'Prefer': 'resolution=merge-duplicates' },
                        body: JSON.stringify({ id: 'app_auth', rows: authData })
                    });
                    authRole = authUser === 'root' ? 'admin' : 'user';
                } else if (authData[authUser] === authPass) {
                    authRole = authUser === 'root' ? 'admin' : 'user';
                } else {
                    authUser = null;
                }
            } catch (e) {
                console.error('Auth check error:', e);
                authUser = null;
            }
        }

        if (!authUser) {
            const creds = await LoginDialog.show(this.peopleData);
            authUser = creds.username;
            authPass = creds.password;
            localStorage.setItem('auth_user', authUser);
            localStorage.setItem('auth_pass', authPass);
        }

        const person = this.peopleData.find(p => `${p.vorname || ''} ${p.nachname || ''}`.trim() === authUser);
        if (!person) {
            this.globalState.setCurrentUser(authUser, 'user', { type: 'readonly', tables: [] });
        } else {
            authRole = person.role || 'user';
            const permissionsMap = JSON.parse(localStorage.getItem('app_permissions_map') || '{}');
            this.globalState.setCurrentUser(authUser, authRole, permissionsMap[authUser]);
        }

        // Load Favorites
        try {
            const favRes = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data?id=eq.favs_${authUser}&select=rows`, {
                headers: { 'apikey': SUPABASE_CONFIG.ANON_KEY, 'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}` }
            });
            const favData = await favRes.json();
            if (favData?.[0]?.rows) {
                this.globalState.setInitialFavorites(favData[0].rows);
            }
        } catch (e) {
            console.error('Failed to load favorites:', e);
        }
    }

    _setupLayout() {
        const app = document.getElementById('app');
        app.innerHTML = '';

        this.header = new Header({
            appName: 'Activity Manager',
            tableConfigs: this.tableConfigs,
            onThemeToggle: (x, y) => this._toggleTheme(x, y),
        });

        this.header.onTableSwitch = (id) => this._handleTableSwitch(id);
        this.header.onPersonsToggle = () => this._handlePersonsToggle();
        this.header.onInventoryToggle = () => this._handleInventoryToggle();
        this.header.onPersonsFullView = () => this._handlePersonsFullView();
        this.header.onInventoryFullView = () => this._handleInventoryFullView();
        this.header.onUserInfo = () => this._handleUserInfo();
        this.header.onLogout = () => this._handleLogout();
        this.header.onChangePassword = () => this._handleChangePassword();
        this.header.onSaveAll = () => this._handleSaveAll();
        this.header.onDiscardAll = () => this._handleDiscardAll();
        this.header.onFavoritesToggle = (active) => this._handleFavoritesToggle(active);
        this.header.onLogoDoubleClick = () => this._launchBlackjack();

        app.appendChild(this.header.render());

        this.mainElement = document.createElement('main');
        this.mainElement.className = 'main-container layout-row';
        app.appendChild(this.mainElement);

        this.tablesContainer = document.createElement('div');
        this.tablesContainer.className = 'tables-container';
        this.mainElement.appendChild(this.tablesContainer);

        this.resizer = document.createElement('div');
        this.resizer.className = 'split-resizer';
        this.resizer.innerHTML = '<div class="split-resizer-handle"></div>';
        this._setupResizer();
        this.mainElement.appendChild(this.resizer);

        this.splitSideContainer = document.createElement('div');
        this.splitSideContainer.className = 'persons-split-container';
        this.mainElement.appendChild(this.splitSideContainer);
    }

    async _loadTables() {
        this.tables = await TableLoader.loadAllTables(this.peopleData);
        this.header.tables = this.tables;

        if (this.tables['tbl_inventory']) {
            this.globalState.setInventory(this.tables['tbl_inventory'].instance.rows);
        }

        let renderedCount = 0;
        Object.entries(this.tables).forEach(([tableId, { instance }]) => {
            if (!this.globalState.canView(tableId)) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'table-view-wrapper';
            wrapper.dataset.tableId = tableId;
            wrapper.appendChild(instance.render());

            this.tableElements[tableId] = wrapper;
            this.tablesContainer.appendChild(wrapper);
            renderedCount++;

            instance.editor.showSaveBar = () => instance.editor.showUnsavedChange();
        });

        if (renderedCount === 0) {
            this.tablesContainer.innerHTML = `<div class="empty-state-container"><h2>Kein Zugriff</h2><p>Sie haben keine Berechtigung, Tabellen in diesem Bereich anzuzeigen.</p></div>`;
        }

        this._initSplitViewTables();
    }

    _initSplitViewTables() {
        if (this.peopleData.length > 0) {
            const schema = [
                { id: 'vorname', label: 'Vorname', type: 'text' },
                { id: 'nachname', label: 'Nachname', type: 'text' },
                { id: 'Tel.', label: 'Telefon', type: 'text' },
                { id: 'Status', label: 'Status', type: 'enum', options: ['aktiv', 'inaktiv'] },
                { id: 'role', label: 'Rolle', type: 'text' },
                { id: 'Spez. Zuständigkeit', label: 'Spez. Zuständigkeit', type: 'text' }
            ];
            this.personsTable = new Table({ id: 'people_table', title: 'Personen', schema, rows: this.peopleData, tableConfig: { id: 'people_table', schema } });
        }
        this.inventoryTable = this.tables['tbl_inventory']?.instance;
    }

    _showInitialView() {
        this.header.switchTo('all-spiele');
        this._handleTableSwitch('all-spiele');
    }

    // ── Interaction Handlers ─────────────────────────────────────

    async _toggleTheme(x, y) {
        const isDark = document.documentElement.dataset.theme === 'dark';
        const nextTheme = isDark ? 'light' : 'dark';
        const setThemeState = () => {
            document.documentElement.dataset.theme = nextTheme;
            localStorage.setItem('theme', nextTheme);
        };

        if (!document.startViewTransition) {
            setThemeState();
            return;
        }

        const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
        const transition = document.startViewTransition(() => setThemeState());
        await transition.updateCallbackDone;
        transition.ready.then(() => {
            document.documentElement.animate({
                clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`],
            }, { duration: 500, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' });
        });
    }

    _handleTableSwitch(tableId) {
        this.currentTableId = tableId;
        this.tablesContainer.style.display = 'flex';

        if (this.splitSideContainer.classList.contains('full-view')) {
            this.splitSideContainer.classList.remove('full-view');
            const open = this.header.personsSplitOpen || this.header.inventorySplitOpen;
            this.splitSideContainer.style.display = open ? 'flex' : 'none';
            this.resizer.style.display = open ? 'block' : 'none';
        }

        Object.entries(this.tableElements).forEach(([id, el]) => {
            if (tableId === 'all-spiele') {
                el.style.display = this.tableConfigs.find(c => c.id === id)?.category === 'spiele' ? 'block' : 'none';
            } else if (tableId === 'all-sportarten') {
                el.style.display = this.tableConfigs.find(c => c.id === id)?.category === 'sportarten' ? 'block' : 'none';
            } else {
                el.style.display = id === tableId ? 'block' : 'none';
            }
        });
    }

    _handlePersonsToggle() {
        if (this.splitSideContainer.classList.contains('full-view')) {
            this.splitSideContainer.classList.remove('full-view');
            this.tablesContainer.style.display = 'flex';
        } else {
            this.header.personsSplitOpen = !this.header.personsSplitOpen;
            if (this.header.personsSplitOpen) {
                this.header.inventorySplitOpen = false;
                this._setSplitContent('people');
            }
        }
        this._updateSplitVisibility();
    }

    _handleInventoryToggle() {
        if (this.splitSideContainer.classList.contains('full-view')) {
            this.splitSideContainer.classList.remove('full-view');
            this.tablesContainer.style.display = 'flex';
        } else {
            this.header.inventorySplitOpen = !this.header.inventorySplitOpen;
            if (this.header.inventorySplitOpen) {
                this.header.personsSplitOpen = false;
                this._setSplitContent('inventory');
            }
        }
        this._updateSplitVisibility();
    }

    _updateSplitVisibility() {
        const open = this.header.personsSplitOpen || this.header.inventorySplitOpen;
        this.splitSideContainer.style.display = open ? 'flex' : 'none';
        this.resizer.style.display = open ? 'block' : 'none';
        
        this.header.element.querySelector('.persons-toggle-btn')?.classList.toggle('active', this.header.personsSplitOpen);
        this.header.element.querySelector('.inventory-toggle-btn')?.classList.toggle('active', this.header.inventorySplitOpen);
    }

    _setSplitContent(type) {
        this.splitSideContainer.innerHTML = '';
        const table = type === 'people' ? this.personsTable : this.inventoryTable;
        if (table) {
            const el = table.render();
            el.className = 'persons-table-full';
            this.splitSideContainer.appendChild(el);
        }
    }

    _handlePersonsFullView() {
        this.tablesContainer.style.display = 'none';
        this._setSplitContent('people');
        this.splitSideContainer.style.display = 'flex';
        this.resizer.style.display = 'none';
        this.splitSideContainer.classList.add('full-view');
        this.header.personsSplitOpen = true;
        this.header.inventorySplitOpen = false;
        this._updateSplitVisibility();
    }

    _handleInventoryFullView() {
        this.tablesContainer.style.display = 'none';
        this._setSplitContent('inventory');
        this.splitSideContainer.style.display = 'flex';
        this.resizer.style.display = 'none';
        this.splitSideContainer.classList.add('full-view');
        this.header.inventorySplitOpen = true;
        this.header.personsSplitOpen = false;
        this._updateSplitVisibility();
    }

    async _handleUserInfo() {
        await UserInfoPage.show(this.peopleData, this.tableConfigs);
        this.globalState.updatePermissionsFromStorage();
        // Re-init tables to reflect changes
        this.tablesContainer.innerHTML = '';
        await this._loadTables();
        this._handleTableSwitch(this.currentTableId);
    }

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
            const res = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data?id=eq.app_auth&select=rows`, {
                headers: { 'apikey': SUPABASE_CONFIG.ANON_KEY, 'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}` }
            });
            const data = await res.json();
            const authData = data?.[0]?.rows || {};
            authData[authUser] = newPass;
            await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_CONFIG.ANON_KEY, 'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`, 'Prefer': 'resolution=merge-duplicates' },
                body: JSON.stringify({ id: 'app_auth', rows: authData })
            });
            await UserStatsService.recordPasswordChange(authUser);
            this._handleLogout();
        } catch (e) { alert(e.message); }
    }

    async _handleSaveAll() {
        const unsavedIds = this.globalState.getUnsavedTableIds();
        try {
            for (const id of unsavedIds) {
                const table = this.tables[id]?.instance || this.personsTable;
                if (table?.editor) await table.editor._saveTable(table);
            }
            this.globalState.clearAllUnsaved();
        } catch (e) { alert(`Fehler beim Speichern: ${e.message}`); }
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
        game.onRoundUpdate = (res) => UserStatsService.recordBlackjackResult(this.globalState.getCurrentUser(), res);
        const ui = new BlackjackUI(game, () => overlay.remove());
        const overlay = ui.render();
        document.body.appendChild(overlay);
    }

    _setupResizer() {
        let isResizing = false;
        this.resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            const startX = e.clientX;
            const startWidth = this.splitSideContainer.offsetWidth;
            const onMouseMove = (me) => {
                const deltaX = me.clientX - startX;
                const newWidth = Math.max(300, Math.min(window.innerWidth - 400, startWidth - deltaX));
                this.splitSideContainer.style.flex = `0 0 ${newWidth}px`;
            };
            const onMouseUp = () => {
                isResizing = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = '';
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'col-resize';
        });
    }

    _setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.custom-dialog-overlay, .permission-overlay, .user-info-overlay, .blackjack-overlay').forEach(el => el.remove());
                if (this.header.personsSplitOpen) this._handlePersonsToggle();
                if (this.header.inventorySplitOpen) this._handleInventoryToggle();
                document.querySelectorAll('.expanded-row, .data-cell.expanded').forEach(el => el.classList.remove('expanded-row', 'expanded'));
            }
        });

        this.globalState.onUnsavedChangeCallback((hasUnsaved) => {
            hasUnsaved ? this.header.showUnsavedBanner() : this.header.hideUnsavedBanner();
        });
    }
}
