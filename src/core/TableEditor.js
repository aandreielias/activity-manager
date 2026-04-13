import { GlobalStateManager } from './GlobalStateManager.js';
import { UserStatsService } from '../services/UserStatsService.js';
import { DataService } from '../services/DataService.js';

/**
 * TableEditor - Manages save/discard functionality and persistence.
 * Saves rows to the relational Supabase tables via DataService.
 */
export class TableEditor {
    constructor(table) {
        this.table = table;
        this.globalState = GlobalStateManager.getInstance();
    }

    async _saveTable(table) {
        try {
            const tableConfig = table.tableConfig || {};
            const filename = tableConfig.file || `${table.id}.json`;

            const dirtyRowIds = this.globalState.getDirtyRowIds(table.id);
            const deletedIds = this.globalState.getDeletedRowIds(table.id);

            if (dirtyRowIds.length === 0 && deletedIds.length === 0) return;

            // Collect the actual row instances from the table if they match the dirty IDs
            const dirtyRows = table.rows.filter(r => dirtyRowIds.includes(r.id));

            await DataService.saveTable(table.id, filename, dirtyRows, deletedIds);

            // Reset states after successful save
            this.globalState.clearDirtyRowIds(table.id);
            this.globalState.clearDeletedRowIds(table.id);

            const userId = this.globalState.getCurrentUserId();
            const category = tableConfig.category || null;
            if (userId) {
                await UserStatsService.recordEntry(userId, category);
            }
        } catch (error) {
            throw new Error(`Fehler beim Speichern der Tabelle: ${error.message}`);
        }
    }

    showUnsavedChange() {
        this.globalState.markTableAsUnsaved(this.table.id);
        this.table.notifyDataChange();
    }

    hideUnsavedChange() {
        this.globalState.markTableAsSaved(this.table.id);
    }
}
