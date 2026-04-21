import { BaseEditDialog } from './BaseEditDialog.js';
import { SupabaseClient } from '../services/SupabaseClient.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';

/**
 * InventoryEditDialog - Specialized dialog for structured editing of inventory entries.
 */
export class InventoryEditDialog extends BaseEditDialog {
    static async show(row) {
        const data = row.data;
        const tableId = row.tableId;
        const gs = GlobalStateManager.getInstance();

        return super.show(row, {
            title: 'Eintrag bearbeiten',
            subtitle: data.name || 'Gegenstand bearbeiten',
            hasImage: true,
            imageSource: data.photo,
            imageBucket: 'inventory_picture_bucket',
            onSave: async (result) => {
                const { data: updatedData, selectedFile, currentImageUrl, imageRemoved } = result;

                // Image Upload logic
                if (selectedFile) {
                    const compressedBlob = await this.compressImage(selectedFile);
                    const fileName = `${row.id}_${Date.now()}.jpg`;
                    const uploadRes = await SupabaseClient.upload('inventory_picture_bucket', fileName, compressedBlob);
                    if (!uploadRes.ok) throw new Error('Upload fehlgeschlagen');
                    
                    if (data.photo) {
                        await SupabaseClient.deleteStorageFile('inventory_picture_bucket', data.photo);
                    }
                    updatedData.photo = fileName;
                } else if (imageRemoved) {
                    if (data.photo) {
                        await SupabaseClient.deleteStorageFile('inventory_picture_bucket', data.photo);
                    }
                    updatedData.photo = null;
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
