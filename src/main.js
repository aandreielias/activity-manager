import './styles/main.css';
import { Header }      from './ui/Header.js';
import { TableLoader } from './core/TableLoader.js';
import { GlobalStateManager } from './core/GlobalStateManager.js';
import { Table } from './core/Table.js';


document.addEventListener('click', (e) => {
    if (!e.target.closest('.data-cell')) {
        document.querySelectorAll('.data-cell.expanded')
            .forEach(el => el.classList.remove('expanded'));
    }
});

// ── Initialize App ─────────────────────────────────────
async function initializeApp() {
    const base = import.meta.env.BASE_URL;
    // Dynamically import JSON data
    const tablesConfig = await fetch(`${base}data/tables.json`).then(r => r.json());
    const peopleData = await fetch(`${base}data/rows/people.json`).then(r => r.json());

    const app = document.getElementById('app');
    const globalState = GlobalStateManager.getInstance();

    // Create header with table configs
    const headerInstance = new Header({
        appName: 'Activity Manager',
        tableConfigs: tablesConfig,
        tables: {},
        onThemeToggle: () => {},
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

    // Create persons split-screen container (hidden by default)
    const personsSplitContainer = document.createElement('div');
    personsSplitContainer.className = 'persons-split-container';
    main.appendChild(personsSplitContainer);

    // Load all tables dynamically
    const tables = await TableLoader.loadAllTables(peopleData);
    headerInstance.tables = tables;

    // Render all tables
    const tableElements = {};

    Object.entries(tables).forEach(([tableId, { instance }]) => {
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-view-wrapper';
        tableWrapper.dataset.tableId = tableId;

        const el = instance.render();
        tableWrapper.appendChild(el);
        tableElements[tableId] = tableWrapper;
        tablesContainer.appendChild(tableWrapper);

        // Connect table editor to global state
        instance.editor.showSaveBar = function() {
            this.showUnsavedChange();
        };
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

        const personsEl = personsTable.render();
        personsEl.className = 'persons-table-full';
        personsSplitContainer.appendChild(personsEl);

        // Connect persons table editor to global state
        personsTable.editor.showSaveBar = function() {
            this.showUnsavedChange();
        };
    }

    // Function to show/hide tables
    const showTable = (tableId) => {
        // Ensure tables container is visible when showing regular tables
        tablesContainer.style.display = 'flex';
        
        // Disable persons full-view if active
        if (personsSplitContainer.classList.contains('full-view')) {
            personsSplitContainer.classList.remove('full-view');
            personsSplitContainer.style.display = headerInstance.personsSplitOpen ? 'flex' : 'none';
            resizer.style.display = headerInstance.personsSplitOpen ? 'block' : 'none';
        }

        if (tableId === 'all-spiele') {
            // Show all spiele tables
            Object.entries(tableElements).forEach(([id, element]) => {
                const config = tablesConfig.find(t => t.id === id);
                element.style.display = config?.category === 'spiele' ? 'block' : 'none';
            });
        } else {
            // Show only selected table
            Object.values(tableElements).forEach(element => {
                element.style.display = element.dataset.tableId === tableId ? 'block' : 'none';
            });
        }
    };

    // Initially show all spiele tables
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
        
        if (personsSplitContainer.classList.contains('full-view')) {
            // Escaping full view
            personsSplitContainer.classList.remove('full-view');
            tablesContainer.style.display = 'flex';
            
            // Restore previous split state
            personsSplitContainer.style.display = headerInstance.personsSplitOpen ? 'flex' : 'none';
            resizer.style.display = headerInstance.personsSplitOpen ? 'block' : 'none';
            
            if (personsBtn && !headerInstance.personsSplitOpen) {
                 personsBtn.classList.remove('active');
            }
        } else {
            // Normal toggle
            headerInstance.personsSplitOpen = !headerInstance.personsSplitOpen;
            personsSplitContainer.style.display = headerInstance.personsSplitOpen ? 'flex' : 'none';
            resizer.style.display = headerInstance.personsSplitOpen ? 'block' : 'none';
            
            if (personsBtn) {
                personsBtn.classList.toggle('active', headerInstance.personsSplitOpen);
            }
        }
    };

    // Handle persons full view (double-click)
    headerInstance.onPersonsFullView = () => {
        // Hide tables container entirely
        tablesContainer.style.display = 'none';
        
        personsSplitContainer.style.display = 'flex';
        resizer.style.display = 'none';
        personsSplitContainer.classList.add('full-view');

        const personsBtn = headerInstance.element.querySelector('.persons-toggle-btn');
        if (personsBtn) {
            personsBtn.classList.add('active');
        }
    };

    // Add resizer drag functionality
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = personsSplitContainer.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const newWidth = Math.max(300, Math.min(window.innerWidth - 400, startWidth - deltaX));

        personsSplitContainer.style.flex = `0 0 ${newWidth}px`;
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
    headerInstance.onDiscardAll = () => {
        if (confirm('Alle ungespeicherten Änderungen verwerfen?')) {
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
}

// Initialize when DOM is ready
initializeApp().catch(err => console.error('Failed to initialize app:', err));
