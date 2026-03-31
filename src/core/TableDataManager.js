import { Row } from './Row.js';
import { GlobalStateManager } from './GlobalStateManager.js';

export class TableDataManager {
    constructor(table) {
        this.table = table;
    }

    _generateId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from(crypto.getRandomValues(new Uint8Array(20)))
            .map(x => chars[x % chars.length])
            .join('');
    }

    addEmptyRow() {
        const id = this._generateId();
        const data = { 
            id,
            createdBy: GlobalStateManager.getInstance().getCurrentUser(),
            createdAt: new Date().toISOString()
        };
        this.table.schema.forEach(col => data[col.id] = '');

        const row = new Row({ id, data, schema: this.table.schema, peopleData: this.table.peopleData, tableId: this.table.id });
        row.setCallbacks({
            onEditStart: () => this.table.editor.showSaveBar(),
            onEditChange: () => this.table.editor.showSaveBar(),
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
        this.table.editor.showSaveBar();
    }

    addRow(rowData) {
        const row = new Row({ id: rowData.id, data: rowData, schema: this.table.schema, peopleData: this.table.peopleData, tableId: this.table.id });
        row.setCallbacks({
            onEditStart: () => this.table.editor.showSaveBar(),
            onEditChange: () => this.table.editor.showSaveBar(),
            onDelete: (rowId) => this.removeRow(rowId),
        });

        this.table.rows.push(row);
        this.table.renderer.element?.querySelector('tbody')?.appendChild(row.render());
        this.table.renderer.updateMeta();
    }

    removeRow(id) {
        this.table.rows = this.table.rows.filter(r => r.id !== id);
        this.table.renderer.element?.querySelector(`[data-row-id="${id}"]`)?.remove();
        this.table.renderer.updateMeta();
        this.table.editor.showSaveBar();
    }
}
