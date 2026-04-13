import '../styles/Table.css';
import '../styles/FilterBar.css';
import { GlobalStateManager } from './GlobalStateManager.js';
import { FilterEngine } from '../utils/FilterEngine.js';
import { Dialog } from '../ui/Dialog.js';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FilterBar } from '../ui/FilterBar.js';
import { ColourFactory } from '../utils/ColourFactory.js';

/**
 * TableRenderer - Handles rendering and updating the table UI
 */
export class TableRenderer {
    constructor(table) {
        this.table = table;
        this.element = null;
        this.filterBar = null;
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'table-wrapper';

        this.element.appendChild(this._renderHeader());
        
        // Local Filter Bar
        this.filterBar = new FilterBar({
            schema: this.table.schema,
            state: this.table.localFilters,
            tableId: this.table.id,
            onUpdate: () => this.update()
        });

        this.element.appendChild(this.filterBar.render());

        // Context menu on the filter bar itself
        this.filterBar.element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._showTableContextMenu(e);
        });

        this.element.appendChild(this._renderTableScroll());
        
        // Auto-collapse if empty
        if (this.table.rows.length === 0) {
            this.element.classList.add('collapsed');
        }

        return this.element;
    }


    update() {
        if (!this.element) return;
        this.updateMeta();
        
        const oldBody = this.element.querySelector('tbody');
        if (oldBody) {
            const newBody = this._renderTableBody();
            oldBody.replaceWith(newBody);
            
            // Auto-collapse / expand based on row count
            const hasRows = this.table.rows.length > 0;
            const icon = this.element.querySelector('.collapse-icon');
            
            if (!hasRows) {
                this.element.classList.add('collapsed');
                if (icon) icon.textContent = '▸';
            } else {
                // Only auto-expand if it was previously auto-collapsed (optional)
                // For now, let's just make it consistent
                this.updateMeta();
            }
        }
    }

    _renderHeader() {
        const header = document.createElement('div');
        header.className = 'table-top';
        header.style.cursor = 'pointer';
        header.title = 'Klicken zum Ein-/Ausklappen';

        const titleGroup = document.createElement('div');
        titleGroup.className = 'table-title-group';

        const icon = document.createElement('div');
        icon.className = 'collapse-icon';
        icon.textContent = '▼';

        const title = document.createElement('div');
        title.className = 'table-title';
        title.textContent = this.table.title;

        titleGroup.appendChild(icon);
        titleGroup.appendChild(title);

        // Rename Table Button removed (part of edit mode)

        const metaGroup = document.createElement('div');
        metaGroup.style.display = 'flex';
        metaGroup.style.alignItems = 'center';
        metaGroup.style.gap = '12px';

        const meta = document.createElement('span');
        meta.className = 'table-meta';
        meta.dataset.role = 'row-count';
        meta.textContent = `${this.table.rows.length} Zeilen`;
        metaGroup.appendChild(meta);

        // Add Column Button removed (part of edit mode)

        header.appendChild(titleGroup);
        header.appendChild(metaGroup);

        if (this.table.rows.length === 0) {
            icon.textContent = '▸';
        }

        header.addEventListener('click', () => {

            this.element.classList.toggle('collapsed');
            icon.innerHTML = this.element.classList.contains('collapsed') ? '▸' : '▾';
        });

        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._showTableContextMenu(e);
        });

        return header;
    }

    _showTableContextMenu(e) {
        const existingMenu = document.querySelector('.category-context-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'row-context-menu category-context-menu';
        menu.style.left = `${e.clientX}px`; menu.style.top = `${e.clientY}px`;
        menu.style.position = 'fixed'; menu.style.zIndex = '100000';

        const exportBtn = document.createElement('button');
        exportBtn.className = 'context-menu-item';
        exportBtn.textContent = 'Als PDF exportieren';
        exportBtn.onclick = () => { this._exportPDF(); menu.remove(); };
        menu.appendChild(exportBtn);

        const exportAllBtn = document.createElement('button');
        exportAllBtn.className = 'context-menu-item';
        exportAllBtn.textContent = 'Alle als PDF exportieren';
        exportAllBtn.style.fontStyle = 'italic';
        exportAllBtn.onclick = () => {
            const category = this.table.tableConfig?.category;
            let categoryId = category ? `all-${category}` : null;
            if (this.table.id === 'tbl_people' || this.table.id === 'people_table') categoryId = 'all-people';
            if (this.table.id === 'tbl_inventory') categoryId = 'all-inventory';
            
            if (categoryId) {
                window.dispatchEvent(new CustomEvent('export-category-pdf', { detail: { categoryId } }));
            }
            menu.remove();
        };
        menu.appendChild(exportAllBtn);

        const divider = document.createElement('div');
        divider.className = 'context-menu-divider';
        menu.appendChild(divider);

        const isSingleTableView = ['tbl_people', 'people_table', 'tbl_inventory'].includes(this.table.id);

        if (isSingleTableView) {
            const filterBtn = document.createElement('button');
            filterBtn.className = 'context-menu-item';
            filterBtn.textContent = this.table.localFilters.active ? 'Filter ausblenden' : 'Filter anzeigen';
            filterBtn.onclick = () => {
                this.table.localFilters.active = !this.table.localFilters.active;
                this.filterBar.refresh();
                menu.remove();
            };
            menu.appendChild(filterBtn);
        } else {
            const filterLocalBtn = document.createElement('button');
            filterLocalBtn.className = 'context-menu-item';
            filterLocalBtn.textContent = 'Filter für diese Tabelle';
            filterLocalBtn.onclick = () => {
                this.table.localFilters.active = !this.table.localFilters.active;
                this.filterBar.refresh();
                menu.remove();
            };
            menu.appendChild(filterLocalBtn);

            const filterAllBtn = document.createElement('button');
            filterAllBtn.className = 'context-menu-item';
            filterAllBtn.textContent = 'Filter für alle Tabellen';
            filterAllBtn.style.fontStyle = 'italic';
            filterAllBtn.onclick = () => {
                const isSplit = this.element.closest('.split-container-inner') !== null;
                const side = isSplit ? 'split' : 'main';
                window.dispatchEvent(new CustomEvent('toggle-filter-bar', { detail: { side } }));
                menu.remove();
            };
            menu.appendChild(filterAllBtn);
        }

        document.body.appendChild(menu);
        const closeMenu = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeMenu); } };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    _renderTableScroll() {
        const scroll = document.createElement('div');
        scroll.className = 'table-scroll';
        const table = document.createElement('table');
        table.className = 'data-table';
        table.appendChild(this._renderTableHead());
        table.appendChild(this._renderTableBody());
        scroll.appendChild(table);
        return scroll;
    }

    _renderTableHead() {
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');

        const chkTh = document.createElement('th');
        chkTh.className = 'bulk-col-header';
        chkTh.style.width = '40px';
        const chkAll = document.createElement('input');
        chkAll.type = 'checkbox';
        chkAll.onchange = (e) => {
            const isChecked = e.target.checked;
            const gs = GlobalStateManager.getInstance();
            this.element.querySelectorAll('tbody tr[data-row-id]').forEach(rowEl => {
                const cb = rowEl.querySelector('.bulk-checkbox');
                if (cb) {
                    cb.checked = isChecked;
                    gs.toggleRowSelection(this.table.id, rowEl.dataset.rowId, isChecked);
                }
            });
        };
        chkTh.appendChild(chkAll);
        tr.appendChild(chkTh);

        const favTh = document.createElement('th');
        favTh.className = 'favorite-col-header';
        favTh.textContent = '★';
        tr.appendChild(favTh);

        this.table.schema.forEach((col, index) => {
            if (col.hidden) return;
            const th = document.createElement('th');
            th.dataset.colId = col.id;
            th.dataset.type = col.type || 'text';
            th.onclick = () => this.table.sorter.sortBy(col.id, th);
            const content = document.createElement('div');
            content.className = 'th-content';
            const textSpan = document.createElement('span');
            textSpan.textContent = col.label;
            content.appendChild(textSpan);
            th.appendChild(content);

            // Column controls removed (part of edit mode)
            const resizer = document.createElement('div');
            resizer.className = 'col-resizer';
            this._setupColumnResizing(th, resizer);
            th.appendChild(resizer);
            tr.appendChild(th);
        });

        thead.appendChild(tr);
        return thead;
    }

    _moveColumn(index, delta) {
        const newIdx = index + delta;
        if (newIdx < 0 || newIdx >= this.table.schema.length) return;
        const item = this.table.schema.splice(index, 1)[0];
        this.table.schema.splice(newIdx, 0, item);
        this.render();
        GlobalStateManager.getInstance().saveTableConfigs();
    }

    _setupColumnResizing(th, resizer) {
        let x = 0; let w = 0;
        const mm = (e) => { const dx = e.clientX - x; th.style.width = `${w + dx}px`; th.style.minWidth = `${w + dx}px`; };
        const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); resizer.classList.remove('resizing'); };
        resizer.addEventListener('mousedown', (e) => { e.stopPropagation(); x = e.clientX; w = parseInt(window.getComputedStyle(th).width, 10); document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu); resizer.classList.add('resizing'); });
    }

    _renderTableBody() {
        const tbody = document.createElement('tbody');
        this.table._tbody = tbody;
        const gs = GlobalStateManager.getInstance();
        // 1. Resolve Filter State
        const side = this.element?.closest('.split-container-inner') ? 'split' : 'main';
        
        // Resolve the correct filter ID:
        // Priority 1: Check if there's a collective filter for this table's category (e.g., 'all-spiele')
        const category = this.table.tableConfig?.category;
        let globalFilterId = this.table.id;
        
        if (category) {
            const catId = `all-${category}`;
            const catFilter = gs.getGlobalFilterState(side, catId);
            if (catFilter && catFilter.active) {
                globalFilterId = catId;
            }
        }
        
        // Priority 2: Fallback to the explicit wrapper ID if no category match
        const viewWrapper = this.element?.closest('.table-view-wrapper');
        if (globalFilterId === this.table.id && viewWrapper && viewWrapper.dataset.tableId && viewWrapper.dataset.tableId.startsWith('all-')) {
            globalFilterId = viewWrapper.dataset.tableId;
        }

        const globalFilter = gs.getGlobalFilterState(side, globalFilterId);

        const localFilter = this.table.localFilters;

        // 2. Filter Rows (Hierarchical)
        let filteredRows = this.table.rows;
        
        // A) Apply Global Filter
        if (gs.isFavoritesFilterActive()) {
            filteredRows = filteredRows.filter(r => gs.isFavorite(r.id));
        }
        if (globalFilter.active) {
            filteredRows = filteredRows.filter(row => FilterEngine.matchesFilters(row, globalFilter.filters));
        }

        // B) Update Local Filter Bar context
        // We pass the full global filter object so the local bar can enforce Parent -> Child constraints.
        if (this.filterBar) {
            this.filterBar.updateRows(filteredRows, globalFilter);
        }




        // C) Apply Local Filter
        if (localFilter.active) {
            filteredRows = filteredRows.filter(row => FilterEngine.matchesFilters(row, localFilter.filters));
        }



        if (filteredRows.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="${this.table.schema.length + 2}" style="text-align:center; padding: 40px; color: var(--text-muted);">Keine Einträge gefunden</td>`;
            tbody.appendChild(tr);
            this._renderAddRowButton(tbody);
            return tbody;
        }

        // 2. Group Rows
        // Priority: local grouping (even if bar hidden), then global grouping if active
        let groupBy = localFilter.groupBy || (globalFilter.active ? globalFilter.groupBy : null);

        if (groupBy) {
            const groups = FilterEngine.groupRows(filteredRows, groupBy);
            const groupAttr = this.table.schema.find(s => s.id === groupBy);
            const attrLabel = groupAttr ? groupAttr.label : groupBy;

            Object.entries(groups).forEach(([groupName, rows]) => {
                // Render Group Header
                const gtr = document.createElement('tr');
                gtr.className = 'group-header-row';
                const gtd = document.createElement('td');
                gtd.className = 'group-header-cell';
                gtd.colSpan = this.table.schema.length + 2;

                gtd.innerHTML = `
                    <div class="group-header-content">
                        <span class="group-toggle-icon">▾</span>
                        <span class="group-attr-label">${attrLabel}</span>
                        <span class="group-name">${groupName}</span>
                        <span class="group-count">${rows.length}</span>
                    </div>
                `;

                // Click to collapse/expand the group
                const toggleGroup = (forceState = null) => {
                    const icon = gtd.querySelector('.group-toggle-icon');
                    const isCollapsed = forceState !== null ? forceState : gtr.classList.toggle('group-collapsed');
                    if (forceState !== null) gtr.classList.toggle('group-collapsed', isCollapsed);
                    
                    icon.textContent = isCollapsed ? '▸' : '▾';
                    // Toggle visibility of subsequent rows until next group header
                    let next = gtr.nextElementSibling;
                    while (next && !next.classList.contains('group-header-row') && !next.classList.contains('add-row-tr')) {
                        next.style.display = isCollapsed ? 'none' : '';
                        next = next.nextElementSibling;
                    }
                };

                gtd.addEventListener('click', () => toggleGroup());

                gtr.appendChild(gtd);
                tbody.appendChild(gtr);

                // Initial State: Collapse specific groups by default
                const shouldCollapse = groupName.toLowerCase() === 'inaktiv';
                if (shouldCollapse) {
                    gtr.classList.add('group-collapsed');
                    gtd.querySelector('.group-toggle-icon').textContent = '▸';
                }

                // Render Rows for this group
                rows.forEach(row => {
                    this._setupRowCallbacks(row);
                    const rowEl = row.render();
                    if (shouldCollapse) rowEl.style.display = 'none';
                    tbody.appendChild(rowEl);
                });
            });
        } else {
            // No grouping
            filteredRows.forEach(row => {
                this._setupRowCallbacks(row);
                tbody.appendChild(row.render());
            });
        }

        this._renderAddRowButton(tbody);
        return tbody;
    }

    _setupRowCallbacks(row) {
        row.setCallbacks({
            onEditChange: () => this.table.editor.showUnsavedChange(),
            onDelete:     (rowId) => this.table.dataManager.removeRow(rowId),
            onSelect:     (rowId, s) => GlobalStateManager.getInstance().toggleRowSelection(this.table.id, rowId, s)
        });
    }


    _renderAddRowButton(tbody) {
        if (!GlobalStateManager.getInstance().canEdit(this.table.id)) return;
        const tr = document.createElement('tr');
        tr.className = 'add-row-tr';
        const td = document.createElement('td');
        td.colSpan = this.table.schema.length + 2;
        td.className = 'add-row-cell';
        const btn = document.createElement('button');
        btn.className = 'add-row-btn';
        btn.textContent = 'Zeile hinzufügen';
        btn.onclick = () => this.table.dataManager.addEmptyRow();
        td.appendChild(btn);
        tr.appendChild(td);
        tbody.appendChild(tr);
    }

    updateMeta() {
        const meta = this.element?.querySelector('[data-role="row-count"]');
        if (meta) meta.textContent = `${this.table.rows.length} Zeilen`;
    }

    async _exportPDF() {
        try {
            const gs = GlobalStateManager.getInstance();

            const side = this.element?.closest('.split-container-inner') ? 'split' : 'main';
            
            // Resolve Filter State (Global + Local)
            const category = this.table.tableConfig?.category;
            let globalFilterId = this.table.id;
            if (category) {
                const catId = `all-${category}`;
                const catFilter = gs.getGlobalFilterState(side, catId);
                if (catFilter && catFilter.active) globalFilterId = catId;
            }
            const viewWrapper = this.element?.closest('.table-view-wrapper');
            if (globalFilterId === this.table.id && viewWrapper && viewWrapper.dataset.tableId && viewWrapper.dataset.tableId.startsWith('all-')) {
                globalFilterId = viewWrapper.dataset.tableId;
            }

            const globalFilter = gs.getGlobalFilterState(side, globalFilterId);
            const localFilter = this.table.localFilters;

            const isFiltered = (globalFilter && globalFilter.active) || (localFilter && localFilter.active) || gs.isFavoritesFilterActive();

            if (isFiltered) {
                const proceed = await Dialog.confirm({
                    title: 'Export-Bestätigung',
                    message: 'Der Export beinhaltet nur die aktuell gefilterten Ergebnisse. Fortfahren?',
                    confirmText: 'Exportieren'
                });
                if (!proceed) return;
            }

            const isPortrait = ['tbl_inventory', 'tbl_people', 'people_table'].includes(this.table.id);
            const doc = isPortrait 
                ? new jsPDF({ orientation: 'portrait', format: 'a4' })
                : new jsPDF({ orientation: 'landscape', format: 'a3' });
            let currentY = 20;
            
            doc.setFontSize(18); doc.setFont(undefined, 'bold');
            doc.text(this.table.title || 'Export', 14, currentY);
            currentY += 8;

            // Render Filter Info in Header
            if (isFiltered) {
                doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(100);
                let filterText = 'Aktive Filter: ';
                const activeCriteria = [];
                
                if (gs.isFavoritesFilterActive()) activeCriteria.push('Nur Favoriten');
                
                if (globalFilter.active) {
                    globalFilter.filters.forEach(f => {
                        if (f.attrId) {
                            const p = [];
                            const val = Array.isArray(f.value) ? f.value.join(', ') : f.value;
                            if (val) p.push(`${f.attrId} ${f.mode || 'ist'} ${val}`);
                            if (f.quantityMode && f.quantityMode !== 'any' && f.quantityValue) p.push(`Anzahl ${f.quantityMode} ${f.quantityValue}`);
                            if (Array.isArray(f.availability) && f.availability.length > 0) p.push(`Verfügbarkeit: ${f.availability.join(', ')}`);
                            if (p.length > 0) activeCriteria.push(`[Global] ${p.join(' & ')}`);
                        }
                    });
                }
                
                if (localFilter.active) {
                    localFilter.filters.forEach(f => {
                        if (f.attrId) {
                            const p = [];
                            const val = Array.isArray(f.value) ? f.value.join(', ') : f.value;
                            if (val) p.push(`${f.attrId} ${f.mode || 'ist'} ${val}`);
                            if (f.quantityMode && f.quantityMode !== 'any' && f.quantityValue) p.push(`Anzahl ${f.quantityMode} ${f.quantityValue}`);
                            if (Array.isArray(f.availability) && f.availability.length > 0) p.push(`Verfügbarkeit: ${f.availability.join(', ')}`);
                            if (p.length > 0) activeCriteria.push(`[Lokal] ${p.join(' & ')}`);
                        }
                    });
                }

                
                doc.text(filterText + activeCriteria.join(' | '), 14, currentY);
                currentY += 10;
                doc.setTextColor(0);
            } else {
                currentY += 2;
            }

            const ignore = ['Erstellt von', 'Erstellt am', 'createdAt', 'createdBy', 'Link/Video/Lied'];
            const schema = this.table.schema.filter(c => !ignore.includes(c.label) && !ignore.includes(c.id));
            const head = [schema.map(c => c.label)];

            // Filter Rows logic
            let filteredRows = this.table.rows;
            if (gs.isFavoritesFilterActive()) filteredRows = filteredRows.filter(r => gs.isFavorite(r.id));
            if (globalFilter.active) filteredRows = filteredRows.filter(row => FilterEngine.matchesFilters(row, globalFilter.filters));
            if (localFilter.active) filteredRows = filteredRows.filter(row => FilterEngine.matchesFilters(row, localFilter.filters));

            const body = filteredRows.map(row => schema.map(c => {
                let v = row.data[c.id]; if (v === null || v === undefined) return '';
                let s = typeof v === 'object' ? (Array.isArray(v) ? v.map(i => typeof i === 'object' ? i.name || i.id : i).join(', ') : (v.title || v.name || JSON.stringify(v))) : String(v);
                return s.length > 250 ? s.substring(0, 247) + '...' : s;
            }));

            autoTable(doc, { 
                head, 
                body, 
                startY: currentY, 
                styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' }, 
                headStyles: { fillColor: ColourFactory.getBrandBlueRGB() } 
            });
            
            window.open(doc.output('bloburl'), '_blank');
        } catch (e) {
            console.error('PDF export failed', e);
            alert('Fehler beim PDF Export: ' + e.message);
        }
    }
}
