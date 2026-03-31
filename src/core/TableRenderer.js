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

        const title = document.createElement('span');
        title.className = 'table-title';
        title.textContent = this.table.title;

        const meta = document.createElement('span');
        meta.className = 'table-meta';
        meta.textContent = `${this.table.rows.length} Zeilen`;
        meta.dataset.role = 'row-count';

        header.appendChild(title);
        header.appendChild(meta);
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
            th.addEventListener('click', () => this.table.sorter.sortBy(col.id, th));

            tr.appendChild(th);
        });

        thead.appendChild(tr);
        return thead;
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

        return tbody;
    }

    _renderEmptyState(tbody) {
        const tr = document.createElement('tr');
        tr.setAttribute('role', 'row');

        const td = document.createElement('td');
        td.colSpan = this.table.schema.length + 1;
        td.className = 'empty-row';
        td.setAttribute('role', 'cell');
        td.textContent = 'Keine Einträge vorhanden. Klicke auf "+ Zeile hinzufügen", um eine zu erstellen.';

        tr.appendChild(td);
        tbody.appendChild(tr);
    }

    _renderRows(tbody) {
        this.table.rows.forEach(row => {
            row.setCallbacks({
                onEditStart:  () => this.table.editor.showSaveBar(),
                onEditChange: () => this.table.editor.showSaveBar(),
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
