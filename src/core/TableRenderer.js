import '../styles/Table.css';
import { GlobalStateManager } from './GlobalStateManager.js';

/**
 * TableRenderer - Handles rendering and updating the table UI
 */
export class TableRenderer {
    constructor(table) {
        this.table = table;
        this.element = null;
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'table-wrapper';

        this.element.appendChild(this._renderHeader());
        this.element.appendChild(this._renderTableScroll());

        return this.element;
    }

    _renderHeader() {
        const header = document.createElement('div');
        header.className = 'table-top';
        header.style.cursor = 'pointer';
        header.title = 'Klicken zum Ein-/Ausklappen';

        const titleGroup = document.createElement('div');
        titleGroup.className = 'table-title-group';

        const icon = document.createElement('span');
        icon.className = 'collapse-icon';
        icon.innerHTML = '▾';

        const title = document.createElement('span');
        title.className = 'table-title';
        title.textContent = this.table.title;

        titleGroup.appendChild(icon);
        titleGroup.appendChild(title);

        const meta = document.createElement('span');
        meta.className = 'table-meta';
        meta.textContent = `${this.table.rows.length} Zeilen`;
        meta.dataset.role = 'row-count';

        header.appendChild(titleGroup);
        header.appendChild(meta);

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

        // Favorite column header
        const favTh = document.createElement('th');
        favTh.className = 'favorite-col-header';
        favTh.textContent = '★';
        favTh.title = 'Favoriten';
        tr.appendChild(favTh);

        // Column headers
        this.table.schema.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.label;
            th.dataset.colId = col.id;
            th.setAttribute('role', 'columnheader');
            
            // Re-wrap text to allow space for resizer
            th.innerHTML = `<div class="th-content">${col.label}</div>`;

            // Sort functionality
            th.addEventListener('click', (e) => {
                if (e.target.classList.contains('col-resizer')) return;
                this.table.sorter.sortBy(col.id, th);
            });

            // Resizer element
            const resizer = document.createElement('div');
            resizer.className = 'col-resizer';
            th.appendChild(resizer);

            this._setupColumnResizing(th, resizer);

            tr.appendChild(th);
        });

        thead.appendChild(tr);
        return thead;
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
        td.colSpan = this.table.schema.length + 1;
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
        td.colSpan = this.table.schema.length + 2;
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
    }
}
