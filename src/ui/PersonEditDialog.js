import { BaseEditDialog } from './BaseEditDialog.js';
import { SupabaseClient } from '../services/SupabaseClient.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';

/**
 * PersonEditDialog - Specialized dialog for structured editing of personnel entries.
 */
export class PersonEditDialog extends BaseEditDialog {
    static async show(row, isSelfEdit = false) {
        const data = row.data;
        const tableId = row.tableId;
        const gs = GlobalStateManager.getInstance();

        // Prepare a modified row for self-edit if needed
        const displayRow = isSelfEdit ? {
            ...row,
            schema: row.schema.filter(col => ['Tel.', 'email', 'id', 'createdBy', 'createdAt', 'image_url', 'photo'].includes(col.id))
        } : row;

        return super.show(displayRow, {
            title: isSelfEdit ? 'Profil bearbeiten' : 'Eintrag bearbeiten',
            subtitle: `${data.vorname} ${data.nachname || ''}`,
            hasImage: true,
            imageSource: data.image_url,
            imageBucket: 'user_picture_bucket',
            onSave: async (result) => {
                const { data: updatedData, selectedFile, currentImageUrl, imageRemoved } = result;

                // Image Upload logic
                if (selectedFile) {
                    const compressedBlob = await this.compressImage(selectedFile);
                    const fileName = `${row.id}_${Date.now()}.jpg`;
                    const uploadRes = await SupabaseClient.upload('user_picture_bucket', fileName, compressedBlob);
                    if (!uploadRes.ok) throw new Error('Upload fehlgeschlagen');
                    
                    if (data.image_url) {
                        await SupabaseClient.deleteStorageFile('user_picture_bucket', data.image_url);
                    }
                    updatedData.image_url = fileName;
                } else if (imageRemoved) {
                    if (data.image_url) {
                        await SupabaseClient.deleteStorageFile('user_picture_bucket', data.image_url);
                    }
                    updatedData.image_url = null;
                }

                // Apply back to row
                Object.entries(updatedData).forEach(([id, val]) => {
                    row.data[id] = val;
                });
                
                row.isDirty = true;
                gs.markRowAsDirty(tableId, row.id);
                gs.markTableAsUnsaved(tableId);
                row.render(); 
            }
        });
    }
}
