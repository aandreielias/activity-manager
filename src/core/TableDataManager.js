import { Row } from './Row.js';
import { GlobalStateManager } from './GlobalStateManager.js';
import { RepositoryFactory } from '../services/repositories/RepositoryFactory.js';

export class TableDataManager {
    constructor(table) {
        this.table = table;
    }

    _generateId() {
        return crypto.randomUUID();
    }

    /**
     * Get validation rules for the table from its repository.
     * @private
     */
    _getValidator() {
        try {
            const { supaTable } = this._resolveTable();
            return RepositoryFactory.getRepository(supaTable);
        } catch (e) {
            console.warn('[TableDataManager] No validator found:', e);
            return null;
        }
    }

    /**
     * Resolve table mapping.
     * @private
     */
    _resolveTable() {
        const config = GlobalStateManager.getInstance().getTableConfig(this.table.id);
        return {
            supaTable: config?.supa_table || this.table.id,
            category: config?.team_identifier || null
        };
    }

    /**
     * Validate row data before adding.
     * @private
     */
    _validateRow(rowData) {
        const validator = this._getValidator();
        if (!validator) return { valid: true };
        return validator.validate(rowData);
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

        // Ensure critical fields for people table have at least empty strings or placeholders
        // to satisfy validators and ensure they appear in the correct groups.
        this.table.schema.forEach(col => {
            const colId = col.id;
            const lowerId = colId.toLowerCase();
            
            // Check if value exists (case-insensitively for common fields like status)
            let existingKey = Object.keys(data).find(k => k.toLowerCase() === lowerId);
            
            if (!existingKey) {
                data[colId] = col.defaultValue !== undefined ? col.defaultValue : '';
            }
        });

        // Special handling for people table to prevent "Required" warnings immediately
        if (this.table.id === 'tbl_people' || this.table.tableConfig?.supa_table === 'people') {
            if (!data.vorname) data.vorname = 'Neuer';
            if (!data.nachname) data.nachname = 'Eintrag';
            if (!data.Status) data.Status = 'Aktiv';
        }

        // Validate before creating row
        const validation = this._validateRow(data);
        if (!validation.valid) {
            console.warn('[TableDataManager] Validation warnings for new row:', validation.errors);
            // Don't block creation, just warn
        }

        const row = new Row({ id, data, schema: this.table.schema, peopleData: this.table.peopleData, tableId: this.table.id });
        row.isDirty = true;
        row.setCallbacks({
            onEditStart: () => this.table.editor.showUnsavedChange(),
            onEditChange: () => this.table.editor.showUnsavedChange(),
            onDelete: (rowId) => this.removeRow(rowId),
        });

        if (GlobalStateManager.getInstance().isFavoritesFilterActive()) {
            row.toggleFavorite();
        }

        // Add to rows
        this.table.rows.push(row);
        
        // SYNC: Keep sourceData in sync
        this._syncSourceData();

        // Update UI properly via renderer
        this.table.renderer.update();
        this.table.notifyDataChange();
        this.table.editor.showUnsavedChange();
    }

    addRow(rowData) {
        if (!rowData.id) rowData.id = this._generateId();
        
        // Validate before creating row
        const validation = this._validateRow(rowData);
        if (!validation.valid) {
            console.warn('[TableDataManager] Validation warnings for new row:', validation.errors);
            // Don't block creation, just warn
        }

        const row = new Row({ id: rowData.id, data: rowData, schema: this.table.schema, peopleData: this.table.peopleData, tableId: this.table.id });
        row.isDirty = true;
        row.setCallbacks({
            onEditStart: () => this.table.editor.showUnsavedChange(),
            onEditChange: () => this.table.editor.showUnsavedChange(),
            onDelete: (rowId) => this.removeRow(rowId),
        });

        this.table.rows.push(row);

        // SYNC: Keep sourceData in sync
        this._syncSourceData();

        // Update UI properly via renderer
        this.table.renderer.update();
        this.table.notifyDataChange();
        this.table.editor.showUnsavedChange();
        return row;
    }

    removeRow(id) {
        this.table.rows = this.table.rows.filter(r => r.id !== id);
        this.table.renderer.element?.querySelector(`[data-row-id="${id}"]`)?.remove();
        this.table.renderer.updateMeta();
        
        GlobalStateManager.getInstance().markRowAsDeleted(this.table.id, id);
        
        // SYNC: Keep sourceData in sync
        this._syncSourceData();
        
        this.table.editor.showUnsavedChange();
    }

    /**
     * Synchronize the sourceData array with current rows.
     * Ensures data consistency between row objects and source data.
     * @private
     */
    _syncSourceData() {
        if (!this.table.sourceData || !Array.isArray(this.table.sourceData)) {
            return;
        }

        // Build a map of current row IDs
        const currentIds = new Set(this.table.rows.map(r => r.id));

        // Remove rows from sourceData that are no longer in rows (IN-PLACE)
        for (let i = this.table.sourceData.length - 1; i >= 0; i--) {
            const item = this.table.sourceData[i];
            if (item && item.id && !currentIds.has(item.id)) {
                this.table.sourceData.splice(i, 1);
            }
        }

        // Update/add rows in sourceData based on current rows
        const sourceDataIds = new Map(this.table.sourceData.map((row, index) => [row.id, index]));
        
        for (const row of this.table.rows) {
            const rowJson = row.toJSON ? row.toJSON() : row.data;
            if (sourceDataIds.has(row.id)) {
                // Update existing (in-place)
                const index = sourceDataIds.get(row.id);
                this.table.sourceData[index] = rowJson;
            } else {
                // Add new (in-place)
                this.table.sourceData.push(rowJson);
            }
        }
    }
}
