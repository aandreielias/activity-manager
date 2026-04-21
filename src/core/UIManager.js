import { Header } from '../ui/Header.js';
import { Table } from './Table.js';
import { Row } from './Row.js';
import { Dialog } from '../ui/Dialog.js';
import { GlobalStateManager } from './GlobalStateManager.js';
import { UserInfoPage } from '../ui/UserInfoPage.js';
import { TableLoader } from './TableLoader.js';
import { CalendarView } from '../ui/CalendarView.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserStatsService } from '../services/UserStatsService.js';
import { FilterEngine } from '../utils/FilterEngine.js';
import { FilterBar } from '../ui/FilterBar.js';
import { ColourFactory } from '../utils/ColourFactory.js';

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
        
        this.filterBarMain = null;
        this.filterBarSplit = null;
        this.globalBulkBar = null;
    }

    setupLayout(tableConfigs) {
        this.globalState.setTableConfigs(tableConfigs);
        const appElement = document.getElementById('app');
        appElement.innerHTML = '';

        this.header = new Header({
            appName: 'Activity Manager',
            tableConfigs,
            onThemeToggle: (x, y) => this._toggleTheme(x, y),
        });

        this.header.onTableSwitch = (id, rowId, colId) => this._handleTableSwitch(id, rowId, colId);
        this.header.onPersonsToggle = () => this._handlePersonsToggle();
        this.header.onPersonTeamSplitSwitch = (team) => this._handlePersonTeamSplitSwitch(team);
        this.header.onPersonTeamMainSwitch = (team) => this._handlePersonTeamMainSwitch(team);
        this.header.onInventoryToggle = () => this._handleInventoryToggle();
        this.header.onPersonsFullView = () => this._handlePersonsFullView();
        this.header.onInventoryFullView = () => this._handleInventoryFullView();
        this.header.onUserInfo = () => this._handleUserInfo();
        this.header.onLogout = () => this.app._handleLogout();
        this.header.onChangePassword = () => this.app._handleChangePassword();
        this.header.onSaveAll = () => this.app._handleSaveAll();
        this.header.onDiscardAll = () => this.app._handleDiscardAll();
        this.header.onFavoritesToggle = (active) => this._handleFavoritesToggle(active);
        this.header.onCategoryExport = (categoryId) => this._exportCategoryPDF(categoryId);
        // Removed Edit Mode toggle (part of edit mode)
        this.header.onCalendarToggle = () => this._handleCalendarToggle();
        this.header.onCalendarFull = () => this._handleCalendarFullView();
        this.header.onLogoDoubleClick = () => this.app._launchBlackjack();
        this.header.onLogoRightClick = () => this.app._launchTexasHoldem();

        appElement.appendChild(this.header.render());

        this.mainElement = document.createElement('main');
        this.mainElement.className = 'main-container layout-row';
        appElement.appendChild(this.mainElement);

        this.mainContent = document.createElement('div');
        this.mainContent.className = 'side-content-wrapper';
        this.mainElement.appendChild(this.mainContent);

        this.tablesContainer = document.createElement('div');
        this.tablesContainer.className = 'tables-container';
        this.mainContent.appendChild(this.tablesContainer);

        this.resizer = document.createElement('div');
        this.resizer.className = 'split-resizer';
        this.resizer.innerHTML = '<div class="split-resizer-handle"></div>';
        this._setupResizer();
        this.mainElement.appendChild(this.resizer);

        this.splitSideWrapper = document.createElement('div');
        this.splitSideWrapper.className = 'persons-split-container';
        this.mainElement.appendChild(this.splitSideWrapper);

        this.splitSideContainer = document.createElement('div');
        this.splitSideContainer.className = 'split-container-inner';
        this.splitSideContainer.style.flex = '1';
        this.splitSideContainer.style.overflowY = 'auto';
        this.splitSideWrapper.appendChild(this.splitSideContainer);

        this.globalBulkBar = this._renderGlobalBulkBar();
        document.body.appendChild(this.globalBulkBar);

        this._initFilterBars();
    }

    _initFilterBars() {
        const gs = GlobalStateManager.getInstance();
        
        this.filterBarMain = new FilterBar({
            schema: [],
            state: gs.getGlobalFilterState('main', 'default'),
            onUpdate: () => this._updateAllTables('main'),
            isGlobal: true
        });

        this.filterBarSplit = new FilterBar({
            schema: [],
            state: gs.getGlobalFilterState('split', 'default'),
            onUpdate: () => this._updateAllTables('split'),
            isGlobal: true
        });


        this.mainContent.prepend(this.filterBarMain.render());
        this.splitSideWrapper.prepend(this.filterBarSplit.render());
    }

    _updateAllTables(side) {
        Object.values(this.tables).forEach(t => {
            if (t.instance && t.instance.renderer) {
                const isSplit = t.instance.renderer.element?.closest('.split-container-inner') !== null;
                if ((side === 'split' && isSplit) || (side === 'main' && !isSplit)) {
                    t.instance.renderer.update();
                }
            }
        });
    }

    _populateFilterBar(side) {
        const bar = side === 'split' ? this.filterBarSplit : this.filterBarMain;
        if (!bar) return;

        const gs = GlobalStateManager.getInstance();
        const tableId = side === 'main' ? this.currentTableId : (this.header.personsSplitOpen ? 'tbl_people' : (this.header.inventorySplitOpen ? 'tbl_inventory' : 'default'));
        
        bar.state = gs.getGlobalFilterState(side, tableId);
        
        // Resolve schema for the current table
        let schema = [];
        let targetTableId = tableId;
        // Virtual IDs like 'all-spiele'
        if (tableId.startsWith('all-')) {
            const category = tableId.replace('all-', '');
            const found = Object.values(this.tables).find(t => t.config.category === category);
            if (found) targetTableId = found.config.id;
        }

        const tableWrap = this.tables[targetTableId];
        schema = tableWrap?.instance?.schema || tableWrap?.config?.schema || [];

        // Hardcoded localized types for specific columns if not in schema
        schema = schema.map(c => {
            let globalOptions = gs.getEnumOptionsForColumn(c.id, tableId);
            const isInventory = c.id === 'required_items' || c.id === 'benötigte_gegenstände' || c.label === 'Benötigte Gegenstände' || c.type === 'inventory';
            if (isInventory) {
                const inventory = gs.getInventory();
                globalOptions = inventory.map(i => ({ id: i.data?.name || i.name, label: i.data?.name || i.name }));
            }
            return {
                ...c,
                label: c.label || c.header || c.name || c.id,
                type: c.type || 'text',
                options: (c.options && c.options.length > 0) ? c.options : (globalOptions || [])
            };
        });

        // Gather consolidated rows for the global filter bar to enable faceted search
        let consolidatedRows = [];
        if (tableId === 'tbl_people') consolidatedRows = this.app.peopleData;
        else if (tableId === 'tbl_inventory') consolidatedRows = this.inventoryTable?.rows || [];
        else if (tableId.startsWith('all-')) {
            const category = tableId.replace('all-', '');
            // Only include tables in this category, and specifically exclude people from the Organisation all-view
            const configs = this.app.tableConfigs.filter(c => 
                c.category === category && !(category === 'organisation' && c.supa_table === 'people')
            );
            configs.forEach(config => {
                const tw = this.tables[config.id];
                if (tw && tw.instance) consolidatedRows.push(...tw.instance.rows);
            });
        }

        bar.updateSchema(schema);
        bar.updateRows(consolidatedRows); // DERIVE DYNAMIC OPTIONS
        bar.refresh();

    }

    async loadTables(tables, peopleData, preserveState = false) {
        const previousTableId = this.currentTableId;
        const previousSplitActive = this.splitActive;
        const previousSplitType = this.splitType;
        const previousFullView = this.fullView;

        this.tables = tables;
        this.header.tables = tables;
        this.globalState.setTables(tables);

        const fragment = document.createDocumentFragment();
        this.app.tableElements = {};

        if (tables['tbl_inventory']) {
            this.inventoryTable = tables['tbl_inventory'].instance;
            this.globalState.setInventory(tables['tbl_inventory'].instance.rows);
            // After setting inventory, we MUST refresh schemas of all tables that might have inventory filters
            Object.values(this.tables).forEach(tw => {
                if (tw.instance && tw.instance.renderer && tw.instance.renderer.filterBar) {
                    tw.instance.renderer.filterBar.refresh();
                }
            });
        }


        if (tables['tbl_events']) {
            this.calendarView = new CalendarView({ 
                eventsTable: tables['tbl_events'].instance,
                allTables: tables 
            });
            tables['tbl_events'].instance.onDataChange(() => this.calendarView.refresh());
            const wrapper = document.createElement('div');
            wrapper.className = 'table-view-wrapper calendar-view-wrapper';
            wrapper.dataset.tableId = 'calendar';
            wrapper.appendChild(this.calendarView.render());
            this.app.tableElements['calendar'] = wrapper;
            fragment.appendChild(wrapper);
            
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

                setTimeout(() => {
                    this._highlightRow(newRow.id);
                    const rowEl = document.querySelector(`tr[data-row-id="${newRow.id}"]`);
                    const nameCell = rowEl?.querySelector('[data-col-id="name"]');
                    nameCell?.click();
                }, 150);
            };

            this.calendarView.onGameClick = (name) => {
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
                const gs = GlobalStateManager.getInstance();
                const teams = gs.getAvailableTeams();
                let teamData = this._groupPeopleByTeam(peopleData, teams);
                
                const container = document.createElement('div');
                container.className = 'people-multi-table-container';
                
                this.personsTeamTables = {};
                
                // Unified Table: All persons grouped by Status
                const unifiedTable = new Table({
                    ...config,
                    id: 'tbl_people',
                    title: 'Alle Personen',
                    schema: config.schema,
                    rows: peopleData,
                    peopleData: peopleData,
                    sourceData: peopleData,
                    tableConfig: { 
                        ...config, 
                        id: 'tbl_people',
                        defaultRowData: { Status: 'Aktiv', role: 'User' } // Core defaults
                    },
                });
                this.personsUnifiedTable = unifiedTable;
                unifiedTable.localFilters.groupBy = 'Status';
                unifiedTable.onDataChange(() => this._refreshAllPeopleViews(peopleData));
                
                const unifiedEl = unifiedTable.render();
                unifiedEl.dataset.team = 'all';
                container.appendChild(unifiedEl);

                Object.entries(teamData).forEach(([teamName, rows]) => {
                    const table = new Table({
                        ...config,
                        id: 'tbl_people', 
                        title: `Team: ${teamName}`,
                        schema: config.schema,
                        rows: rows,
                        peopleData: peopleData,
                        sourceData: peopleData,
                        tableConfig: { 
                            ...config, 
                            id: 'tbl_people',
                            defaultRowData: { 
                                Team: teamName, 
                                Status: 'Aktiv', 
                                role: 'User' 
                            } 
                        },
                    });
                    
                    this.personsTeamTables[teamName] = table;
                    table.localFilters.groupBy = 'Status';
                    table.onDataChange(() => this._refreshAllPeopleViews(peopleData));
                    
                    const tableEl = table.render();
                    tableEl.dataset.team = teamName;
                    
                    if (rows.length === 0) {
                        tableEl.classList.add('collapsed');
                        const icon = tableEl.querySelector('.collapse-icon');
                        if (icon) icon.textContent = '▸';
                    }
                    
                    container.appendChild(tableEl);
                });
                
                wrapper.appendChild(container);
                tables[tableId].instances = [unifiedTable, ...Object.values(this.personsTeamTables)];
            } else {
                wrapper.appendChild(instance.render());
            }

            this.app.tableElements[tableId] = wrapper;
            fragment.appendChild(wrapper);
            renderedCount++;
        });

        if (renderedCount === 0) {
            const noAccess = document.createElement('div');
            noAccess.className = 'no-access-message';
            noAccess.innerHTML = `
                <div class="no-access-content">
                    <h2>Kein Zugriff</h2>
                    <p>Sie haben derzeit keine Berechtigung, Daten in diesem Bereich einzusehen.</p>
                </div>
            `;
            this.tablesContainer.replaceChildren(noAccess);
        } else {
            this.tablesContainer.replaceChildren(fragment);
        }
        this._initSplitViewTables(tables, peopleData);

        if (preserveState && previousTableId) {
            this.header.switchTo(previousTableId);
            this._handleTableSwitch(previousTableId);
            
            if (previousSplitActive) {
                if (previousSplitType === 'people') this._handlePersonsToggle();
                else if (previousSplitType === 'inventory') this._handleInventoryToggle();
                else if (previousSplitType === 'calendar') this._handleCalendarToggle();
                
                if (previousFullView && !this.fullView) {
                    this._toggleSplitFullView();
                }
            }
        }
    }

    showInitialView() {
        const gs = GlobalStateManager.getInstance();
        
        // SECURITY CHECK: If no items in header, show "No Access" screen
        if (!this.header.hasVisibleItems()) {
            this.mainContent.innerHTML = `
                <div class="no-access-screen anim-fade-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; text-align: center; color: var(--text-muted);">
                    <h2 style="color: var(--text-color); margin-bottom: 12px;">Kein Zugriff</h2>
                    <p style="max-width: 400px; line-height: 1.6;">Sie haben aktuell keine Berechtigungen für Team-Tabellen oder System-Funktionen. Bitte wenden Sie sich an einen Administrator.</p>
                </div>
            `;
            // Hide side containers if open
            if (this.resizer) this.resizer.style.display = 'none';
            if (this.splitSideWrapper) this.splitSideWrapper.style.display = 'none';
            return;
        }

        const teams = gs.getCurrentTeams() || [];
        let targetView = 'all-spiele'; // Default fallback

        if (teams.length > 0) {
            const teamNamesParsed = teams.map(t => t.toLowerCase());
            
            if (teamNamesParsed.some(t => t.includes('organisation'))) {
                targetView = 'all-organisation';
            } else if (teamNamesParsed.some(t => t.includes('sport'))) {
                targetView = 'all-sportarten';
            } else if (teamNamesParsed.some(t => t.includes('aktivität') || t.includes('activity') || t.includes('spiele'))) {
                targetView = 'all-spiele';
            }
        }

        this.header.switchTo(targetView);
        this._handleTableSwitch(targetView);
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.custom-dialog-overlay, .user-info-overlay, .blackjack-overlay, .picker-overlay').forEach(el => el.remove());
                if (this.header.personsSplitOpen) this._handlePersonsToggle();
                if (this.header.inventorySplitOpen) this._handleInventoryToggle();
                if (this.header.calendarSplitOpen) this._handleCalendarToggle();
                document.querySelectorAll('.expanded-row, .data-cell.expanded').forEach(el => el.classList.remove('expanded-row', 'expanded'));
            }
        });
        
        window.addEventListener('jump-to-game', (e) => {
            this._handleJumpToGame(e.detail.gameName);
        });

        this.globalState.onUnsavedChangeCallback((hasUnsaved) => {
            hasUnsaved ? this.header.showUnsavedBanner() : this.header.hideUnsavedBanner();
        });

        window.addEventListener('toggle-filter-bar', (e) => {
            const side = e.detail.side;
            const bar = side === 'split' ? this.filterBarSplit : this.filterBarMain;
            if (bar) {
                bar.state.active = !bar.state.active;
                bar.refresh();
                if (bar.state.active) this._populateFilterBar(side);
                this._updateAllTables(side);
            }
        });

        window.addEventListener('export-category-pdf', (e) => {
            this._exportCategoryPDF(e.detail.categoryId);
        });

        window.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-container.show').forEach(c => c.classList.remove('show'));
        });
    }

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
            schema: config.schema,
            rows,
            peopleData: this.app.peopleData,
            tableConfig: { ...config, defaultRowData },
        });
    }

    _groupPeopleByTeam(peopleData, teams) {
        const groups = { 'Unzugeordnet': [] };
        teams.forEach(t => groups[t.name] = []);
        
        peopleData.forEach(p => {
            const teamStr = p.Team || p.Teams || '';
            const pTeams = teamStr.split(',').map(s => s.trim()).filter(Boolean);
            
            if (pTeams.length === 0) {
                groups['Unzugeordnet'].push(p);
            } else {
                pTeams.forEach(tName => {
                    if (groups[tName]) groups[tName].push(p);
                    else {
                        // Handle teams that exist in data but not in availableTeams
                        if (!groups[tName]) groups[tName] = [];
                        groups[tName].push(p);
                    }
                });
            }
        });
        
        // Remove empty 'Unzugeordnet' if not needed
        if (groups['Unzugeordnet'].length === 0) delete groups['Unzugeordnet'];
        
        return groups;
    }

    _handlePersonTeamSplitSwitch(team) {
        // Ensure split view is open for persons
        if (!this.header.personsSplitOpen) {
            this._handlePersonsToggle();
        }
        
        // Filter the split container
        const updateContainer = (container) => {
            if (!container) return;
            const tables = container.querySelectorAll('.table-wrapper');
            tables.forEach(t => {
                const isMatch = (team === 'all' && t.dataset.team === 'all') || (t.dataset.team === team);
                t.style.display = isMatch ? 'block' : 'none';
            });
        };
        updateContainer(this.personsSplitElement);
    }

    _handlePersonTeamMainSwitch(team) {
        // Switch main view to people
        this.header.switchTo('tbl_people');
        this._handleTableSwitch('tbl_people');

        // Filter the main container
        const container = this.mainContent.querySelector('.people-multi-table-container');
        if (container) {
            const tables = container.querySelectorAll('.table-wrapper');
            tables.forEach(t => {
                const isMatch = (team === 'all' && t.dataset.team === 'all') || (t.dataset.team === team);
                t.style.display = isMatch ? 'block' : 'none';
            });
        }
        
        // Auto-close sidebar if it was showing the same thing
        if (this.header.personsSplitOpen) {
            this._handlePersonsToggle();
        }
    }

    _refreshAllPeopleViews(peopleData) {
        const gs = GlobalStateManager.getInstance();
        const teams = gs.getAvailableTeams();
        const teamGroups = this._groupPeopleByTeam(peopleData, teams);
        
        // Helper to convert raw data to Row objects compatible with the table
        const toRows = (rawRows, table) => {
            return rawRows.map(data => {
                const row = new Row({
                    id: data.id,
                    data: data,
                    schema: table.schema,
                    peopleData: peopleData,
                    tableId: table.id
                });
                // Attach the same callbacks as initial load
                row.setCallbacks({
                    onEditChange: () => table.editor.showUnsavedChange(),
                    onDelete:     (rowId) => table.dataManager.removeRow(rowId),
                    onSelect:     (rowId, s) => GlobalStateManager.getInstance().toggleRowSelection(table.id, rowId, s)
                });
                return row;
            });
        };

        // Update Main View Tables
        if (this.personsTeamTables) {
            Object.entries(this.personsTeamTables).forEach(([teamName, table]) => {
                const raw = teamGroups[teamName] || [];
                table.rows = toRows(raw, table);
                table.renderer?.update();
            });
        }
        
        // Update Split View Tables
        if (this.personsSplitTeamTables) {
            Object.entries(this.personsSplitTeamTables).forEach(([teamName, table]) => {
                const raw = teamGroups[teamName] || [];
                table.rows = toRows(raw, table);
                table.renderer?.update();
            });
        }

        // Update Unified View (Main and Split)
        if (this.personsUnifiedTable) {
            this.personsUnifiedTable.rows = toRows(peopleData, this.personsUnifiedTable);
            this.personsUnifiedTable.renderer?.update();
        }
        if (this.personsSplitUnifiedTable) {
            this.personsSplitUnifiedTable.rows = toRows(peopleData, this.personsSplitUnifiedTable);
            this.personsSplitUnifiedTable.renderer?.update();
        }
    }

    _initSplitViewTables(tables, peopleData) {
        const gs = GlobalStateManager.getInstance();
        
        if (tables['tbl_inventory'] && gs.canView('tbl_inventory')) {
            this.inventoryTable = tables['tbl_inventory'].instance;
        }

        if (peopleData.length > 0 && gs.canView('tbl_people')) {
            const gs = GlobalStateManager.getInstance();
            const teams = gs.getAvailableTeams();
            let teamData = this._groupPeopleByTeam(peopleData, teams);
            
            // DATA ISOLATION REMOVED - Everyone sees all teams

            const container = document.createElement('div');
            container.className = 'people-split-multi-container';
            
            this.personsSplitTeamTables = {};

            const peopleConfig = tables['tbl_people']?.config || { id: 'tbl_people', schema: [] };

            // Unified Table for Split View
            const unifiedTable = new Table({
                ...peopleConfig,
                id: 'tbl_people',
                title: 'Alle Personen',
                schema: peopleConfig.schema,
                rows: peopleData,
                peopleData: peopleData,
                sourceData: peopleData,
                tableConfig: { 
                    ...peopleConfig, 
                    id: 'tbl_people',
                    defaultRowData: { Status: 'Aktiv', role: 'User' }
                },
            });
            this.personsSplitUnifiedTable = unifiedTable;
            unifiedTable.localFilters.groupBy = 'Status';
            unifiedTable.onDataChange(() => this._refreshAllPeopleViews(peopleData));

            const unifiedEl = unifiedTable.render();
            unifiedEl.dataset.team = 'all';
            container.appendChild(unifiedEl);
            
            Object.entries(teamData).forEach(([teamName, rows]) => {
                const table = new Table({
                    id: 'tbl_people', 
                    title: `Team: ${teamName}`,
                    schema: peopleConfig.schema,
                    rows: rows,
                    peopleData: peopleData,
                    sourceData: peopleData,
                    tableConfig: { 
                        ...peopleConfig, 
                        id: `tbl_people`,
                        defaultRowData: { 
                            Team: teamName, 
                            Status: 'Aktiv', 
                            role: 'User' 
                        }
                    },
                });
                
                this.personsSplitTeamTables[teamName] = table;
                table.localFilters.groupBy = 'Status';
                
                table.onDataChange(() => this._refreshAllPeopleViews(peopleData));
                
                const tableEl = table.render();
                tableEl.dataset.team = teamName;
                
                if (rows.length === 0) {
                    tableEl.classList.add('collapsed');
                    const icon = tableEl.querySelector('.collapse-icon');
                    if (icon) icon.textContent = '▸';
                }
                
                container.appendChild(tableEl);
            });
            
            this.personsSplitElement = container;
        }
    }

    _renderGlobalBulkBar() {
        const bar = document.createElement('div');
        bar.className = 'bulk-actions-bar global-bulk-bar';
        bar.style.cssText = 'display:none; position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--bg); padding:12px 16px; border-radius:var(--radius); box-shadow:var(--shadow-lg); border:1px solid var(--border); z-index:1000; align-items:center; gap:8px; flex-wrap:wrap; max-width:90vw; animation: slideUp 0.3s ease-out;';
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
            .global-bulk-bar .bulk-actions-msg { color: var(--text-primary); font-weight: bold; margin-right: 8px; font-size: 13px; }
            .global-bulk-bar .nav-btn { background: var(--bg); border: 1px solid var(--border); padding: 6px 14px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 500; font-size: 12px; transition: background var(--transition); color: var(--text-secondary); }
            .global-bulk-bar .nav-btn:hover { background: var(--bg-secondary); }
            .global-bulk-bar .discard-btn-header { background: var(--bg); color: var(--error); border: 1px solid var(--border); }
            .global-bulk-bar .discard-btn-header:hover { background: var(--error-light); border-color: var(--error); }
        `;
        document.head.appendChild(style);

        const msg = document.createElement('span');
        msg.className = 'bulk-actions-msg';
        bar.appendChild(msg);


        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'nav-btn discard-btn-header';
        deleteBtn.textContent = 'Löschen';
        deleteBtn.onclick = async () => {
            const count = this.globalState.getTotalSelectedCount();
            if (await Dialog.confirm({ message: `${count} Einträge aus mehreren Tabellen löschen?`, confirmText: 'Löschen', confirmStyle: 'warning' })) {
                this._handleGlobalBulkDelete();
            }
        };
        bar.appendChild(deleteBtn);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'nav-btn';
        closeBtn.style.background = 'var(--bg-tertiary)';
        closeBtn.style.color = 'var(--text-muted)';
        closeBtn.textContent = 'Auswahl aufheben';
        closeBtn.onclick = () => {
            this.globalState.clearSelection();
            // Fast DOM cleanup: uncheck all checkboxes without full reload
            document.querySelectorAll('.bulk-checkbox, .bulk-col-header input').forEach(cb => {
                cb.checked = false;
            });
        };
        bar.appendChild(closeBtn);

        this.globalState.onSelectionChangeCallback((count) => {
            if (count > 0) {
                bar.style.display = 'flex';
                msg.textContent = `${count} ausgewählt`;
            } else {
                bar.style.display = 'none';
            }
        });

        return bar;
    }

    _handleGlobalBulkDelete() {
        const selected = this.globalState.getSelectedRows();
        const tables = this.globalState.getTables();
        
        for (const [tableId, rowIds] of selected) {
            const tableWrap = tables[tableId];
            if (tableWrap && tableWrap.instance) {
                for (const rowId of rowIds) {
                    tableWrap.instance.dataManager.removeRow(rowId);
                }
            }
        }
        this.globalState.clearSelection();
        this.reloadTables();
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
        GlobalStateManager.getInstance().setCurrentViewId(tableId);
        this.tablesContainer.style.display = 'flex';

        this._populateFilterBar('main');
        this._populateFilterBar('split');

        if (this.splitSideWrapper.classList.contains('full-view')) {
            this.splitSideWrapper.classList.remove('full-view');
            this.header.personsSplitOpen = false;
            this.header.inventorySplitOpen = false;
            this.header.calendarSplitOpen = false;
            this._updateSplitVisibility();
        }

        Object.entries(this.app.tableElements).forEach(([id, el]) => {
            if (tableId === 'all-spiele') {
                el.style.display = this.app.tableConfigs.find(c => c.id === id)?.category === 'spiele' ? 'block' : 'none';
            } else if (tableId === 'all-sportarten') {
                el.style.display = this.app.tableConfigs.find(c => c.id === id)?.category === 'sportarten' ? 'block' : 'none';
            } else if (tableId === 'all-organisation') {
                const config = this.app.tableConfigs.find(c => c.id === id);
                el.style.display = (config?.category === 'organisation' && config?.supa_table !== 'people') ? 'block' : 'none';
            } else if (tableId === 'tbl_people') {
                el.style.display = id === 'tbl_people' ? 'block' : 'none';
                if (id === 'tbl_people') {
                    // Default to showing only the unified table when manually switching
                    const container = el.querySelector('.people-multi-table-container');
                    if (container) {
                        const tables = container.querySelectorAll('.table-wrapper');
                        tables.forEach(t => {
                            t.style.display = t.dataset.team === 'all' ? 'block' : 'none';
                        });
                    }
                }
            } else {
                el.style.display = id === tableId ? 'block' : 'none';
            }
        });

        const headerEl = this.header.element;
        headerEl.querySelector('.persons-toggle-btn')?.classList.toggle('active', tableId === 'tbl_people' || this.header.personsSplitOpen);
        headerEl.querySelector('.inventory-toggle-btn')?.classList.toggle('active', tableId === 'tbl_inventory' || this.header.inventorySplitOpen);
        headerEl.querySelector('.calendar-toggle-btn')?.classList.toggle('active', tableId === 'calendar' || this.header.calendarSplitOpen);

        if (rowId) {
            this._highlightRow(rowId, colId);
        }
    }

    async _exportCategoryPDF(categoryId) {
        try {
            const usePortrait = ['all-people', 'all-inventory', 'all-stats'].includes(categoryId);
            const doc = usePortrait 
                ? new jsPDF({ orientation: 'portrait', format: 'a4' })
                : new jsPDF({ orientation: 'landscape', format: 'a3' });

            const ignoreCols = ['Erstellt von', 'Erstellt am', 'createdAt', 'createdBy', 'Link/Video/Lied'];
            let tablesToExport = [];
            let exportFileName = 'Export';

            if (categoryId === 'all-stats') {
                exportFileName = 'Stats_Report';
                await this._exportStatsPDF(doc, ignoreCols);
                window.open(doc.output('bloburl'), '_blank');
                return;
            } else if (categoryId === 'all-people') {
                exportFileName = 'Personen';
                const peopleWrap = this.tables['tbl_people'];
                if (peopleWrap && peopleWrap.instances) {
                    tablesToExport.push(...peopleWrap.instances);
                } else {
                    if (this.personsTable) tablesToExport.push(this.personsTable);
                    if (this.inactivePersonsTable) tablesToExport.push(this.inactivePersonsTable);
                }
            } else if (categoryId === 'all-inventory') {
                exportFileName = 'Inventar';
                const inv = this.tables['tbl_inventory'];
                if (inv && inv.instance) tablesToExport.push(inv.instance);
            } else {
                const categoryName = categoryId === 'all-spiele' ? 'Spiele' : 'Sportarten';
                exportFileName = categoryName;
                const configs = this.app.tableConfigs.filter(c => c.category === (categoryId === 'all-spiele' ? 'spiele' : 'sportarten'));
                configs.forEach(config => {
                    const tableWrap = this.tables[config.id];
                    if (tableWrap && tableWrap.instance) tablesToExport.push(tableWrap.instance);
                });
            }

            const gs = GlobalStateManager.getInstance();
            const globalFilter = gs.getGlobalFilterState('main', categoryId);

            const isFiltered = (globalFilter && globalFilter.active) || gs.isFavoritesFilterActive();

            if (isFiltered) {
                const proceed = await Dialog.confirm({
                    title: 'Export-Bestätigung',
                    message: 'Der Export beinhaltet nur die aktuell gefilterten Ergebnisse. Fortfahren?',
                    confirmText: 'Exportieren'
                });
                if (!proceed) return;
            }

            let currentY = 15;

            // Helper to load image as base64 for PDF
            const getBase64Image = async (imgUrl) => {
                if (!imgUrl) return null;
                try {
                    const isFull = imgUrl.includes('://') || imgUrl.startsWith('data:');
                    const fullUrl = isFull ? imgUrl : `https://kmsdsymoehleonxzcbnm.supabase.co/storage/v1/object/public/inventory_picture_bucket/${imgUrl}`;
                    const response = await fetch(fullUrl);
                    const blob = await response.blob();
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.warn('[PDF Export] Failed to fetch image:', imgUrl);
                    return null;
                }
            };

            // Render Global Filter Info at the very top
            if (isFiltered) {
                doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.setTextColor(100);
                let filterSummary = 'Aktive Filter: ';
                const criteria = [];
                if (gs.isFavoritesFilterActive()) criteria.push('Nur Favoriten');
                if (globalFilter && globalFilter.active) {
                    globalFilter.filters.forEach(f => {
                        if (f.attrId) {
                            const criteriaParts = [];
                            
                            // 1. Value filter
                            const val = Array.isArray(f.value) ? f.value.join(', ') : f.value;
                            if (val) criteriaParts.push(`${f.attrId} ${f.mode || 'ist'} ${val}`);
                            
                            // 2. Quantity filter
                            if (f.quantityMode && f.quantityMode !== 'any' && f.quantityValue) {
                                criteriaParts.push(`Anzahl ${f.quantityMode} ${f.quantityValue}`);
                            }
                            
                            // 3. Availability filter
                            if (Array.isArray(f.availability) && f.availability.length > 0) {
                                criteriaParts.push(`Verfügbarkeit: ${f.availability.join(', ')}`);
                            }

                            if (criteriaParts.length > 0) {
                                criteria.push(criteriaParts.join(' & '));
                            }
                        }
                    });
                }

                doc.text(filterSummary + criteria.join(' | '), 14, currentY);
                currentY += 12;
                doc.setTextColor(0);
            }

            for (const tableInstance of tablesToExport) {
                const pageHeight = doc.internal.pageSize.getHeight();
                if (currentY > pageHeight - 60) { doc.addPage(); currentY = 15; }
                
                doc.setFontSize(14); doc.setFont(undefined, 'bold');
                try { doc.text(tableInstance.title || '', 14, currentY); } catch(e){}
                doc.setFont(undefined, 'normal'); currentY += 6;

                // Render Local Filter Info for this specific table
                const localFilter = tableInstance.localFilters;
                if (localFilter && localFilter.active) {
                    doc.setFontSize(8); doc.setTextColor(120);
                    const localCriteria = [];
                    localFilter.filters.forEach(f => {
                        if (f.attrId) {
                            const p = [];
                            const val = Array.isArray(f.value) ? f.value.join(', ') : f.value;
                            if (val) p.push(`${f.attrId} ${f.mode || 'ist'} ${val}`);
                            if (f.quantityMode && f.quantityMode !== 'any' && f.quantityValue) p.push(`Anzahl ${f.quantityMode} ${f.quantityValue}`);
                            if (Array.isArray(f.availability) && f.availability.length > 0) p.push(`Verfügbarkeit: ${f.availability.join(', ')}`);
                            if (p.length > 0) localCriteria.push(p.join(' & '));
                        }
                    });
                    if (localCriteria.length > 0) {
                        doc.text(`Lokale Filter: ${localCriteria.join(' | ')}`, 14, currentY);
                        currentY += 6;
                    }
                    doc.setTextColor(0);
                }

                const isInventory = tableInstance.id === 'tbl_inventory';
                let exportSchema = tableInstance.schema.filter(col => {
                    if (ignoreCols.includes(col.label) || ignoreCols.includes(col.id)) return false;
                    return true;
                });

                // Ensure image_url is included for inventory
                if (isInventory && !exportSchema.find(c => c.id === 'image_url')) {
                    exportSchema.unshift({ id: 'image_url', label: 'Bild' });
                }

                const head = [exportSchema.map(col => col.id === 'image_url' ? 'Bild' : col.label)];

                // Filter rows for this specific table instance
                let rowsToExport = tableInstance.rows;
                if (gs.isFavoritesFilterActive()) rowsToExport = rowsToExport.filter(r => gs.isFavorite(r.id));
                if (globalFilter && globalFilter.active) {
                    rowsToExport = rowsToExport.filter(row => FilterEngine.matchesFilters(row, globalFilter.filters));
                }

                // Pre-load images if inventory
                const imageCache = {};
                if (isInventory) {
                    const imagePromises = rowsToExport.map(async (row) => {
                        const url = row.data.image_url;
                        if (url) {
                            const base64 = await getBase64Image(url);
                            if (base64) imageCache[row.id] = base64;
                        }
                    });
                    await Promise.all(imagePromises);
                }

                const body = rowsToExport.map(row => exportSchema.map(col => {
                    if (col.id === 'image_url') return ''; // Handled by didDrawCell
                    let val = row.data[col.id];
                    if (val === null || val === undefined) return '';
                    let strVal = typeof val === 'object' ? (Array.isArray(val) ? val.map(v => typeof v === 'object' ? v.name || v.id : v).join(', ') : (val.title || val.name || JSON.stringify(val))) : String(val);
                    return strVal.length > 250 ? strVal.substring(0, 247) + '...' : strVal;
                }));

            const imgColIdx = exportSchema.findIndex(c => c.id === 'image_url');

            autoTable(doc, { 
                head, 
                body, 
                startY: currentY, 
                styles: { 
                    fontSize: usePortrait ? 7 : 8, 
                    cellPadding: 2, 
                    overflow: 'linebreak', 
                    valign: 'middle',
                    minCellHeight: isInventory ? 30 : 0 
                }, 
                headStyles: { fillColor: ColourFactory.getBrandBlueRGB(), fontSize: usePortrait ? 8 : 9 }, 
                columnStyles: isInventory && imgColIdx !== -1 ? { [imgColIdx]: { cellWidth: 32 } } : {},
                margin: { left: 14, right: 14 },
                didDrawCell: (data) => {
                    if (isInventory && data.section === 'body' && data.column.index === imgColIdx) {
                        const rowId = rowsToExport[data.row.index].id;
                        const base64 = imageCache[rowId];
                        if (base64) {
                            doc.addImage(base64, 'JPEG', data.cell.x + 3.5, data.cell.y + 2.5, 25, 25);
                        }
                    }
                }
            });
                
                currentY = doc.lastAutoTable.finalY + 16;
            }

            if (tablesToExport.length > 0) window.open(doc.output('bloburl'), '_blank');
            else alert('Keine Tabellen zum Exportieren gefunden.');
        } catch (e) {
            console.error('PDF export failed', e);
            alert('Fehler beim PDF Export.');
        }
    }

    async _exportStatsPDF(doc, ignoreCols) {
        const allTables = this.tables;
        const peopleData = this.app.peopleData || [];
        let userStatsMap = {};
        try { userStatsMap = await UserStatsService.getStats(); } catch (e) { console.error('[Stats PDF] Failed to load user stats:', e); }

        let totalGames = 0, totalSports = 0;
        let totalEvents = allTables['tbl_events']?.instance?.rows.length || 0;
        let totalInventory = allTables['tbl_inventory']?.instance?.rows.length || 0;
        let activePeople = peopleData.filter(p => !p.Status || String(p.Status).toLowerCase() === 'aktiv').length;
        let inactivePeople = peopleData.filter(p => String(p.Status).toLowerCase() === 'inaktiv').length;
        let globalTodo = 0, globalInProgress = 0, globalDone = 0;

        const tableStats = [];
        Object.values(allTables).forEach(tWrap => {
            if (!tWrap.config || !tWrap.instance) return;
            const rows = tWrap.instance.rows;
            if (tWrap.config.category === 'spiele') totalGames += rows.length;
            if (tWrap.config.category === 'sportarten') totalSports += rows.length;
            rows.forEach(row => {
                const s = String(row.data.Status || row.data.status || '').toLowerCase().replace(/\s+/g, '-');
                if (s === 'to-do' || s === 'todo') globalTodo++;
                else if (s === 'in-progress') globalInProgress++;
                else if (s === 'done') globalDone++;
            });
        });

        let y = 20;
        doc.setFontSize(20); doc.setFont(undefined, 'bold'); doc.text('System-Stats Report', 14, y);
        doc.setFont(undefined, 'normal'); doc.setFontSize(10); doc.setTextColor(120); doc.text(`Generiert am ${new Date().toLocaleString('de-DE')}`, 14, y + 7);
        doc.setTextColor(0); y += 18;
        doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text('\u00dcbersicht', 14, y);
        y += 4;
        autoTable(doc, { head: [['Kennzahl', 'Wert']], body: [['Aktive Personen', String(activePeople)], ['Inaktive Personen', String(inactivePeople)], ['Spiele (Gesamt)', String(totalGames)], ['Sportarten (Gesamt)', String(totalSports)], ['Events', String(totalEvents)], ['Inventar', String(totalInventory)]], startY: y, styles: { fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: ColourFactory.getBrandBlueRGB() }, theme: 'grid', margin: { left: 14, right: 14 } });
        y = doc.lastAutoTable.finalY + 12;
        doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text('Aufgaben-Status', 14, y);
        y += 4;
        autoTable(doc, { head: [['Status', 'Gesamtzahl']], body: [['To-Do', String(globalTodo)], ['In Progress', String(globalInProgress)], ['Done', String(globalDone)]], startY: y, styles: { fontSize: 9 }, headStyles: { fillColor: ColourFactory.getBrandBlueRGB() }, theme: 'grid', margin: { left: 14, right: 14 } });
    }

    _highlightRow(rowId, colId) {
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

    _handleJumpToGame(gameName) {
        if (!gameName) return;
        const tables = this.globalState.getTables();
        for (const [id, tableInfo] of Object.entries(tables)) {
            if (tableInfo.config.category !== 'spiele') continue;
            const row = tableInfo.instance.rows.find(r => (r.data.name || '').toLowerCase() === gameName.toLowerCase());
            if (row) {
                document.querySelectorAll('.picker-overlay, .custom-dialog-overlay').forEach(el => el.remove());
                this._handleTableSwitch(id);
                this._highlightRow(row.id, 'name');
                break;
            }
        }
    }

    _handlePersonsToggle() {
        if (this.splitSideWrapper.classList.contains('full-view')) {
            this.splitSideWrapper.classList.remove('full-view');
            this.tablesContainer.style.display = 'flex';
        } else {
            this.header.personsSplitOpen = !this.header.personsSplitOpen;
            if (this.header.personsSplitOpen) { 
                this.header.inventorySplitOpen = false; 
                this.header.calendarSplitOpen = false;
                this._setSplitContent('people'); 
                // Default to unified view when toggled via main button
                if (this.personsSplitElement) {
                    this.personsSplitElement.querySelectorAll('.table-wrapper').forEach(t => {
                        t.style.display = t.dataset.team === 'all' ? 'block' : 'none';
                    });
                }
            }
        }
        this._updateSplitVisibility();
    }

    _handleInventoryToggle() {
        if (this.splitSideWrapper.classList.contains('full-view')) {
            this.splitSideWrapper.classList.remove('full-view');
            this.tablesContainer.style.display = 'flex';
        } else {
            this.header.inventorySplitOpen = !this.header.inventorySplitOpen;
            if (this.header.inventorySplitOpen) { this.header.personsSplitOpen = false; this._setSplitContent('inventory'); }
        }
        this._updateSplitVisibility();
    }

    _handleCalendarToggle() {
        if (this.splitSideWrapper.classList.contains('full-view')) {
            this.splitSideWrapper.classList.remove('full-view');
            this.tablesContainer.style.display = 'flex';
        } else {
            this.header.calendarSplitOpen = !this.header.calendarSplitOpen;
            if (this.header.calendarSplitOpen) { 
                this.header.personsSplitOpen = false; 
                this.header.inventorySplitOpen = false; 
                this._setSplitContent('calendar'); 
            }
        }
        this._updateSplitVisibility();
    }

    _handleCalendarFullView() {
        this.tablesContainer.style.display = 'none';
        this._setSplitContent('calendar');
        this.splitSideContainer.style.display = 'flex';
        this.resizer.style.display = 'none';
        this.splitSideContainer.classList.add('full-view');
        this.header.calendarSplitOpen = true; 
        this.header.personsSplitOpen = false; 
        this.header.inventorySplitOpen = false;
        this._updateSplitVisibility();
    }

    _updateSplitVisibility() {
        const isFull = this.splitSideWrapper.classList.contains('full-view');
        const open = this.header.personsSplitOpen || this.header.inventorySplitOpen || this.header.calendarSplitOpen;
        
        if (isFull) {
            this.mainContent.style.display = 'none';
            this.resizer.style.display = 'none';
            this.splitSideWrapper.style.display = 'flex';
            this.splitSideWrapper.style.flex = '1';
        } else {
            this.mainContent.style.display = 'flex';
            this.splitSideWrapper.style.display = open ? 'flex' : 'none';
            this.resizer.style.display = open ? 'block' : 'none';
            // Restore flex if needed
            if (!open) this.splitSideWrapper.style.flex = '';
        }

        const headerEl = this.header.element;
        headerEl.querySelector('.persons-toggle-btn')?.classList.toggle('active', this.header.personsSplitOpen);
        headerEl.querySelector('.inventory-toggle-btn')?.classList.toggle('active', this.header.inventorySplitOpen);
        headerEl.querySelector('.calendar-toggle-btn')?.classList.toggle('active', this.header.calendarSplitOpen);
    }

    _setSplitContent(type) {
        this.splitSideContainer.innerHTML = '';
        if (type !== 'calendar') {
            this._populateFilterBar('split');
        }
        
        if (type === 'people') {
            if (this.personsSplitElement) {
                this.splitSideContainer.appendChild(this.personsSplitElement);
            }
            return;
        }

        const table = type === 'inventory' ? this.inventoryTable : (type === 'calendar' ? this.calendarView : null);
        if (table) {
            this.splitSideContainer.appendChild(table.render());
        }
    }

    _handlePersonsFullView() {
        this._setSplitContent('people');
        // Show only unified table in full view
        if (this.personsSplitElement) {
            this.personsSplitElement.querySelectorAll('.table-wrapper').forEach(t => {
                t.style.display = t.dataset.team === 'all' ? 'block' : 'none';
            });
        }
        this.splitSideWrapper.classList.add('full-view');
        this.header.personsSplitOpen = true; 
        this.header.inventorySplitOpen = false;
        this.header.calendarSplitOpen = false;
        this._updateSplitVisibility();
    }

    _handleInventoryFullView() {
        this._setSplitContent('inventory');
        this.splitSideWrapper.classList.add('full-view');
        this.header.inventorySplitOpen = true; 
        this.header.personsSplitOpen = false;
        this.header.calendarSplitOpen = false;
        this._updateSplitVisibility();
    }

    _handleCalendarFullView() {
        this._setSplitContent('calendar');
        this.splitSideWrapper.classList.add('full-view');
        this.header.calendarSplitOpen = true; 
        this.header.personsSplitOpen = false; 
        this.header.inventorySplitOpen = false;
        this._updateSplitVisibility();
    }

    _handleFavoritesToggle(active) {
        this.globalState.setFavoritesFilterActive(active);
        document.body.classList.toggle('favorites-active', active);
    }

    _setupResizer() {
        this.resizer.addEventListener('mousedown', (e) => {
            const startX = e.clientX;
            const startWidth = this.splitSideWrapper.offsetWidth;
            const onMouseMove = (me) => {
                const deltaX = me.clientX - startX;
                const newWidth = Math.max(300, Math.min(window.innerWidth - 400, startWidth - deltaX));
                this.splitSideWrapper.style.flex = `0 0 ${newWidth}px`;
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
        if (!GlobalStateManager.getInstance().isSuperAdmin()) {
            alert('Nur SuperAdmins haben Zugriff auf das System-Dashboard.');
            return;
        }
        await UserInfoPage.show(this.app.peopleData, this.app.tableConfigs, this.tables);
    }

    async reloadTables() {
        this.tables = await TableLoader.loadAllTables(this.app.peopleData, this.app.tableConfigs);
        const fragment = document.createDocumentFragment();
        Object.entries(this.tables).forEach(([tableId, { instance }]) => {
            if (!this.globalState.canView(tableId)) return;
            const wrapper = document.createElement('div');
            wrapper.className = 'table-view-wrapper';
            wrapper.dataset.tableId = tableId;
            wrapper.appendChild(instance.render());
            this.app.tableElements[tableId] = wrapper;
            fragment.appendChild(wrapper);
        });
        this.tablesContainer.replaceChildren(fragment);
        this._initSplitViewTables(this.tables, this.app.peopleData);
    }
}
