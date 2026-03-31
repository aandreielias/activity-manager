import './styles/main.css';
import { Header }      from './ui/Header.js';
import { SUPABASE_CONFIG } from './config.js';
import { TableLoader } from './core/TableLoader.js';
import { GlobalStateManager } from './core/GlobalStateManager.js';
import { Table } from './core/Table.js';
import { Dialog } from './ui/Dialog.js';
import { LoginDialog } from './ui/LoginDialog.js';
import { PermissionDialog } from './ui/PermissionDialog.js';


document.addEventListener('click', (e) => {
    if (!e.target.closest('.data-cell')) {
        document.querySelectorAll('.data-cell.expanded')
            .forEach(el => el.classList.remove('expanded'));
    }
});

// ── Theme Management ────────────────────────────────────
const initialTheme = localStorage.getItem('theme') || 'light';
document.documentElement.dataset.theme = initialTheme;

async function toggleTheme(clickX, clickY) {
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

    const x = clickX || window.innerWidth / 2;
    const y = clickY || window.innerHeight / 2;
    const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
        setThemeState();
    });

    await transition.updateCallbackDone;

    transition.ready.then(() => {
        document.documentElement.animate(
            {
                clipPath: [
                    `circle(0 at ${x}px ${y}px)`,
                    `circle(${endRadius}px at ${x}px ${y}px)`,
                ],
            },
            {
                duration: 500,
                easing: 'ease-in-out',
                pseudoElement: '::view-transition-new(root)',
            }
        );
    });
}

// ── Initialize App ─────────────────────────────────────
async function initializeApp() {
    const base = import.meta.env.BASE_URL;
    // Dynamically import JSON data
    const tablesConfig = await fetch(`${base}data/tables.json`).then(r => r.json());
    const peopleData = await fetch(`${base}data/rows/people.json`).then(r => r.json());

    // --- Authentication Flow ---
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

            // Fallback to local auth if Supabase has nothing
            if (!authData) {
                const localAuthRes = await fetch(`${base}data/auth.json`);
                authData = await localAuthRes.json();
            }

            if (!authData[authUser]) {
                // First-time login: save to Supabase
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
                authPass = null;
            }
        } catch(e) {
            console.error('Auth error:', e);
            authUser = null;
            authPass = null;
        }
    }

    if (!authUser) {
        const creds = await LoginDialog.show(peopleData);
        authUser = creds.username;
        authPass = creds.password;
        localStorage.setItem('auth_user', authUser);
        localStorage.setItem('auth_pass', authPass);
    }

    const globalState = GlobalStateManager.getInstance();

    if (authUser) {
        const person = peopleData.find(p => `${p.vorname || ''} ${p.nachname || ''}`.trim() === authUser);
        
        if (!person) {
            // Found no such person in the database -> Lock everything down
            globalState.setCurrentUser(authUser, 'user', { type: 'readonly', tables: [] });
        } else {
            authRole = person.role || 'user';
            const permissionsMap = JSON.parse(localStorage.getItem('app_permissions_map') || '{}');
            const userPerms = permissionsMap[authUser] || null;
            globalState.setCurrentUser(authUser, authRole, userPerms);
        }

        // Load private favorites from Supabase
        try {
            const favRes = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data?id=eq.favs_${authUser}&select=rows`, {
                headers: { 'apikey': SUPABASE_CONFIG.ANON_KEY, 'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}` }
            });
            const favData = await favRes.json();
            const userFavs = favData && favData[0] ? favData[0].rows : [];
            globalState.setInitialFavorites(userFavs);
        } catch (e) {
            console.error('Failed to load favorites:', e);
        }
    }
    // --- End Auth ---

    const app = document.getElementById('app');

    // Create header with table configs
    const headerInstance = new Header({
        appName: 'Activity Manager',
        tableConfigs: tablesConfig,
        tables: {},
        onThemeToggle: (x, y) => toggleTheme(x, y),
    });
    const headerEl = headerInstance.render();
    app.appendChild(headerEl);

    const main = document.createElement('main');
    main.className = 'main-container layout-row';
    app.appendChild(main);

    // Create a container for tables - vertical stacking
    const tablesContainer = document.createElement('div');
    tablesContainer.className = 'tables-container';
    main.appendChild(tablesContainer);

    // Create resizer element
    const resizer = document.createElement('div');
    resizer.className = 'split-resizer';
    resizer.innerHTML = '<div class="split-resizer-handle"></div>';
    main.appendChild(resizer);

    // Create global split-screen container (hidden by default)
    const splitSideContainer = document.createElement('div');
    splitSideContainer.className = 'persons-split-container'; // Reuse styling
    main.appendChild(splitSideContainer);

    // Load all tables dynamically
    const tables = await TableLoader.loadAllTables(peopleData);
    headerInstance.tables = tables;
    
    // Provide inventory data globally for field cross-referencing
    if (tables['tbl_inventory']) {
        globalState.setInventory(tables['tbl_inventory'].instance.rows);
    }

    // Render viewable tables only
    const tableElements = {};
    let renderedCount = 0;

    Object.entries(tables).forEach(([tableId, { instance }]) => {
        // Strict view check
        if (!globalState.canView(tableId)) {
            return; 
        }

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-view-wrapper';
        tableWrapper.dataset.tableId = tableId;

        const el = instance.render();
        tableWrapper.appendChild(el);
        tableElements[tableId] = tableWrapper;
        tablesContainer.appendChild(tableWrapper);
        renderedCount++;

        // Connect table editor to global state
        instance.editor.showSaveBar = function() {
            this.showUnsavedChange();
        };
    });

    // Handle initial switch/empty state
    if (renderedCount === 0) {
        tablesContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted); gap:16px; padding:40px; text-align:center;">
                <h2 style="color:var(--text-primary); margin:0;">Kein Zugriff</h2>
                <p style="margin:0; opacity:0.8;">Sie haben keine Berechtigung, Tabellen in diesem Bereich anzuzeigen.<br>Bitte wenden Sie sich an die Administration.</p>
            </div>
        `;
    }

    // Global ESC key handler for intuitive navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close any open dialogs/overlays (Inventory Picker, Permissions, etc.)
            document.querySelectorAll('.custom-dialog-overlay, .permission-overlay').forEach(el => el.remove());

            // Reset side split views if open
            if (headerInstance.personsSplitOpen) headerInstance.onPersonsToggle?.();
            if (headerInstance.inventorySplitOpen) headerInstance.onInventoryToggle?.();
            
            // Collapse any expanded rows and cells
            document.querySelectorAll('.expanded-row').forEach(tr => tr.classList.remove('expanded-row'));
            document.querySelectorAll('.data-cell.expanded').forEach(td => td.classList.remove('expanded'));
        }
    });

    // Create persons table for split view
    let personsTable = null;
    if (peopleData && peopleData.length > 0) {
        const personsConfig = {
            id: 'people_table',
            title: 'Personen',
            schema: [
                { id: 'vorname', label: 'Vorname', type: 'text' },
                { id: 'nachname', label: 'Nachname', type: 'text' },
                { id: 'Tel.', label: 'Telefon', type: 'text' },
                { id: 'Status', label: 'Status', type: 'enum', options: ['aktiv', 'inaktiv'] },
                { id: 'role', label: 'Rolle', type: 'text' },
                { id: 'Spez. Zuständigkeit', label: 'Spez. Zuständigkeit', type: 'text' }
            ]
        };
        personsTable = new Table({
            id: 'people_table',
            title: 'Personen',
            schema: personsConfig.schema,
            rows: peopleData,
            peopleData: [],
            tableConfig: personsConfig
        });
    }
    
    const personsEl = personsTable?.render();
    if (personsEl) personsEl.className = 'persons-table-full';

    // Get inventory table instance
    const inventoryTable = tables['tbl_inventory']?.instance;
    const inventoryEl = inventoryTable?.render();
    if (inventoryEl) inventoryEl.className = 'persons-table-full'; // Reuse styling
    
    // Function to populate split view
    const setSplitContent = (type) => {
        splitSideContainer.innerHTML = '';
        if (type === 'people' && personsEl) {
            splitSideContainer.appendChild(personsEl);
        } else if (type === 'inventory' && inventoryEl) {
            splitSideContainer.appendChild(inventoryEl);
        }
    };
    
    // Initial content
    setSplitContent('people');

    // Function to show/hide tables
    const showTable = (tableId) => {
        // Ensure tables container is visible when showing regular tables
        tablesContainer.style.display = 'flex';
        
        // Disable right split full-view if active
        if (splitSideContainer.classList.contains('full-view')) {
            splitSideContainer.classList.remove('full-view');
            splitSideContainer.style.display = (headerInstance.personsSplitOpen || headerInstance.inventorySplitOpen) ? 'flex' : 'none';
            resizer.style.display = (headerInstance.personsSplitOpen || headerInstance.inventorySplitOpen) ? 'block' : 'none';
        }

        if (tableId === 'all-spiele') {
            // Show all spiele tables
            Object.entries(tableElements).forEach(([id, element]) => {
                const config = tablesConfig.find(t => t.id === id);
                element.style.display = config?.category === 'spiele' ? 'block' : 'none';
            });
        } else if (tableId === 'all-sportarten') {
            // Show all sportarten tables
            Object.entries(tableElements).forEach(([id, element]) => {
                const config = tablesConfig.find(t => t.id === id);
                element.style.display = config?.category === 'sportarten' ? 'block' : 'none';
            });
        } else {
            // Show only selected table
            Object.values(tableElements).forEach(element => {
                element.style.display = element.dataset.tableId === tableId ? 'block' : 'none';
            });
        }
    };

    // Initially show all spiele tables
    headerInstance.switchTo('all-spiele');
    showTable('all-spiele');

    let currentTableId = 'all-spiele';

    // Handle table switching
    headerInstance.onTableSwitch = (tableId) => {
        currentTableId = tableId;
        showTable(tableId);
    };

    // Handle persons toggle
    headerInstance.onPersonsToggle = () => {
        const personsBtn = headerInstance.element.querySelector('.persons-toggle-btn');
        const inventoryBtn = headerInstance.element.querySelector('.inventory-toggle-btn');
        
        if (splitSideContainer.classList.contains('full-view')) {
            splitSideContainer.classList.remove('full-view');
            tablesContainer.style.display = 'flex';
            splitSideContainer.style.display = headerInstance.personsSplitOpen ? 'flex' : 'none';
            resizer.style.display = headerInstance.personsSplitOpen ? 'block' : 'none';
        } else {
            headerInstance.personsSplitOpen = !headerInstance.personsSplitOpen;
            if (headerInstance.personsSplitOpen) {
                headerInstance.inventorySplitOpen = false;
                setSplitContent('people');
            }
            
            splitSideContainer.style.display = headerInstance.personsSplitOpen ? 'flex' : 'none';
            resizer.style.display = headerInstance.personsSplitOpen ? 'block' : 'none';
            
            if (personsBtn) personsBtn.classList.toggle('active', headerInstance.personsSplitOpen);
            if (inventoryBtn) inventoryBtn.classList.remove('active');
        }
    };

    // Handle inventory toggle
    headerInstance.onInventoryToggle = () => {
        const personsBtn = headerInstance.element.querySelector('.persons-toggle-btn');
        const inventoryBtn = headerInstance.element.querySelector('.inventory-toggle-btn');
        
        if (splitSideContainer.classList.contains('full-view')) {
            splitSideContainer.classList.remove('full-view');
            tablesContainer.style.display = 'flex';
            splitSideContainer.style.display = headerInstance.inventorySplitOpen ? 'flex' : 'none';
            resizer.style.display = headerInstance.inventorySplitOpen ? 'block' : 'none';
        } else {
            headerInstance.inventorySplitOpen = !headerInstance.inventorySplitOpen;
            if (headerInstance.inventorySplitOpen) {
                headerInstance.personsSplitOpen = false;
                setSplitContent('inventory');
            }
            
            splitSideContainer.style.display = headerInstance.inventorySplitOpen ? 'flex' : 'none';
            resizer.style.display = headerInstance.inventorySplitOpen ? 'block' : 'none';
            
            if (inventoryBtn) inventoryBtn.classList.toggle('active', headerInstance.inventorySplitOpen);
            if (personsBtn) personsBtn.classList.remove('active');
        }
    };

    // Handle persons full view (double-click)
    headerInstance.onPersonsFullView = () => {
        tablesContainer.style.display = 'none';
        setSplitContent('people');
        splitSideContainer.style.display = 'flex';
        resizer.style.display = 'none';
        splitSideContainer.classList.add('full-view');
        headerInstance.personsSplitOpen = true;
        headerInstance.inventorySplitOpen = false;
        headerInstance.element.querySelector('.persons-toggle-btn')?.classList.add('active');
        headerInstance.element.querySelector('.inventory-toggle-btn')?.classList.remove('active');
    };

    // Handle inventory full view (double-click)
    headerInstance.onInventoryFullView = () => {
        tablesContainer.style.display = 'none';
        setSplitContent('inventory');
        splitSideContainer.style.display = 'flex';
        resizer.style.display = 'none';
        splitSideContainer.classList.add('full-view');
        headerInstance.inventorySplitOpen = true;
        headerInstance.personsSplitOpen = false;
        headerInstance.element.querySelector('.inventory-toggle-btn')?.classList.add('active');
        headerInstance.element.querySelector('.persons-toggle-btn')?.classList.remove('active');
    };

    // Handle manage permissions
    headerInstance.onManagePermissions = async () => {
        await PermissionDialog.show(peopleData, tablesConfig);
        // Reload page to apply changes properly throughout the app (reactive permissions)
        window.location.reload();
    };

    // Handle logout
    headerInstance.onLogout = () => {
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_pass');
        window.location.reload();
    };

    // Handle change password
    headerInstance.onChangePassword = async () => {
        const newPass = await Dialog.prompt({
            message: 'Neues Passwort eingeben:',
            confirmText: 'Ändern',
            type: 'password',
            placeholder: 'Neues Passwort'
        });

        if (!newPass) return;

        try {
            const supabaseAuthRes = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data?id=eq.app_auth&select=rows`, {
                headers: { 'apikey': SUPABASE_CONFIG.ANON_KEY, 'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}` }
            });
            const sbAuthData = await supabaseAuthRes.json();
            let authData = sbAuthData && sbAuthData[0] ? sbAuthData[0].rows : {};

            authData[authUser] = newPass;

            await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_CONFIG.ANON_KEY, 'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`, 'Prefer': 'resolution=merge-duplicates' },
                body: JSON.stringify({ id: 'app_auth', rows: authData })
            });

            localStorage.removeItem('auth_pass'); 
            window.location.reload();
        } catch (e) {
            alert(e.message);
        }
    };

    // Add resizer drag functionality
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = splitSideContainer.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const newWidth = Math.max(300, Math.min(window.innerWidth - 400, startWidth - deltaX));

        splitSideContainer.style.flex = `0 0 ${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    // Handle save all
    headerInstance.onSaveAll = async () => {
        const unsavedIds = globalState.getUnsavedTableIds();
        if (unsavedIds.length === 0) return;

        const saveBtn = headerInstance.element.querySelector('.save-btn-header');
        if (saveBtn) saveBtn.disabled = true;

        try {
            for (const tableId of unsavedIds) {
                const table = tables[tableId]?.instance || personsTable;
                if (table && table.editor) {
                    await table.editor._saveTable(table);
                }
            }
            globalState.clearAllUnsaved();
            headerInstance.hideUnsavedBanner();
        } catch (error) {
            console.error('Speicherfehler:', error);
            alert(`Fehler beim Speichern der Tabellen: ${error.message}`);
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    };

    // Handle discard all
    headerInstance.onDiscardAll = async () => {
        const confirmed = await Dialog.confirm({
            message: 'Alle ungespeicherten Änderungen verwerfen?',
            confirmText: 'Verwerfen',
            confirmStyle: 'warning'
        });
        if (confirmed) {
            globalState.clearAllUnsaved();
            headerInstance.hideUnsavedBanner();
            // Reload to revert changes
            window.location.reload();
        }
    };

    // Listen for unsaved changes
    globalState.onUnsavedChangeCallback((hasUnsaved) => {
        if (hasUnsaved) {
            headerInstance.showUnsavedBanner();
        } else {
            headerInstance.hideUnsavedBanner();
        }
    });

    // Handle favorites toggle
    headerInstance.onFavoritesToggle = (isActive) => {
        globalState.setFavoritesFilterActive(isActive);
        if (isActive) {
            document.body.classList.add('favorites-active');
        } else {
            document.body.classList.remove('favorites-active');
        }
    };
}

// Initialize when DOM is ready
initializeApp().catch(err => console.error('Failed to initialize app:', err));
