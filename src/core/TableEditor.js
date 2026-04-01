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

    async _handleSave(tables) {
        const unsavedIds = this.globalState.getUnsavedTableIds();

        try {
            for (const tableId of unsavedIds) {
                const table = tables[tableId];
                if (table) {
                    await this._saveTable(table);
                }
            }
            this.globalState.clearAllUnsaved();
        } catch (error) {
            console.error('Speicherfehler:', error);
            alert(`Fehler beim Speichern der Tabellen: ${error.message}`);
        }
    }

    async _saveTable(table) {
        try {
            const tableConfig = table.tableConfig || {};
            const filename = tableConfig.file || `${table.id}.json`;

            // Save to the relational Supabase table
            await DataService.saveTable(
                table.id,
                filename,
                table.rows
            );

            // Record user activity with the user's UUID
            const userId = this.globalState.getCurrentUserId();
            const category = (table.tableConfig || {}).category || null;
            if (userId) {
                await UserStatsService.recordEntry(userId, category);
            }
        } catch (error) {
            throw new Error(`Fehler beim Speichern der Tabelle: ${error.message}`);
        }
    }

    showUnsavedChange() {
        this.globalState.markTableAsUnsaved(this.table.id);
    }

    hideUnsavedChange() {
        this.globalState.markTableAsSaved(this.table.id);
    }

    // Legacy method for compatibility
    showSaveBar() {
        this.showUnsavedChange();
    }

    hideSaveBar() {
        this.hideUnsavedChange();
    }
}
