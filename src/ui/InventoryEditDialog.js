import { BaseDialog } from './BaseDialog.js';
import { SupabaseClient } from '../services/SupabaseClient.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';
import { SUPABASE_CONFIG } from '../config.js';

/**
 * InventoryEditDialog - Specialized dialog for structured editing of inventory entries.
 * Styled to match the system dashboard and audit logs.
 */
export class InventoryEditDialog extends BaseDialog {
    static async show(row) {
        const gs = GlobalStateManager.getInstance();
        const data = { ...row.data };
        const schema = row.schema;
        const tableId = row.tableId;
        const inputsMap = {};
        let currentImageUrl = data.photo || data.image_url;
        let selectedFile = null;

        console.log('[InventoryEditDialog] Opening for row:', row.id);
        console.log('[InventoryEditDialog] Row Data:', data);
        console.log('[InventoryEditDialog] Table Schema:', schema);

        return super.show({
            dialogClassName: 'user-info-dialog inventory-edit-dialog',
            closeOnEscape: true,
            closeOnOutsideClick: true,
            render: (dialog, overlay, resolve, cleanup) => {
                overlay.style.zIndex = '1000';
                
                dialog.style.width = '900px';
                dialog.style.maxWidth = '95vw';
                dialog.style.display = 'flex';
                dialog.style.flexDirection = 'column';

                const header = document.createElement('div');
                header.className = 'user-info-header';
                header.innerHTML = `
                    <div class="user-info-title-area">
                        <h2>Eintrag bearbeiten</h2>
                        <p>${data.name || 'Gegenstand bearbeiten'}</p>
                    </div>
                    <div class="user-info-header-actions">
                        <button class="close-info-btn" aria-label="Schließen">✕</button>
                    </div>
                `;
                dialog.appendChild(header);

                const content = document.createElement('div');
                content.className = 'user-info-content';
                content.style.padding = '32px';
                content.style.display = 'grid';
                content.style.gridTemplateColumns = '300px 1fr';
                content.style.gap = '40px';
                dialog.appendChild(content);

                // LEFT COLUMN: Image
                const leftCol = document.createElement('div');
                leftCol.style.display = 'flex';
                leftCol.style.flexDirection = 'column';
                leftCol.style.gap = '16px';

                const imagePreview = document.createElement('div');
                imagePreview.className = 'inventory-image-preview hero-card';
                imagePreview.style.width = '100%';
                imagePreview.style.aspectRatio = '1';
                imagePreview.style.borderRadius = 'var(--radius)';
                imagePreview.style.display = 'flex';
                imagePreview.style.alignItems = 'center';
                imagePreview.style.justifyContent = 'center';
                imagePreview.style.overflow = 'hidden';
                imagePreview.style.cursor = 'pointer';
                imagePreview.style.background = 'var(--bg-tertiary)';
                imagePreview.style.border = '1px solid var(--border)';
                imagePreview.style.transition = 'all 0.2s ease';

                const handleFile = (file) => {
                    if (file && file.type.startsWith('image/')) {
                        selectedFile = file;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            currentImageUrl = ev.target.result;
                            updatePreview();
                            deleteImgBtn.style.display = 'block';
                        };
                        reader.readAsDataURL(file);
                    }
                };

                const updatePreview = () => {
                    imagePreview.innerHTML = '';
                    if (currentImageUrl) {
                        const img = document.createElement('img');
                        const isFullOrBase64 = currentImageUrl.includes('://') || currentImageUrl.startsWith('data:');
                        img.src = isFullOrBase64 ? currentImageUrl : `${SUPABASE_CONFIG.URL}/storage/v1/object/public/inventory_picture_bucket/${currentImageUrl}`;
                        img.style.width = '100%';
                        img.style.height = '100%';
                        img.style.objectFit = 'cover';
                        imagePreview.appendChild(img);
                    } else {
                        imagePreview.innerHTML = `
                            <div style="text-align:center; color:var(--text-muted); padding: 20px;">
                                <div style="font-size: 11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; opacity: 0.7;">Bild hierher ziehen oder klicken</div>
                            </div>
                        `;
                    }
                };
                updatePreview();

                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';
                fileInput.onchange = (e) => handleFile(e.target.files[0]);

                imagePreview.onclick = () => fileInput.click();
                
                // DRAG & DROP
                imagePreview.ondragover = (e) => {
                    e.preventDefault();
                    imagePreview.style.borderColor = 'var(--accent)';
                    imagePreview.style.background = 'var(--bg-secondary)';
                };
                imagePreview.ondragleave = () => {
                    imagePreview.style.borderColor = 'var(--border)';
                    imagePreview.style.background = 'var(--bg-tertiary)';
                };
                imagePreview.ondrop = (e) => {
                    e.preventDefault();
                    imagePreview.style.borderColor = 'var(--border)';
                    imagePreview.style.background = 'var(--bg-tertiary)';
                    handleFile(e.dataTransfer.files[0]);
                };

                leftCol.appendChild(imagePreview);
                leftCol.appendChild(fileInput);

                const deleteImgBtn = document.createElement('button');
                deleteImgBtn.className = 'close-info-btn';
                deleteImgBtn.style.position = 'static';
                deleteImgBtn.style.width = '100%';
                deleteImgBtn.style.fontSize = '12px';
                deleteImgBtn.style.height = '36px';
                deleteImgBtn.style.marginTop = '8px';
                deleteImgBtn.style.borderRadius = 'var(--radius-sm)';
                deleteImgBtn.style.background = 'var(--bg-secondary)';
                deleteImgBtn.style.border = '1px solid var(--border)';
                deleteImgBtn.textContent = 'Bild entfernen';
                deleteImgBtn.style.display = currentImageUrl ? 'block' : 'none';
                deleteImgBtn.onclick = () => {
                    currentImageUrl = null;
                    selectedFile = null;
                    updatePreview();
                    deleteImgBtn.style.display = 'none';
                };
                leftCol.appendChild(deleteImgBtn);

                content.appendChild(leftCol);

                // RIGHT COLUMN: Form Fields
                const rightCol = document.createElement('div');
                rightCol.style.display = 'grid';
                rightCol.style.gridTemplateColumns = 'repeat(2, 1fr)';
                rightCol.style.gap = '24px';
                rightCol.style.alignContent = 'start';

                schema.forEach(col => {
                    if (['id', 'createdBy', 'createdAt', 'image_url', 'photo'].includes(col.id)) return;

                    const group = document.createElement('div');
                    group.className = 'field-group';
                    const isFullWidth = col.id === 'notes' || col.id === 'anmerkungen' || col.id === 'name';
                    if (isFullWidth) group.style.gridColumn = 'span 2';

                    const lbl = document.createElement('div');
                    lbl.style.fontSize = '11px';
                    lbl.style.fontWeight = '600';
                    lbl.style.textTransform = 'uppercase';
                    lbl.style.letterSpacing = '0.05em';
                    lbl.style.color = 'var(--text-muted)';
                    lbl.style.marginBottom = '8px';
                    lbl.textContent = col.label;
                    group.appendChild(lbl);

                    let input;
                    const val = data[col.id] ?? '';
                    const options = col.options || gs.getEnumOptionsForColumn(col.id, tableId) || [];

                    // FIX: Only use select if there are actual options and it's an enum
                    if ((col.type === 'enum' || col.options) && options.length > 0) {
                        input = document.createElement('select');
                        input.className = 'dialog-input';
                        options.forEach(opt => {
                            const optVal = typeof opt === 'string' ? opt : (opt.id || opt.value);
                            let label = typeof opt === 'string' ? opt : (opt.label || optVal);
                            
                            // Auto-capitalize labels for better UI
                            if (label && typeof label === 'string') {
                                label = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
                            }

                            const o = document.createElement('option');
                            o.value = optVal;
                            o.textContent = label;
                            if (String(optVal).toLowerCase() === String(val).toLowerCase()) o.selected = true;
                            input.appendChild(o);
                        });
                    } else if (col.id === 'notes' || col.id === 'anmerkungen') {
                        input = document.createElement('textarea');
                        input.className = 'dialog-input';
                        input.style.minHeight = '120px';
                        input.value = val;
                    } else {
                        input = document.createElement('input');
                        input.className = 'dialog-input';
                        // Handle date type
                        if (col.type === 'date' || col.id === 'last_checked') {
                            input.type = 'date';
                        } else {
                            input.type = col.type === 'number' ? 'number' : 'text';
                        }
                        input.value = val;
                    }

                    input.style.width = '100%';
                    input.style.padding = '10px 14px';
                    inputsMap[col.id] = input;
                    group.appendChild(input);
                    rightCol.appendChild(group);
                });

                content.appendChild(rightCol);

                // FOOTER
                const footer = document.createElement('div');
                footer.style.padding = '24px 32px';
                footer.style.borderTop = '1px solid var(--border-light)';
                footer.style.display = 'flex';
                footer.style.justifyContent = 'flex-end';
                footer.style.gap = '12px';

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'discard-btn-header';
                cancelBtn.textContent = 'Abbrechen';
                cancelBtn.onclick = cleanup;
                footer.appendChild(cancelBtn);

                const saveBtn = document.createElement('button');
                saveBtn.className = 'save-btn-header';
                saveBtn.textContent = 'Änderungen speichern';
                footer.appendChild(saveBtn);

                dialog.appendChild(footer);

                header.querySelector('.close-info-btn').onclick = cleanup;

                saveBtn.onclick = async () => {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Speichert...';

                    try {
                        const updatedData = { ...data };
                        schema.forEach(col => {
                            const input = inputsMap[col.id];
                            if (!input) return;
                            updatedData[col.id] = col.type === 'number' ? parseFloat(input.value) || 0 : input.value.trim();
                        });

                        // Image Upload logic
                        if (selectedFile) {
                            const compressedBlob = await this._compressImage(selectedFile);
                            const fileName = `${data.id}_${Date.now()}.jpg`;
                            const uploadRes = await SupabaseClient.upload('inventory_picture_bucket', fileName, compressedBlob);
                            if (!uploadRes.ok) throw new Error('Upload fehlgeschlagen');
                            
                            // Delete old image if it exists
                            if (data.photo) {
                                await SupabaseClient.deleteStorageFile('inventory_picture_bucket', data.photo);
                            }
                            
                            updatedData.photo = fileName;
                        } else {
                            // Check if image was removed
                            if (!currentImageUrl && data.photo) {
                                await SupabaseClient.deleteStorageFile('inventory_picture_bucket', data.photo);
                            }
                            updatedData.photo = currentImageUrl === data.photo ? data.photo : currentImageUrl;
                        }

                        // Apply
                        Object.entries(updatedData).forEach(([id, val]) => {
                            row.data[id] = val;
                        });
                        
                        row.isDirty = true;
                        gs.markRowAsDirty(tableId, row.id);
                        gs.markTableAsUnsaved(tableId);
                        row.render(); 

                        cleanup();
                    } catch (e) {
                        alert(`Fehler: ${e.message}`);
                    } finally {
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Änderungen speichern';
                    }
                };
            }
        });
    }

    static async _compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // 1:1 Cropping logic
                    const size = Math.min(img.width, img.height);
                    const sourceX = (img.width - size) / 2;
                    const sourceY = (img.height - size) / 2;
                    
                    // Target size (max 800x800 for good quality/size balance)
                    const targetSize = Math.min(size, 800);
                    canvas.width = targetSize;
                    canvas.height = targetSize;

                    // Draw the cropped portion to the canvas
                    ctx.drawImage(img, sourceX, sourceY, size, size, 0, 0, targetSize, targetSize);

                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Canvas toBlob failed'));
                    }, 'image/jpeg', 0.8);
                };
                img.onerror = () => reject(new Error('Image load failed'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('FileReader failed'));
            reader.readAsDataURL(file);
        });
    }
}
