import { Header } from '../ui/Header.js';
import { Table } from './Table.js';
import { Dialog } from '../ui/Dialog.js';
import { GlobalStateManager } from './GlobalStateManager.js';
import { UserInfoPage } from '../ui/UserInfoPage.js';
import { TableLoader } from './TableLoader.js';
import { CalendarView } from '../ui/CalendarView.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserStatsService } from '../services/UserStatsService.js';

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
        this.header.onEditModeToggle = (active) => {
            this.globalState.setEditModeActive(active);
            this.reloadTables();
            // Replacing the header in the DOM is a bit heavy, but Header.js is mostly static HTML
            // so we can just update its internal state or find the buttons.
            // For now, let's just reload the whole app state to be safe.
            window.location.reload(); 
        };
        this.header.onCalendarToggle = () => this._handleCalendarToggle();
        this.header.onCalendarFull = () => this._handleCalendarFullView();
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
        this.globalState.setTables(tables);

        if (tables['tbl_inventory']) {
            this.globalState.setInventory(tables['tbl_inventory'].instance.rows);
        }

        // Initialize Calendar
        if (tables['tbl_events']) {
            this.calendarView = new CalendarView({ 
                eventsTable: tables['tbl_events'].instance,
                allTables: tables 
            });
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
                // Remove all common overlays
                document.querySelectorAll('.custom-dialog-overlay, .permission-overlay, .user-info-overlay, .blackjack-overlay, .picker-overlay').forEach(el => el.remove());
                
                // Close split views
                if (this.header.personsSplitOpen) this._handlePersonsToggle();
                if (this.header.inventorySplitOpen) this._handleInventoryToggle();
                if (this.header.calendarSplitOpen) this._handleCalendarToggle();

                // Clear expanded table states
                document.querySelectorAll('.expanded-row, .data-cell.expanded').forEach(el => el.classList.remove('expanded-row', 'expanded'));
            }
        });
        
        window.addEventListener('jump-to-game', (e) => {
            this._handleJumpToGame(e.detail.gameName);
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
            const open = this.header.personsSplitOpen || this.header.inventorySplitOpen || this.header.calendarSplitOpen;
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

        // Manage Add Category button Visibility
        this._updateAddCategoryButton(tableId);

        if (rowId) {
            this._highlightRow(rowId, colId);
        }
    }

    _updateAddCategoryButton(tableId) {
        let btn = document.getElementById('add-category-footer-btn');
        const isEditMode = this.globalState.isEditModeActive();
        const isCollectiveView = (tableId === 'all-spiele' || tableId === 'all-sportarten');

        if (!btn && isEditMode && isCollectiveView) {
            btn = document.createElement('button');
            btn.id = 'add-category-footer-btn';
            btn.className = 'add-category-footer-btn';
            btn.innerHTML = `
                <div class="add-cat-plus">+</div>
                <div class="add-cat-text">Neue Kategorie hinzufügen...</div>
            `;
            btn.onclick = () => this._handleCreateNewCategory(tableId);
            this.tablesContainer.appendChild(btn);

            // Add CSS for this button dynamically if not in Table.css
            const style = document.createElement('style');
            style.textContent = `
                .add-category-footer-btn {
                    width: 100%;
                    padding: 24px;
                    background: var(--bg-secondary);
                    border: 2px dashed var(--warning);
                    border-radius: var(--radius);
                    color: var(--warning);
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-top: 24px;
                    margin-bottom: 48px;
                    transition: all 0.2s;
                }
                .add-category-footer-btn:hover {
                    background: var(--warning-light);
                    border-style: solid;
                }
                .add-cat-plus { font-size: 32px; font-weight: bold; }
                .add-cat-text { font-size: 14px; font-weight: 600; }
            `;
            document.head.appendChild(style);
        }

        if (btn) {
            btn.style.display = (isEditMode && isCollectiveView) ? 'flex' : 'none';
            if (isCollectiveView) {
                btn.querySelector('.add-cat-text').textContent = `Neue Kategorie in ${tableId === 'all-spiele' ? 'Spiele' : 'Sportarten'} hinzufügen...`;
            }
        }
    }

    async _handleCreateNewCategory(viewId) {
        const name = prompt(`Name der neuen Kategorie (z.B. New Category):`);
        if (!name || !name.trim()) return;

        try {
            const slug = name.toLowerCase().replace(/\s+/g, '_');
            const enumName = viewId === 'all-spiele' ? 'activity_category_enum' : 'sport_type_enum';
            
            // 1. Database level (Enum)
            await this.globalState.addEnumOption(enumName, slug);
            
            // 2. Client alert with JSON snippet
            const schemaSnippet = viewId === 'all-spiele' ? 'ACTIVITIES_SCHEMA' : 'SPORTS_SCHEMA';
            alert(`✅ Kategorie '${name}' in der DB erstellt!\n\nBitte füge dies zu tables.json hinzu:\n\n{ "id": "tbl_activities_${slug}", "title": "${name}", "category": "${viewId === 'all-spiele' ? 'spiele' : 'sportarten'}", "schema": ${schemaSnippet} }`);
            
            window.location.reload();
        } catch (err) {
            alert(`Fehler: ${err.message}`);
        }
    }

    async _exportCategoryPDF(categoryId) {
        try {
            // Portrait for people/inventory/stats, A3 landscape for game/sport tables
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
                doc.save(`Export_${exportFileName}.pdf`);
                return;
            } else if (categoryId === 'all-people') {
                exportFileName = 'Personen';
                if (this.personsTable) tablesToExport.push(this.personsTable);
                if (this.inactivePersonsTable) tablesToExport.push(this.inactivePersonsTable);
            } else if (categoryId === 'all-inventory') {
                exportFileName = 'Inventar';
                const inv = this.tables['tbl_inventory'];
                if (inv && inv.instance) tablesToExport.push(inv.instance);
            } else {
                const categoryName = categoryId === 'all-spiele' ? 'Spiele' : 'Sportarten';
                exportFileName = categoryName;
                const categoryFilter = categoryId === 'all-spiele' ? 'spiele' : 'sportarten';
                const configs = this.app.tableConfigs.filter(c => c.category === categoryFilter);
                configs.forEach(config => {
                    const tableWrap = this.tables[config.id];
                    if (tableWrap && tableWrap.instance) tablesToExport.push(tableWrap.instance);
                });
            }

            let currentY = 15;

            for (const tableInstance of tablesToExport) {
                const pageHeight = doc.internal.pageSize.getHeight();
                // If less than 60pt left, go to next page
                if (currentY > pageHeight - 60) {
                    doc.addPage();
                    currentY = 15;
                }

                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                try { doc.text(tableInstance.title || '', 14, currentY); } catch(e){}
                doc.setFont(undefined, 'normal');
                currentY += 6;

                const exportSchema = tableInstance.schema.filter(col => !ignoreCols.includes(col.label) && !ignoreCols.includes(col.id));
                const head = [exportSchema.map(col => col.label)];
                const body = tableInstance.rows.map(row => {
                    return exportSchema.map(col => {
                        let val = row.data[col.id];
                        if (val === null || val === undefined) return '';
                        let strVal = '';
                        if (typeof val === 'object') {
                            if (Array.isArray(val)) {
                                strVal = val.map(v => typeof v === 'object' ? v.name || v.id : v).join(', ');
                            } else if (val.title || val.name) {
                                strVal = val.title || val.name;
                            } else {
                                strVal = JSON.stringify(val);
                            }
                        } else {
                            strVal = String(val);
                        }
                        if (strVal.length > 250) return strVal.substring(0, 247) + '...';
                        return strVal;
                    });
                });

                autoTable(doc, {
                    head,
                    body,
                    startY: currentY,
                    styles: { 
                        fontSize: usePortrait ? 7 : 8, 
                        cellPadding: 2, 
                        overflow: 'linebreak',
                        valign: 'middle'
                    },
                    headStyles: { fillColor: [0, 132, 255], fontSize: usePortrait ? 8 : 9 },
                    margin: { left: 14, right: 14 }
                });

                currentY = doc.lastAutoTable.finalY + 16;
            }

            if (tablesToExport.length > 0) {
                doc.save(`Export_${exportFileName}.pdf`);
            } else {
                alert('Keine Tabellen zum Exportieren gefunden.');
            }
        } catch (e) {
            console.error('PDF export failed', e);
            alert('Fehler beim PDF Export.');
        }
    }

    async _exportStatsPDF(doc, ignoreCols) {
        const allTables = this.tables;
        const peopleData = this.app.peopleData || [];

        // Fetch user stats from DB
        let userStatsMap = {};
        try {
            userStatsMap = await UserStatsService.getStats();
        } catch (e) {
            console.error('[Stats PDF] Failed to load user stats:', e);
        }

        // Gather stats
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

            let todo = 0, inProg = 0, done = 0;
            rows.forEach(row => {
                const s = String(row.data.Status || row.data.status || '').toLowerCase().replace(/\s+/g, '-');
                if (s === 'to-do' || s === 'todo') { globalTodo++; todo++; }
                else if (s === 'in-progress') { globalInProgress++; inProg++; }
                else if (s === 'done') { globalDone++; done++; }
            });
            tableStats.push({ name: tWrap.instance.title || tWrap.config.title, count: rows.length, todo, inProg, done });
        });

        let y = 20;

        // Title
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('System-Stats Report', 14, y);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(120);
        doc.text(`Generiert am ${new Date().toLocaleString('de-DE')}`, 14, y + 7);
        doc.setTextColor(0);
        y += 18;

        // KPI overview table
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('\u00dcbersicht', 14, y);
        doc.setFont(undefined, 'normal');
        y += 4;

        autoTable(doc, {
            head: [['Kennzahl', 'Wert']],
            body: [
                ['Aktive Personen', String(activePeople)],
                ['Inaktive Personen', String(inactivePeople)],
                ['Spiele (Gesamt)', String(totalGames)],
                ['Sportarten (Gesamt)', String(totalSports)],
                ['Events', String(totalEvents)],
                ['Inventar', String(totalInventory)],
            ],
            startY: y,
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [0, 132, 255] },
            theme: 'grid',
            margin: { left: 14, right: 14 }
        });
        y = doc.lastAutoTable.finalY + 12;

        // Status summary
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Aufgaben-Status', 14, y);
        doc.setFont(undefined, 'normal');
        y += 4;

        autoTable(doc, {
            head: [['To Do', 'In Progress', 'Done']],
            body: [[String(globalTodo), String(globalInProgress), String(globalDone)]],
            startY: y,
            styles: { fontSize: 10, cellPadding: 4, halign: 'center', fontStyle: 'bold' },
            headStyles: { fillColor: [0, 132, 255] },
            theme: 'grid',
            margin: { left: 14, right: 14 }
        });
        y = doc.lastAutoTable.finalY + 12;

        // Per-table breakdown
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Eintr\u00e4ge pro Tabelle', 14, y);
        doc.setFont(undefined, 'normal');
        y += 4;

        autoTable(doc, {
            head: [['Tabelle', 'Eintr\u00e4ge', 'To Do', 'In Progress', 'Done']],
            body: tableStats.map(t => [t.name, String(t.count), String(t.todo), String(t.inProg), String(t.done)]),
            startY: y,
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [0, 132, 255] },
            theme: 'grid',
            margin: { left: 14, right: 14 }
        });
        y = doc.lastAutoTable.finalY + 16;

        // User data - all people with individual stats
        const pageHeight = doc.internal.pageSize.getHeight();
        if (y > pageHeight - 60) { doc.addPage(); y = 15; }

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Personen & Individuelle Stats', 14, y);
        doc.setFont(undefined, 'normal');
        y += 4;

        const peopleHead = [['Name', 'Rolle', 'Status', 'Team', 'Aktivit\u00e4t', 'Letzter Login', 'Eintr\u00e4ge', 'BJ Wins', 'BJ Losses', 'Winrate', 'Top Kategorie']];
        const peopleBody = peopleData.map(p => {
            const name = `${p.vorname || ''} ${p.nachname || ''}`.trim();
            const uStats = userStatsMap[name] || {};
            const lastLogin = uStats.lastLogin ? new Date(uStats.lastLogin).toLocaleDateString('de-DE') : '-';
            const totalGames = (uStats.wins || 0) + (uStats.losses || 0);
            const winRate = totalGames > 0 ? `${uStats.winRate || 0}%` : '-';
            return [
                name,
                p.role || '',
                p.Status || '',
                Array.isArray(p.Team) ? p.Team.join(', ') : (p.Team || ''),
                uStats.activityLevel || 'Idle',
                lastLogin,
                String(uStats.entryCount || 0),
                String(uStats.wins || 0),
                String(uStats.losses || 0),
                winRate,
                uStats.topCategory || '-'
            ];
        });

        autoTable(doc, {
            head: peopleHead,
            body: peopleBody,
            startY: y,
            styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
            headStyles: { fillColor: [0, 132, 255], fontSize: 7 },
            theme: 'grid',
            margin: { left: 14, right: 14 }
        });
    }

    _handleCalendarToggle() {
        if (this.splitSideContainer.classList.contains('full-view')) {
            this.splitSideContainer.classList.remove('full-view');
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

    _handleJumpToGame(gameName) {
        if (!gameName) return;
        
        // Find which table has this game
        const tables = this.globalState.getTables();
        let targetTableId = null;
        let targetRowId = null;

        for (const [id, tableInfo] of Object.entries(tables)) {
            if (tableInfo.config.category !== 'spiele') continue;
            const row = tableInfo.instance.rows.find(r => (r.data.name || '').toLowerCase() === gameName.toLowerCase());
            if (row) {
                targetTableId = id;
                targetRowId = row.id;
                break;
            }
        }

        if (targetTableId && targetRowId) {
            // Close any overlays
            document.querySelectorAll('.picker-overlay, .custom-dialog-overlay').forEach(el => el.remove());
            
            // Switch and highlight
            this._handleTableSwitch(targetTableId);
            this._highlightRow(targetRowId, 'name');
        }
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
        const open = this.header.personsSplitOpen || this.header.inventorySplitOpen || this.header.calendarSplitOpen;
        this.splitSideContainer.style.display = open ? 'flex' : 'none';
        this.resizer.style.display = open ? 'block' : 'none';

        this.header.element.querySelector('.persons-toggle-btn')?.classList.toggle('active', this.header.personsSplitOpen);
        this.header.element.querySelector('.inventory-toggle-btn')?.classList.toggle('active', this.header.inventorySplitOpen);
        this.header.element.querySelector('.calendar-toggle-btn')?.classList.toggle('active', this.header.calendarSplitOpen);
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
            const table = type === 'inventory' ? this.inventoryTable : (type === 'calendar' ? this.calendarView : this.personsTable);
            if (table) {
                const el = table.render();
                el.className = type === 'calendar' ? 'calendar-table-full' : 'persons-table-full';
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
        await UserInfoPage.show(this.app.peopleData, this.app.tableConfigs, this.tables);
        this.globalState.updatePermissionsFromStorage();
        await this.reloadTables();
        this._handleTableSwitch(this.currentTableId);
    }

    async reloadTables() {
        this.tables = await TableLoader.loadAllTables(this.app.peopleData, this.app.tableConfigs);
        this.header.tables = this.tables;
        this.globalState.setTables(this.tables);

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
