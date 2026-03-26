import './styles/main.css';
import { Header }      from './ui/Header.js';
import { FieldType }   from './core/Field.js';
import { TableLoader } from './core/TableLoader.js';

document.addEventListener('dragover', (e) => e.preventDefault());

document.addEventListener('click', (e) => {
    if (!e.target.closest('.data-cell')) {
        document.querySelectorAll('.data-cell.expanded')
            .forEach(el => el.classList.remove('expanded'));
    }
});

// ── Data Saving Configuration ──────────────────────────
// Data is saved via Express.js backend API at /api/save-table
// No GitHub configuration needed

// ── Initialize App ─────────────────────────────────────
async function initializeApp() {
    // Dynamically import JSON data
    const { default: tablesConfig } = await import('./data/tables.json', { assert: { type: 'json' } });
    const { default: peopleData } = await import('./data/rows/people.json', { assert: { type: 'json' } });
    
    const app = document.getElementById('app');

    // Create header with table configs
    const headerInstance = new Header({
        appName: 'Activity Manager',
        tableConfigs: tablesConfig,
        onThemeToggle: (isDark) => console.log('theme:', isDark ? 'dark' : 'light'),
    });
    const headerEl = headerInstance.render();
    app.appendChild(headerEl);

    const main = document.createElement('main');
    main.className = 'main-container';
    main.style.cssText = 'padding: 28px; display: flex; flex-direction: column; gap: 20px; flex: 1; overflow-y: auto;';
    app.appendChild(main);

    // Create a container for tables - vertical stacking
    const tablesContainer = document.createElement('div');
    tablesContainer.className = 'tables-container';
    tablesContainer.style.cssText = 'display: flex; flex-direction: column; gap: 20px; flex: 1;';
    main.appendChild(tablesContainer);

    // Load all tables dynamically
    const tables = await TableLoader.loadAllTables(peopleData);
    
    // Render all tables
    const tableElements = {};
    let currentTableId = null; // null means show all
    
    Object.entries(tables).forEach(([tableId, { instance, config }]) => {
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-view';
        tableWrapper.dataset.tableId = tableId;
        tableWrapper.style.cssText = 'overflow-y: auto;';
        
        const el = instance.render();
        tableWrapper.appendChild(el);
        tableElements[tableId] = tableWrapper;
        tablesContainer.appendChild(tableWrapper);
    });

    // Function to show/hide tables
    const showTable = (tableId) => {
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

    // Handle table switching
    headerInstance.onTableSwitch = (tableId) => {
        currentTableId = tableId;
        showTable(tableId);
    };
}

// Initialize when DOM is ready
initializeApp().catch(err => console.error('Failed to initialize app:', err));
