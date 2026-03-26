import { Row } from './Row.js';

export class TableDataManager {
    constructor(table) {
        this.table = table;
    }

    addEmptyRow() {
        const id = `row_${Date.now()}`;
        const data = { id };
        this.table.schema.forEach(col => data[col.id] = '');

        const row = new Row({ id, data, schema: this.table.schema });
        row.setCallbacks({
            onEditStart: () => this.table.editor.showSaveBar(),
            onEditChange: () => this.table.editor.showSaveBar(),
            onDelete: (rowId) => this.removeRow(rowId),
            onReorder: (fromId, toId) => this.reorderRows(fromId, toId),
        });
        this.table.rows.push(row);

        // insert before the add-row-tr
        const addTr = this.table._tbody.querySelector('.add-row-tr');
        this.table._tbody.insertBefore(row.render(), addTr);
        this.table.renderer.updateMeta();
        this.table.editor.showSaveBar();
    }

    addRow(rowData) {
        const row = new Row({ id: rowData.id, data: rowData, schema: this.table.schema, peopleData: this.table.peopleData });
        row.setCallbacks({
            onEditStart: () => this.table.editor.showSaveBar(),
            onEditChange: () => this.table.editor.showSaveBar(),
            onDelete: (rowId) => this.removeRow(rowId),
            onReorder: (fromId, toId) => this.reorderRows(fromId, toId),
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

    reorderRows(fromId, toId) {
        const fromIndex = this.table.rows.findIndex(r => r.id === fromId);
        const toIndex = this.table.rows.findIndex(r => r.id === toId);
        
        if (fromIndex === -1 || toIndex === -1) return;
        
        // Remove from source position
        const [row] = this.table.rows.splice(fromIndex, 1);
        
        // Insert at target position
        const newIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
        this.table.rows.splice(newIndex, 0, row);
        
        // Re-render the tbody to reflect the new order
        this.table.renderer.reRenderBody();
        this.table.editor.showSaveBar();
    }
}
