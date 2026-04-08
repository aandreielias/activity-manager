import { Row } from './Row.js';
import { GlobalStateManager } from './GlobalStateManager.js';

export class TableDataManager {
    constructor(table) {
        this.table = table;
    }

    _generateId() {
        return crypto.randomUUID();
    }

    addEmptyRow() {
        const id = this._generateId();
        const defaults = { ...(this.table.tableConfig?.defaultRowData || {}) };
        if (defaults.date === 'TODAY_PLACEHOLDER') {
            defaults.date = new Date().toISOString().split('T')[0];
        }

        const data = {
            id,
            createdBy: GlobalStateManager.getInstance().getCurrentUser(),
            createdAt: new Date().toISOString(),
            ...defaults
        };

        this.table.schema.forEach(col => {
            if (data[col.id] === undefined) {
                data[col.id] = '';
            }
        });

        const row = new Row({ id, data, schema: this.table.schema, peopleData: this.table.peopleData, tableId: this.table.id });
        row.setCallbacks({
            onEditStart: () => this.table.editor.showUnsavedChange(),
            onEditChange: () => this.table.editor.showUnsavedChange(),
            onDelete: (rowId) => this.removeRow(rowId),
        });

        if (GlobalStateManager.getInstance().isFavoritesFilterActive()) {
            row.toggleFavorite();
        }

        this.table.rows.push(row);

        // Clean up empty state if it's the first row
        const emptyRow = this.table._tbody.querySelector('.empty-row');
        if (emptyRow) {
            emptyRow.closest('tr')?.remove();
        }

        // insert before the add-row-tr
        const addTr = this.table._tbody.querySelector('.add-row-tr');
        this.table._tbody.insertBefore(row.render(), addTr);
        this.table.renderer.updateMeta();
        this.table.editor.showUnsavedChange();
    }

    addRow(rowData) {
        if (!rowData.id) rowData.id = this._generateId();
        const row = new Row({ id: rowData.id, data: rowData, schema: this.table.schema, peopleData: this.table.peopleData, tableId: this.table.id });
        row.setCallbacks({
            onEditStart: () => this.table.editor.showUnsavedChange(),
            onEditChange: () => this.table.editor.showUnsavedChange(),
            onDelete: (rowId) => this.removeRow(rowId),
        });

        this.table.rows.push(row);

        const addTr = this.table._tbody?.querySelector('.add-row-tr');
        if (addTr) {
            this.table._tbody.insertBefore(row.render(), addTr);
        } else {
            this.table.renderer.element?.querySelector('tbody')?.appendChild(row.render());
        }

        this.table.renderer.updateMeta();
        this.table.editor.showUnsavedChange();
        return row;
    }

    removeRow(id) {
        this.table.rows = this.table.rows.filter(r => r.id !== id);
        this.table.renderer.element?.querySelector(`[data-row-id="${id}"]`)?.remove();
        this.table.renderer.updateMeta();
        this.table.editor.showUnsavedChange();
    }
}
