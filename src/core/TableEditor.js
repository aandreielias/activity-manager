import { GlobalStateManager } from './GlobalStateManager.js';
import { UserStatsService } from '../services/UserStatsService.js';
import { DataService } from '../services/DataService.js';

/**
 * TableEditor - Manages save/discard functionality and persistence
 */
export class TableEditor {
    constructor(table) {
        this.table = table;
        this.globalState = GlobalStateManager.getInstance();
    }

    async _handleSave(tables) {
        // Save all tables that have unsaved changes
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

            // Save to Express.js backend API
            await DataService.saveTable(
                table.id,
                filename,
                table.rows
            );

            // Record user activity
            const username = this.globalState.getCurrentUser();
            const category = (table.tableConfig || {}).category || null;
            await UserStatsService.recordEntry(username, category);
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

