import { Header } from '../ui/Header.js';
import { Table } from './Table.js';
import { Dialog } from '../ui/Dialog.js';
import { GlobalStateManager } from './GlobalStateManager.js';
import { UserInfoPage } from '../ui/UserInfoPage.js';
import { TableLoader } from './TableLoader.js';
import { CalendarView } from '../ui/CalendarView.js';

const PEOPLE_SCHEMA = Object.freeze([
    { id: 'vorname', label: 'Vorname', type: 'text' },
    { id: 'nachname', label: 'Nachname', type: 'text' },
    { id: 'Tel.', label: 'Telefon', type: 'text' },
    { id: 'Status', label: 'Status', type: 'enum', options: ['Aktiv', 'Inaktiv'] },
    { id: 'role', label: 'Rolle', type: 'enum', options: ['Superadmin', 'Admin', 'Supervisor', 'User', 'Inaktiv'] },
    { id: 'responsibility_1', label: 'Verantwortlich 1', type: 'enum', options: ['Gruppenspiele', 'Zwischendurch', 'Icebreaker', 'Sport', 'Sonstige'] },
    { id: 'responsibility_2', label: 'Verantwortlich 2', type: 'enum', options: ['Gruppenspiele', 'Zwischendurch', 'Icebreaker', 'Sport', 'Sonstige'] },
    { id: 'Spez. Zuständigkeit', label: 'Spez. Zuständigkeit', type: 'text' },
    { id: 'Team', label: 'Team', type: 'tag' },
    { id: 'createdBy', label: 'Erstellt von', type: 'text' },
    { id: 'createdAt', label: 'Erstellt am', type: 'date' },
]);

/**
 * UIManager - Handles UI layout, rendering, and user interactions.
 */
export class UIManager {
    constructor(app) {
        this.app = app;
        this.globalState = GlobalStateManager.getInstance();
        this.header = null;
        this.mainElement = null;
        this.tablesContainer = null;
        this.splitSideContainer = null;
        this.resizer = null;
        this.currentTableId = 'all-spiele';
        this.personsTable = null;
        this.inactivePersonsTable = null;
        this.inventoryTable = null;
        this.calendarView = null;
        this.tables = {};
    }

    setupLayout(tableConfigs) {
        const appElement = document.getElementById('app');
        appElement.innerHTML = '';

        this.header = new Header({
            appName: 'Activity Manager',
            tableConfigs,
            onThemeToggle: (x, y) => this._toggleTheme(x, y),
        });

        this.header.onTableSwitch = (id, rowId, colId) => this._handleTableSwitch(id, rowId, colId);
        this.header.onPersonsToggle = () => this._handlePersonsToggle();
        this.header.onInventoryToggle = () => this._handleInventoryToggle();
        this.header.onPersonsFullView = () => this._handlePersonsFullView();
        this.header.onInventoryFullView = () => this._handleInventoryFullView();
        this.header.onUserInfo = () => this._handleUserInfo();
        this.header.onLogout = () => this.app._handleLogout();
        this.header.onChangePassword = () => this.app._handleChangePassword();
        this.header.onSaveAll = () => this.app._handleSaveAll();
        this.header.onDiscardAll = () => this.app._handleDiscardAll();
        this.header.onFavoritesToggle = (active) => this._handleFavoritesToggle(active);
        this.header.onEditModeToggle = (active) => this.globalState.setEditModeActive(active);
        this.header.onCalendarToggle = () => this._handleCalendarToggle();
        this.header.onLogoDoubleClick = () => this.app._launchBlackjack();

        appElement.appendChild(this.header.render());

        this.mainElement = document.createElement('main');
        this.mainElement.className = 'main-container layout-row';
        appElement.appendChild(this.mainElement);

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

    async loadTables(tables, peopleData) {
        this.tables = tables;
        this.header.tables = tables;

        if (tables['tbl_inventory']) {
            this.globalState.setInventory(tables['tbl_inventory'].instance.rows);
        }

        // Initialize Calendar
        if (tables['tbl_events']) {
            this.calendarView = new CalendarView({ eventsTable: tables['tbl_events'].instance });
            const wrapper = document.createElement('div');
            wrapper.className = 'table-view-wrapper calendar-view-wrapper';
            wrapper.dataset.tableId = 'calendar';
            wrapper.appendChild(this.calendarView.render());
            this.app.tableElements['calendar'] = wrapper;
            this.tablesContainer.appendChild(wrapper);
            
            this.calendarView.onEventClick = (id) => {
                this.header.switchTo('tbl_events');
                this._handleTableSwitch('tbl_events', id);
            };

            this.calendarView.onAddEvent = (date) => {
                const eventsTable = tables['tbl_events'].instance;
                this.header.switchTo('tbl_events');
                this._handleTableSwitch('tbl_events');
                
                const defaults = eventsTable.tableConfig?.defaultRowData || {};
                const newRow = eventsTable.addRow({ 
                    ...defaults,
                    date,
                    name: 'Neues Event',
                    createdBy: this.globalState.getCurrentUser(),
                    createdAt: new Date().toISOString()
                });

                // Small delay to let the table render the new row
                setTimeout(() => {
                    this._highlightRow(newRow.id);
                    // Find the name cell and start editing
                    const rowEl = document.querySelector(`tr[data-row-id="${newRow.id}"]`);
                    const nameCell = rowEl?.querySelector('[data-col-id="name"]');
                    nameCell?.click();
                }, 150);
            };

            this.calendarView.onGameClick = (name) => {
                // Search for the game across all spiele tables
                for (const [tableId, tableInfo] of Object.entries(this.tables)) {
                    if (tableInfo.config.category !== 'spiele') continue;
                    const row = tableInfo.instance.rows.find(r => r.data.name === name);
                    if (row) {
                        this.header.switchTo(tableId);
                        this._handleTableSwitch(tableId, row.id);
                        return;
                    }
                }
            };
        }

        let renderedCount = 0;

        Object.entries(tables).forEach(([tableId, { instance, config }]) => {
            if (!this.globalState.canView(tableId)) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'table-view-wrapper';
            wrapper.dataset.tableId = tableId;

            if (tableId === 'tbl_people') {
                const { activeRows, inactiveRows } = this._splitPeopleByStatus(peopleData);

                const activeTable = this._createPeopleTable(config, 'Aktive Mitglieder', activeRows, { Status: 'Aktiv' });
                const inactiveTable = this._createPeopleTable(config, 'Inaktive Mitglieder', inactiveRows, { Status: 'Inaktiv' });

                const inactiveEl = inactiveTable.render();
                inactiveEl.classList.add('inactive-members-table');

                wrapper.appendChild(activeTable.render());
                wrapper.appendChild(inactiveEl);

                activeTable.editor.showUnsavedChange = () => instance.editor.showUnsavedChange();
                inactiveTable.editor.showUnsavedChange = () => instance.editor.showUnsavedChange();

                tables[tableId].instances = [activeTable, inactiveTable];
            } else {
                wrapper.appendChild(instance.render());
            }

            this.app.tableElements[tableId] = wrapper;
            this.tablesContainer.appendChild(wrapper);
            renderedCount++;
        });

        if (renderedCount === 0) {
            this.tablesContainer.innerHTML = `<div class="empty-state-container"><h2>Kein Zugriff</h2><p>Sie haben keine Berechtigung, Tabellen in diesem Bereich anzuzeigen.</p></div>`;
        }

        this._initSplitViewTables(tables, peopleData);
    }

    showInitialView() {
        this.header.switchTo('all-spiele');
        this._handleTableSwitch('all-spiele');
    }

    setupEventListeners() {
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

    // Private methods

    _splitPeopleByStatus(peopleData) {
        const activeRows = peopleData.filter(p => {
            const s = (p.Status || '').toLowerCase();
            return s === 'aktiv' || s === '';
        });
        const inactiveRows = peopleData.filter(p => (p.Status || '').toLowerCase() === 'inaktiv');
        return { activeRows, inactiveRows };
    }

    _createPeopleTable(config, title, rows, defaultRowData = {}) {
        return new Table({
            ...config,
            title,
            schema: [...PEOPLE_SCHEMA],
            rows,
            peopleData: this.app.peopleData,
            tableConfig: { ...config, defaultRowData },
        });
    }

    _initSplitViewTables(tables, peopleData) {
        if (peopleData.length > 0) {
            this.personsTable = new Table({
                id: 'people_table',
                title: 'Personen',
                schema: [...PEOPLE_SCHEMA],
                rows: peopleData,
                tableConfig: { id: 'people_table', schema: [...PEOPLE_SCHEMA] },
            });
        }
        this.inventoryTable = tables['tbl_inventory']?.instance;
    }

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

    _handleTableSwitch(tableId, rowId, colId) {
        this.currentTableId = tableId;
        this.tablesContainer.style.display = 'flex';

        if (this.splitSideContainer.classList.contains('full-view')) {
            this.splitSideContainer.classList.remove('full-view');
            const open = this.header.personsSplitOpen || this.header.inventorySplitOpen;
            this.splitSideContainer.style.display = open ? 'flex' : 'none';
            this.resizer.style.display = open ? 'block' : 'none';
        }

        Object.entries(this.app.tableElements).forEach(([id, el]) => {
            if (tableId === 'all-spiele') {
                el.style.display = this.app.tableConfigs.find(c => c.id === id)?.category === 'spiele' ? 'block' : 'none';
            } else if (tableId === 'all-sportarten') {
                el.style.display = this.app.tableConfigs.find(c => c.id === id)?.category === 'sportarten' ? 'block' : 'none';
            } else {
                el.style.display = id === tableId ? 'block' : 'none';
            }
        });

        const calBtn = this.header.element.querySelector('.calendar-toggle-btn');
        calBtn?.classList.toggle('active', tableId === 'calendar');

        if (rowId) {
            this._highlightRow(rowId, colId);
        }
    }

    _handleCalendarToggle() {
        this._handleTableSwitch('calendar');
        this.header.switchTo(null); // Deselect table buttons
        this.calendarView?._updateUI();
    }

    _highlightRow(rowId, colId) {
        // Small timeout to ensure table is rendered and visible
        setTimeout(() => {
            const rowEls = document.querySelectorAll(`tr[data-row-id="${rowId}"]`);
            if (rowEls.length > 0) {
                const firstEl = rowEls[0];
                firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                rowEls.forEach(el => {
                    el.classList.add('search-highlight-flash');
                    
                    if (colId) {
                        const cell = el.querySelector(`.data-cell[data-col-id="${colId}"]`);
                        if (cell) {
                            cell.classList.add('cell-highlight-flash');
                            setTimeout(() => cell.classList.remove('cell-highlight-flash'), 2500);
                        }
                    }

                    setTimeout(() => el.classList.remove('search-highlight-flash'), 2500);
                });
            }
        }, 150);
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

        if (type === 'people' && this.app.peopleData.length > 0) {
            const config = { id: 'people_table', schema: [...PEOPLE_SCHEMA] };
            const { activeRows, inactiveRows } = this._splitPeopleByStatus(this.app.peopleData);

            const activeTable = this._createPeopleTable(config, 'Personen (Aktiv)', activeRows, { Status: 'Aktiv' });
            const inactiveTable = this._createPeopleTable(config, 'Personen (Inaktiv)', inactiveRows, { Status: 'Inaktiv' });

            const activeEl = activeTable.render();
            activeEl.classList.add('persons-table-full');
            this.splitSideContainer.appendChild(activeEl);

            const inactiveEl = inactiveTable.render();
            inactiveEl.classList.add('persons-table-full', 'inactive-members-table');
            this.splitSideContainer.appendChild(inactiveEl);

            this.personsTable = activeTable;
            this.inactivePersonsTable = inactiveTable;
        } else {
            const table = type === 'inventory' ? this.inventoryTable : this.personsTable;
            if (table) {
                const el = table.render();
                el.className = 'persons-table-full';
                this.splitSideContainer.appendChild(el);
            }
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

    _handleFavoritesToggle(active) {
        this.globalState.setFavoritesFilterActive(active);
        document.body.classList.toggle('favorites-active', active);
    }

    _setupResizer() {
        this.resizer.addEventListener('mousedown', (e) => {
            const startX = e.clientX;
            const startWidth = this.splitSideContainer.offsetWidth;

            const onMouseMove = (me) => {
                const deltaX = me.clientX - startX;
                const newWidth = Math.max(300, Math.min(window.innerWidth - 400, startWidth - deltaX));
                this.splitSideContainer.style.flex = `0 0 ${newWidth}px`;
            };
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = '';
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'col-resize';
        });
    }

    async _handleUserInfo() {
        await UserInfoPage.show(this.app.peopleData, this.app.tableConfigs);
        this.globalState.updatePermissionsFromStorage();
        await this.reloadTables();
        this._handleTableSwitch(this.currentTableId);
    }

    async reloadTables() {
        this.tables = await TableLoader.loadAllTables(this.app.peopleData);
        this.header.tables = this.tables;

        if (this.tables['tbl_inventory']) {
            this.globalState.setInventory(this.tables['tbl_inventory'].instance.rows);
        }

        this.tablesContainer.innerHTML = '';
        let renderedCount = 0;

        Object.entries(this.tables).forEach(([tableId, { instance, config }]) => {
            if (!this.globalState.canView(tableId)) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'table-view-wrapper';
            wrapper.dataset.tableId = tableId;

            if (tableId === 'tbl_people') {
                const { activeRows, inactiveRows } = this._splitPeopleByStatus(this.app.peopleData);

                const activeTable = this._createPeopleTable(config, 'Aktive Mitglieder', activeRows, { Status: 'Aktiv' });
                const inactiveTable = this._createPeopleTable(config, 'Inaktive Mitglieder', inactiveRows, { Status: 'Inaktiv' });

                const inactiveEl = inactiveTable.render();
                inactiveEl.classList.add('inactive-members-table');

                wrapper.appendChild(activeTable.render());
                wrapper.appendChild(inactiveEl);

                activeTable.editor.showUnsavedChange = () => instance.editor.showUnsavedChange();
                inactiveTable.editor.showUnsavedChange = () => instance.editor.showUnsavedChange();

                this.tables[tableId].instances = [activeTable, inactiveTable];
            } else {
                wrapper.appendChild(instance.render());
            }

            this.app.tableElements[tableId] = wrapper;
            this.tablesContainer.appendChild(wrapper);
            renderedCount++;
        });

        if (renderedCount === 0) {
            this.tablesContainer.innerHTML = `<div class="empty-state-container"><h2>Kein Zugriff</h2><p>Sie haben keine Berechtigung, Tabellen in diesem Bereich anzuzeigen.</p></div>`;
        }

        this._initSplitViewTables(this.tables, this.app.peopleData);
    }
}
