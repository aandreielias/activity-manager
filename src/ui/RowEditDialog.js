import { BaseEditDialog } from './BaseEditDialog.js';

/**
 * RowEditDialog - A generic dialog to edit all fields of a row, inheriting the premium layout from BaseEditDialog.
 */
export class RowEditDialog extends BaseEditDialog {
    /**
     * Shows the generic edit dialog for a given row.
     * @param {Row} row - The row instance to edit.
     * @returns {Promise<boolean>}
     */
    static async show(row) {
        // Fallback title/subtitle if not specific
        const title = 'Eintrag bearbeiten';
        const subtitle = row.data.name || row.data.title || row.data.vorname || '';

        return super.show(row, {
            title,
            subtitle,
            hasImage: false // Generic rows usually don't have a main image field that needs a preview
        });
    }
}
