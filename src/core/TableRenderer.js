import '../styles/Table.css';
import { GlobalStateManager } from './GlobalStateManager.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * TableRenderer - Handles rendering and updating the table UI
 */
export class TableRenderer {
    constructor(table) {
        this.table = table;
        this.element = null;
        this.selectedRows = new Set();
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'table-wrapper';

        this.element.appendChild(this._renderHeader());
        this.element.appendChild(this._renderTableScroll());
        
        this.bulkBar = this._renderBulkActionsBar();
        this.element.appendChild(this.bulkBar);

        return this.element;
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

        // Edit Mode: Rename Table Button
        if (GlobalStateManager.getInstance().isEditModeActive()) {
            const renameBtn = document.createElement('div');
            renameBtn.className = 'table-title-edit-btn';
            renameBtn.innerHTML = '✎';
            renameBtn.title = 'Tabelle umbenennen';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                const newTitle = prompt('Neuer Tabellentitel:', this.table.title);
                if (newTitle && newTitle.trim()) {
                    this.table.title = newTitle.trim();
                    title.textContent = newTitle.trim();
                    GlobalStateManager.getInstance().saveTableConfigs();
                }
            };
            titleGroup.appendChild(renameBtn);
        }

        const metaGroup = document.createElement('div');
        metaGroup.style.display = 'flex';
        metaGroup.style.alignItems = 'center';
        metaGroup.style.gap = '12px';

        const meta = document.createElement('span');
        meta.className = 'table-meta';
        meta.dataset.role = 'row-count';
        meta.textContent = `${this.table.rows.length} Zeilen`;
        metaGroup.appendChild(meta);

        const exportBtn = document.createElement('button');
        exportBtn.className = 'header-btn';
        exportBtn.innerHTML = '📄 PDF';
        exportBtn.title = 'Tabelle als PDF exportieren';
        exportBtn.style.padding = '4px 12px';
        exportBtn.style.borderRadius = 'var(--radius)';
        exportBtn.style.border = '1px solid var(--border-light)';
        exportBtn.style.background = 'var(--bg-secondary)';
        exportBtn.style.color = 'var(--text-primary)';
        exportBtn.style.cursor = 'pointer';
        exportBtn.style.fontSize = '12px';
        exportBtn.style.fontWeight = '600';
        exportBtn.onmouseover = () => { exportBtn.style.background = 'var(--hover)'; };
        exportBtn.onmouseout = () => { exportBtn.style.background = 'var(--bg-secondary)'; };
        exportBtn.onclick = (e) => { 
            e.stopPropagation(); 
            this._exportPDF();
        };
        metaGroup.appendChild(exportBtn);

        // Edit Mode: Add Column Button next to row count
        if (GlobalStateManager.getInstance().isEditModeActive()) {
            const addColBtn = document.createElement('button');
            addColBtn.className = 'edit-mode-action-btn';
            addColBtn.innerHTML = '+ Spalte hinzufügen';
            addColBtn.onclick = async (e) => {
                e.stopPropagation();
                const gs = GlobalStateManager.getInstance();
                const { Dialog } = await import('../ui/Dialog.js');

                // Fetch enums from GS
                const enums = Object.keys(gs.getEnums());

                const res = await Dialog.showAddColumnDialog(this.table.id, enums);
                if (res) {
                    try {
                        await gs.addColumn(this.table.id, res);
                    } catch (err) {
                        // GS handles flash
                    }
                }
            };
            metaGroup.appendChild(addColBtn);
        }

        header.appendChild(titleGroup);
        header.appendChild(metaGroup);

        header.addEventListener('click', () => {
            this.element.classList.toggle('collapsed');
            icon.innerHTML = this.element.classList.contains('collapsed') ? '▸' : '▾';
        });

        return header;
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

        // Checkbox column header
        const chkTh = document.createElement('th');
        chkTh.className = 'bulk-col-header';
        chkTh.style.width = '40px';
        chkTh.style.minWidth = '40px';
        const chkAll = document.createElement('input');
        chkAll.type = 'checkbox';
        chkAll.title = 'Alle auswählen';
        chkAll.onchange = (e) => {
            const isChecked = e.target.checked;
            this.selectedRows.clear();
            const rowEls = this.element.querySelectorAll('tbody tr[data-row-id]');
            rowEls.forEach(rowEl => {
                const cb = rowEl.querySelector('.bulk-checkbox');
                if (cb) {
                    cb.checked = isChecked;
                    if (isChecked) this.selectedRows.add(rowEl.dataset.rowId);
                }
            });
            this._updateBulkBarVisibility();
        };
        chkTh.appendChild(chkAll);
        tr.appendChild(chkTh);

        // Favorite column header
        const favTh = document.createElement('th');
        favTh.className = 'favorite-col-header';
        favTh.textContent = '★';
        favTh.title = 'Favoriten';
        tr.appendChild(favTh);

        // Column headers
        this.table.schema.forEach((col, index) => {
            const th = document.createElement('th');
            th.dataset.colId = col.id;
            th.onclick = () => this.table.sorter.sortBy(col.id, th);

            const content = document.createElement('div');
            content.className = 'th-content';
            const textSpan = document.createElement('span');
            textSpan.textContent = col.label;
            content.appendChild(textSpan);
            th.appendChild(content);

            // Edit Mode: Add Rearrange controls
            if (GlobalStateManager.getInstance().isEditModeActive()) {
                const controls = document.createElement('div');
                controls.className = 'col-edit-controls';
                controls.style.display = 'flex';
                controls.style.gap = '4px';
                controls.style.marginTop = '4px';

                const leftBtn = document.createElement('button');
                leftBtn.textContent = '←';
                leftBtn.className = 'col-nav-btn';
                leftBtn.onclick = (e) => {
                    e.stopPropagation();
                    this._moveColumn(index, -1);
                };

                const renameBtn = document.createElement('button');
                renameBtn.textContent = '✎';
                renameBtn.className = 'col-nav-btn';
                renameBtn.title = 'Spalte umbenennen';
                renameBtn.onclick = (e) => {
                    e.stopPropagation();
                    const newLabel = prompt(`Neue Beschriftung für '${col.label}':`, col.label);
                    if (newLabel && newLabel.trim()) {
                        col.label = newLabel.trim();
                        this.render();
                        GlobalStateManager.getInstance().saveTableConfigs();
                    }
                };

                const rightBtn = document.createElement('button');
                rightBtn.textContent = '→';
                rightBtn.className = 'col-nav-btn';
                rightBtn.onclick = (e) => {
                    e.stopPropagation();
                    this._moveColumn(index, 1);
                };

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '✖';
                deleteBtn.className = 'col-nav-btn col-delete-btn';
                deleteBtn.title = 'Spalte löschen';
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    const { Dialog } = await import('../ui/Dialog.js');
                    const ok = await Dialog.confirm({
                        message: `Möchtest du die Spalte '${col.label}' wirklich löschen? Alle Daten in dieser Spalte gehen verloren!`,
                        confirmText: 'Löschen',
                        confirmStyle: 'warning'
                    });
                    if (ok) {
                        try {
                            const gs = GlobalStateManager.getInstance();
                            await gs.removeColumn(this.table.id, col.id);
                        } catch (err) {
                            // Flash handled by GS
                        }
                    }
                };

                controls.appendChild(leftBtn);
                controls.appendChild(renameBtn);
                controls.appendChild(rightBtn);
                controls.appendChild(deleteBtn);
                th.appendChild(controls);
            }

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

        const schema = this.table.schema;
        const item = schema.splice(index, 1)[0];
        schema.splice(newIdx, 0, item);

        // UI Refresh
        this.render();
        GlobalStateManager.getInstance().saveTableConfigs();
    }

    _setupColumnResizing(th, resizer) {
        let x = 0;
        let w = 0;

        const onMouseMove = (e) => {
            const dx = e.clientX - x;
            th.style.width = `${w + dx}px`;
            th.style.minWidth = `${w + dx}px`; // Ensure it stays that way
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            resizer.classList.remove('resizing');
        };

        resizer.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            x = e.clientX;
            w = parseInt(window.getComputedStyle(th).width, 10);

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            resizer.classList.add('resizing');
        });

        // Double click to auto-size
        resizer.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this._autoSizeColumn(th);
        });
    }

    _autoSizeAllColumns() {
        const headers = this.element.querySelectorAll('th');
        headers.forEach(th => this._autoSizeColumn(th));
    }

    _autoSizeColumn(th) {
        const colId = th.dataset.colId;
        if (!colId) return;
        const colDef = this.table.schema.find(c => c.id === colId);
        const table = this.element.querySelector('.data-table');
        const cells = table.querySelectorAll(`td[data-col-id="${colId}"] .cell-content`);

        // Determine cap based on content type
        const isLongText = ['rules', 'short_description', 'team_tasks', 'rules', 'Spez. Zuständigkeit'].includes(colId) || colDef?.type === 'text';
        const maxWidthCap = isLongText ? 400 : 600;

        let maxWidth = 80;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const headerFont = window.getComputedStyle(th).font;
        context.font = headerFont;

        // Measure header
        const headerWidth = context.measureText(th.textContent).width + 50;
        maxWidth = Math.max(maxWidth, headerWidth);

        // Measure cells
        cells.forEach(cell => {
            const text = cell.textContent;
            context.font = window.getComputedStyle(cell).font;
            const textWidth = context.measureText(text).width + 40;
            maxWidth = Math.max(maxWidth, textWidth);
        });

        const finalWidth = Math.min(maxWidthCap, maxWidth);
        th.style.width = `${finalWidth}px`;
        th.style.minWidth = `${finalWidth}px`;
    }

    _renderTableBody() {
        const tbody = document.createElement('tbody');
        this.table._tbody = tbody;

        if (this.table.rows.length === 0) {
            this._renderEmptyState(tbody);
        } else {
            this._renderRows(tbody);
        }

        this._renderAddRowButton(tbody);

        // Auto-size columns after body is populated
        setTimeout(() => this._autoSizeAllColumns(), 0);

        return tbody;
    }

    _renderEmptyState(tbody) {
        const tr = document.createElement('tr');
        tr.setAttribute('role', 'row');

        const td = document.createElement('td');
        td.colSpan = this.table.schema.length + 2;
        td.className = 'empty-row';
        td.setAttribute('role', 'cell');
        td.textContent = 'Keine Einträge vorhanden';

        tr.appendChild(td);
        tbody.appendChild(tr);
    }

    _renderRows(tbody) {
        this.table.rows.forEach(row => {
            row.setCallbacks({
                onEditChange: () => this.table.editor.showUnsavedChange(),
                onDelete:     (rowId) => this.table.dataManager.removeRow(rowId),
                onSelect:     (rowId, selected) => {
                    if (selected) this.selectedRows.add(rowId);
                    else this.selectedRows.delete(rowId);
                    this._updateBulkBarVisibility();
                }
            });

            const rowEl = row.render();
            rowEl.setAttribute('role', 'row');
            tbody.appendChild(rowEl);
        });
    }

    _renderAddRowButton(tbody) {
        if (!GlobalStateManager.getInstance().canEdit(this.table.id)) {
            return;
        }

        const tr = document.createElement('tr');
        tr.className = 'add-row-tr';
        tr.setAttribute('role', 'row');

        const td = document.createElement('td');
        td.colSpan = this.table.schema.length + 3;
        td.className = 'add-row-cell';
        td.setAttribute('role', 'cell');

        const btn = document.createElement('button');
        btn.className = 'add-row-btn';
        btn.textContent = 'Zeile hinzufügen';
        btn.addEventListener('click', () => this.table.dataManager.addEmptyRow());

        td.appendChild(btn);
        tr.appendChild(td);
        tbody.appendChild(tr);
    }

    updateMeta() {
        const meta = this.element?.querySelector('[data-role="row-count"]');
        if (meta) {
            meta.textContent = `${this.table.rows.length} Zeilen`;
        }
        
        // Remove deleted rows from selection
        const existingRowIds = new Set(this.table.rows.map(r => r.id));
        for (const id of this.selectedRows) {
            if (!existingRowIds.has(id)) {
                this.selectedRows.delete(id);
            }
        }
        this._updateBulkBarVisibility();
    }

    reRenderBody() {
        const tbody = this.element?.querySelector('tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (this.table.rows.length === 0) {
            this._renderEmptyState(tbody);
        } else {
            this._renderRows(tbody);
        }

        this._renderAddRowButton(tbody);
        
        // Restore checkmarks if row still selected
        const rowEls = tbody.querySelectorAll('tr[data-row-id]');
        rowEls.forEach(el => {
            if (this.selectedRows.has(el.dataset.rowId)) {
                const cb = el.querySelector('.bulk-checkbox');
                if (cb) cb.checked = true;
            }
        });
        
        // Uncheck 'Select All' header if body refreshed and not all are checked
        if (this.selectedRows.size === 0) {
           const chkAll = this.element?.querySelector('.bulk-col-header input[type="checkbox"]');
           if (chkAll) chkAll.checked = false;
        }
    }



    async _exportPDF() {
        try {
            const doc = new jsPDF({ orientation: 'landscape', format: 'a3' });
            doc.setFontSize(18);
            doc.text(this.table.title || 'Export', 14, 20);

            const ignoreCols = ['Erstellt von', 'Erstellt am', 'createdAt', 'createdBy', 'Link/Video/Lied'];
            const exportSchema = this.table.schema.filter(col => !ignoreCols.includes(col.label) && !ignoreCols.includes(col.id));

            const head = [exportSchema.map(col => col.label)];
            const body = this.table.rows.map(row => {
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

                    if (strVal.length > 250) {
                        return strVal.substring(0, 247) + '...';
                    }
                    return strVal;
                });
            });

            autoTable(doc, {
                head,
                body,
                startY: 28,
                styles: { 
                    fontSize: 8, 
                    cellPadding: 3, 
                    overflow: 'linebreak',
                    valign: 'middle'
                },
                headStyles: { fillColor: [0, 132, 255], fontSize: 9 }
            });

            doc.save(`${this.table.title || 'export'}.pdf`);
        } catch (e) {
            console.error('PDF export failed', e);
            alert('Fehler beim PDF Export. Bitte versuche es erneut.');
        }
    }
    
    _renderBulkActionsBar() {
        const bar = document.createElement('div');
        bar.className = 'bulk-actions-bar';
        bar.style.display = 'none';
        bar.style.position = 'fixed';
        bar.style.bottom = '20px';
        bar.style.left = '50%';
        bar.style.transform = 'translateX(-50%)';
        bar.style.background = 'var(--bg)';
        bar.style.padding = '12px 24px';
        bar.style.borderRadius = 'var(--radius)';
        bar.style.boxShadow = 'var(--shadow-lg)';
        bar.style.border = '1px solid var(--border)';
        bar.style.zIndex = '1000';
        bar.style.alignItems = 'center';
        bar.style.gap = '16px';
        bar.style.color = 'var(--text-primary)';
        
        const msg = document.createElement('span');
        msg.className = 'bulk-actions-msg';
        msg.style.fontWeight = '600';
        bar.appendChild(msg);
        
        // Let's add a bulk field selector
        const actionGroup = document.createElement('div');
        actionGroup.style.display = 'flex';
        actionGroup.style.gap = '8px';
        
        const applyBtn = document.createElement('button');
        applyBtn.className = 'header-btn';
        applyBtn.textContent = 'Löschen (Bulk)';
        applyBtn.style.color = '#ff4d4d';
        applyBtn.style.padding = '6px 16px';
        applyBtn.style.borderRadius = 'var(--radius)';
        applyBtn.style.border = '1px solid #ff4d4d';
        applyBtn.style.background = 'transparent';
        applyBtn.style.cursor = 'pointer';
        applyBtn.style.fontWeight = 'bold';
        
        actionGroup.appendChild(applyBtn);
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'header-btn no-icon';
        closeBtn.textContent = '✕';
        closeBtn.style.padding = '6px 10px';
        closeBtn.style.borderRadius = 'var(--radius)';
        closeBtn.style.border = 'none';
        closeBtn.style.background = 'transparent';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.color = 'var(--text-secondary)';
        closeBtn.onclick = () => {
            this.selectedRows.clear();
            const checkboxes = this.element.querySelectorAll('.bulk-checkbox, .bulk-col-header input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
            this._updateBulkBarVisibility();
        };
        
        bar.appendChild(actionGroup);
        bar.appendChild(closeBtn);
        
        applyBtn.onclick = async () => {
            const { Dialog } = await import('../ui/Dialog.js');
            const ok = await Dialog.confirm({
                message: `Möchtest du wirklich ${this.selectedRows.size} Einträge löschen?`,
                confirmText: 'Löschen',
                confirmStyle: 'warning'
            });
            if (ok) {
                for (const rowId of this.selectedRows) {
                    this.table.dataManager.removeRow(rowId);
                }
                this.selectedRows.clear();
                this._updateBulkBarVisibility();
            }
        };
        
        return bar;
    }
    
    _updateBulkBarVisibility() {
        if (!this.bulkBar) return;
        if (this.selectedRows.size > 0) {
            this.bulkBar.style.display = 'flex';
            this.bulkBar.querySelector('.bulk-actions-msg').textContent = `${this.selectedRows.size} ausgewählt`;
        } else {
            this.bulkBar.style.display = 'none';
        }
    }
}
