import { BaseDialog } from './BaseDialog.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';
import { SupabaseClient } from '../services/SupabaseClient.js';
import { SUPABASE_CONFIG } from '../config.js';
import { FieldFactory } from '../core/fields/FieldFactory.js';
import '../styles/BaseEditDialog.css';

/**
 * BaseEditDialog - Abstract base class for all row editing dialogs.
 * Provides the core layout and styling patterns used across the application.
 */
export class BaseEditDialog extends BaseDialog {
    /**
     * Common render pattern for edit dialogs.
     * @param {Object} row - The row instance being edited.
     * @param {Object} options - Configuration options.
     */
    static async show(row, options = {}) {
        const {
            title = 'Eintrag bearbeiten',
            subtitle = '',
            dialogClassName = 'user-info-dialog',
            width = '900px',
            hasImage = false,
            imageSource = null,
            imageBucket = 'user_picture_bucket',
            onSave = null,
            onRender = null
        } = options;

        const gs = GlobalStateManager.getInstance();
        const data = { ...row.data };
        const schema = row.schema;
        const tableId = row.tableId;
        const inputsMap = {};
        let currentImageUrl = imageSource;
        let selectedFile = null;

        return super.show({
            dialogClassName: `${dialogClassName} base-edit-dialog`,
            closeOnEscape: true,
            closeOnOutsideClick: true,
            render: (dialog, overlay, resolve, cleanup) => {
                overlay.style.zIndex = '1000';
                
                dialog.style.width = width;
                dialog.style.maxWidth = '95vw';
                dialog.style.display = 'flex';
                dialog.style.flexDirection = 'column';

                // Header
                const header = document.createElement('div');
                header.className = 'user-info-header';
                header.innerHTML = `
                    <div class="user-info-title-area">
                        <h2>${title}</h2>
                        <p>${subtitle || ''}</p>
                    </div>
                    <div class="user-info-header-actions">
                        <button class="close-info-btn" aria-label="Schließen">✕</button>
                    </div>
                `;
                const closeBtn = header.querySelector('.close-info-btn');
                if (closeBtn) {
                    closeBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        resolve(null);
                        cleanup();
                    };
                }
                dialog.appendChild(header);

                // Content Wrapper
                const content = document.createElement('div');
                content.className = 'user-info-content';
                content.style.padding = '32px';
                content.style.display = 'grid';
                content.style.gridTemplateColumns = hasImage ? '300px 1fr' : '1fr';
                content.style.gap = '40px';
                dialog.appendChild(content);

                // Left Column (Image)
                let deleteImgBtn = null;
                if (hasImage) {
                    const leftCol = document.createElement('div');
                    leftCol.style.display = 'flex';
                    leftCol.style.flexDirection = 'column';
                    leftCol.style.gap = '16px';

                    const imagePreview = document.createElement('div');
                    imagePreview.className = 'inventory-image-preview hero-card';
                    imagePreview.style.width = '100%';
                    imagePreview.style.aspectRatio = '1';

                    const updatePreview = () => {
                        imagePreview.innerHTML = '';
                        if (currentImageUrl) {
                            const img = document.createElement('img');
                            const isFullOrBase64 = currentImageUrl.includes('://') || currentImageUrl.startsWith('data:');
                            img.src = isFullOrBase64 ? currentImageUrl : `${SUPABASE_CONFIG.URL}/storage/v1/object/public/${imageBucket}/${currentImageUrl}`;
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
                    
                    const handleFile = (file) => {
                        if (file && file.type.startsWith('image/')) {
                            selectedFile = file;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                currentImageUrl = ev.target.result;
                                updatePreview();
                                if (deleteImgBtn) deleteImgBtn.style.display = 'block';
                            };
                            reader.readAsDataURL(file);
                        }
                    };

                    fileInput.onchange = (e) => handleFile(e.target.files[0]);
                    imagePreview.onclick = () => fileInput.click();

                    // Drag & Drop
                    imagePreview.ondragover = (e) => { e.preventDefault(); imagePreview.style.borderColor = 'var(--accent)'; };
                    imagePreview.ondragleave = () => { imagePreview.style.borderColor = 'var(--border)'; };
                    imagePreview.ondrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); };

                    leftCol.appendChild(imagePreview);
                    leftCol.appendChild(fileInput);

                    deleteImgBtn = document.createElement('button');
                    deleteImgBtn.className = 'close-info-btn';
                    deleteImgBtn.style.position = 'static';
                    deleteImgBtn.style.width = '100%';
                    deleteImgBtn.style.height = '36px';
                    deleteImgBtn.style.marginTop = '8px';
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
                }

                // Right Column (Form)
                const rightCol = document.createElement('div');
                rightCol.className = 'edit-form-grid';
                rightCol.style.display = 'grid';
                rightCol.style.gridTemplateColumns = 'repeat(12, 1fr)';
                rightCol.style.gap = '24px';
                rightCol.style.alignContent = 'start';

                if (!schema || !Array.isArray(schema)) {
                    console.error('[BaseEditDialog] Schema is missing or not an array:', schema);
                    const msg = document.createElement('div');
                    msg.textContent = 'Fehler: Tabellenschema konnte nicht geladen werden.';
                    msg.style.padding = '20px';
                    msg.style.color = 'var(--error)';
                    rightCol.appendChild(msg);
                } else {
                    // Filter out invalid columns before sorting
                    const validSchema = schema.filter(col => col && col.id);
                    const sortedSchema = [...validSchema];
                    
                    if (validSchema.length === 0) {
                        const msg = document.createElement('div');
                        msg.textContent = 'Keine Felder zum Bearbeiten gefunden.';
                        msg.style.padding = '20px';
                        msg.style.color = 'var(--text-muted)';
                        rightCol.appendChild(msg);
                    } else {
                        const getSortRank = (col) => {
                            const id = (col.id || '').toLowerCase();
                            const lbl = (col.label || '').toLowerCase();
                            if (id.includes('name') || id === 'titel' || lbl === 'spielname') return 0;
                            if (id === 'status' || lbl === 'status') return 1;
                            if (id.includes('kurzerklaerung') || id.includes('kurzerklärung') || lbl.includes('kurzerklärung')) return 2;
                            if (id.includes('spielregeln') || lbl.includes('spielregeln')) return 3;
                            if (id.includes('required_items') || id.includes('gegenstände') || id.includes('gegenstaende') || lbl.includes('gegenstände')) return 4;
                            if (id.includes('dauer') || lbl.includes('dauer')) return 5;
                            if (id.includes('vorbereitung') || lbl.includes('vorbereitung')) return 6;
                            return 999;
                        };

                        sortedSchema.sort((a, b) => getSortRank(a) - getSortRank(b));
                    }

                    sortedSchema.forEach(col => {
                        if (['id', 'createdBy', 'createdAt', 'image_url', 'photo'].includes(col.id)) return;
                        if (col.hidden) return;

                        const group = document.createElement('div');
                        group.className = 'field-group';
                        
                        const idLower = col.id.toLowerCase();
                        const labelLower = (col.label || '').toLowerCase();

                        // Better identification
                        const isName = idLower.includes('name') || idLower === 'titel' || labelLower === 'spielname';
                        const isStatus = idLower === 'status' || labelLower === 'status';
                        const isInventoryField = idLower.includes('required_items') || idLower.includes('gegenstände') || idLower.includes('gegenstaende') || labelLower.includes('gegenstände');
                        const isExplanation = idLower.includes('kurzerklaerung') || idLower.includes('kurzerklärung') || labelLower.includes('kurzerklärung');
                        const isRules = idLower.includes('spielregeln') || labelLower.includes('spielregeln');
                        const isDuration = idLower.includes('dauer') || labelLower.includes('dauer');
                        const isPrepTime = idLower.includes('vorbereitung') || labelLower.includes('vorbereitung');

                        // Logic for field sizing
                        const isBigText = ['notes', 'anmerkungen', 'aufgabe_aktivitaetenteam', 'aufgabe', 'aktivitaetenteam', 'beschreibung', 'kommentar'].includes(idLower) || isExplanation || isRules;
                        const isCompact = col.type === 'number' || isDuration || isPrepTime || ['menge', 'anzahl', 'preis', 'alter', 'jahr', 'id_nr'].includes(idLower);

                        if (isName) {
                            group.style.gridColumn = 'span 10'; // Much wider for name
                        } else if (isStatus) {
                            group.style.gridColumn = 'span 2'; // Narrow for status
                        } else if (isInventoryField) {
                            group.style.gridColumn = 'span 6'; // 1/2 row
                        } else if (isExplanation || isRules) {
                            group.style.gridColumn = 'span 6'; // 1/2 row
                        } else if (isBigText) {
                            group.style.gridColumn = 'span 12'; // Full row
                        } else if (isCompact) {
                            group.style.gridColumn = 'span 3'; // 1/4 row
                        } else {
                            group.style.gridColumn = 'span 6'; // Default 1/2 row
                        }

                    const lbl = document.createElement('div');
                    lbl.className = 'field-label';
                    lbl.textContent = col.label;
                    group.appendChild(lbl);

                    // Use FieldFactory for consistent field logic
                    const fieldParams = {
                        rowId: row.id,
                        rowData: data,
                        colDef: col,
                        value: data[col.id],
                        peopleData: row.peopleData || [],
                        tableId: tableId,
                        onChange: (fieldId, newVal) => {
                            data[fieldId] = newVal;
                        }
                    };

                    const field = FieldFactory.createField(fieldParams);
                    let input;

                    // Specific handling for complex pickers (Tags, Inventory, etc.)
                    const isPickerField = col.type === 'tag' || idLower === 'team' || idLower === 'kategorie' || isInventoryField || idLower === 'games' || idLower === 'condition';

                    if (isPickerField) {
                        input = document.createElement('div');
                        input.className = 'dialog-input trigger-field pill-container';
                        input.style.cursor = 'pointer';
                        input.style.minHeight = '42px';
                        input.style.display = 'flex';
                        input.style.alignItems = 'center';
                        input.style.gap = '6px';
                        input.style.flexWrap = 'wrap';
                        input.style.padding = '6px 12px';
                        
                        const updateTriggerDisplay = () => {
                            input.innerHTML = '';
                            
                            // For Status, we want a single pill with special styling
                            if (isStatus) {
                                const display = field.getDisplayValue();
                                const tag = document.createElement('span');
                                const sanitized = display.toLowerCase().replace(/\s+/g, '-');
                                tag.className = `inventory-tag status-${sanitized}`;
                                tag.textContent = display;
                                input.appendChild(tag);
                            } else {
                                // For other picker fields (Tags, Inventory, etc.), 
                                // we use the field's own updateDisplay logic into our wrap.
                                const wrap = document.createElement('div');
                                wrap.style.display = 'flex';
                                wrap.style.gap = '6px';
                                wrap.style.flexWrap = 'wrap';
                                wrap.style.alignItems = 'center';
                                
                                const originalWrap = field.contentWrap;
                                field.contentWrap = wrap;
                                field.updateDisplay();
                                
                                // If updateDisplay just put text, wrap it or handle it
                                if (wrap.innerHTML === '' && field.getDisplayValue()) {
                                    wrap.textContent = field.getDisplayValue();
                                }
                                
                                input.appendChild(wrap);
                                field.contentWrap = originalWrap;
                            }
                        };
                        updateTriggerDisplay();

                        input.onclick = () => {
                            field.onChange = (fieldId, newVal) => {
                                data[fieldId] = newVal;
                                field.value = newVal;
                                updateTriggerDisplay();
                            };
                            
                            // For status, use standard editor logic but as a popup
                            if (isStatus) {
                                const editor = field.createEditor();
                                document.body.appendChild(editor);
                                // Position it near the input
                                const rect = input.getBoundingClientRect();
                                editor.style.position = 'fixed';
                                editor.style.top = `${rect.bottom + 5}px`;
                                editor.style.left = `${rect.left}px`;
                                editor.style.zIndex = '10000';
                                
                                field.setSelectionCallback(() => {
                                    const newVal = field.extractValue(editor);
                                    data[col.id] = newVal;
                                    field.value = newVal;
                                    updateTriggerDisplay();
                                    if (editor.destroy) editor.destroy();
                                    else editor.remove();
                                });
                                
                                // Close on outside click
                                const oc = (e) => {
                                    if (!editor.contains(e.target) && e.target !== input) {
                                        if (editor.destroy) editor.destroy();
                                        else editor.remove();
                                        document.removeEventListener('click', oc);
                                    }
                                };
                                setTimeout(() => document.addEventListener('click', oc), 50);
                            } else {
                                field.startEditing();
                            }
                        };
                    } else if (isBigText) {
                        input = document.createElement('textarea');
                        input.className = 'dialog-input textarea-sync-height';
                        input.style.minHeight = '140px';
                        input.style.height = '140px'; 
                        input.value = data[col.id] || '';
                        input.oninput = (e) => { data[col.id] = e.target.value; };
                    } else if (isName) {
                        // Force normal input for names to ensure 42px height
                        input = document.createElement('input');
                        input.className = 'dialog-input';
                        input.value = data[col.id] === '—' ? '' : (data[col.id] || '');
                        input.oninput = (e) => { data[col.id] = e.target.value; };
                    } else {
                        input = field.createEditor();
                        if (input.classList.contains('custom-enum-dropdown')) {
                            // If it's a status field, we want the button to look like a pill
                            if (isStatus) {
                                const btn = input.querySelector('.enum-dropdown-btn');
                                const textSpan = input.querySelector('.enum-dropdown-btn-text');
                                if (btn && textSpan) {
                                    btn.classList.add('status-dropdown-pill-btn');
                                    
                                    const updatePill = () => {
                                        const val = field.getRawValue();
                                        const sanitized = val.toLowerCase().replace(/\s+/g, '-');
                                        textSpan.className = `enum-dropdown-btn-text inventory-tag status-${sanitized}`;
                                        textSpan.style.margin = '0 auto'; // Center it
                                        textSpan.style.display = 'inline-flex';
                                        textSpan.style.width = 'fit-content';
                                        textSpan.style.flex = '0 0 auto';
                                    };
                                    updatePill();
                                    
                                    // Ensure the button itself is a flex container that centers
                                    btn.style.display = 'flex';
                                    btn.style.justifyContent = 'center';
                                    btn.style.alignItems = 'center';
                                    btn.style.position = 'relative';
                                    
                                    // Arrow should be absolute or separate
                                    const arrow = btn.querySelector('.enum-dropdown-btn-arrow');
                                    if (arrow) {
                                        arrow.style.position = 'absolute';
                                        arrow.style.right = '12px';
                                    }
                                    
                                    input.setSelectionCallback(() => {
                                        const newVal = field.extractValue(input);
                                        data[col.id] = newVal;
                                        updatePill();
                                    });
                                }
                            }
                        } else {
                            input.classList.add('dialog-input');
                        }
                        
                        const sync = () => {
                            const newVal = field.extractValue(input);
                            data[col.id] = newVal;
                        };
                        
                        input.addEventListener('input', sync);
                        input.addEventListener('change', sync);
                        input.addEventListener('blur', sync);
                        
                        if (input.setSelectionCallback) {
                            input.setSelectionCallback(sync);
                        }
                    }

                    input.style.width = '100%';
                    inputsMap[col.id] = input;
                    group.appendChild(input);
                    rightCol.appendChild(group);
                });
                }

                content.appendChild(rightCol);

                // Footer
                const footer = document.createElement('div');
                footer.style.padding = '24px 32px';
                footer.style.borderTop = '1px solid var(--border-light)';
                footer.style.display = 'flex';
                footer.style.justifyContent = 'flex-end';
                footer.style.gap = '12px';

                const closeAndResolve = (value) => {
                    // Cleanup editors (important for EnumField menus)
                    Object.values(inputsMap).forEach(editor => {
                        if (editor && typeof editor.destroy === 'function') {
                            editor.destroy();
                        }
                    });
                    cleanup();
                    resolve(value);
                };

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'discard-btn-header';
                cancelBtn.textContent = 'Abbrechen';
                cancelBtn.onclick = () => closeAndResolve(false);
                footer.appendChild(cancelBtn);

                const saveBtn = document.createElement('button');
                saveBtn.className = 'save-btn-header';
                saveBtn.textContent = 'Änderungen speichern';
                footer.appendChild(saveBtn);

                dialog.appendChild(footer);

                header.querySelector('.close-info-btn').onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeAndResolve(false);
                };

                saveBtn.onclick = async () => {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Speichert...';

                    try {
                        const updatedData = { ...data };
                        schema.forEach(col => {
                            const input = inputsMap[col.id];
                            if (!input) return;
                            
                            // If it's a picker field, we already updated data[fieldId] in the trigger onclick
                            // But for normal inputs, we might need to extract the value if we didn't sync on every input
                            // Actually, for consistency, let's just use the current 'data' object which is being updated.
                            // However, some fields might not have synced yet.
                        });

                        const result = {
                            data: updatedData,
                            selectedFile,
                            currentImageUrl,
                            imageRemoved: !currentImageUrl && imageSource
                        };

                        if (onSave) {
                            await onSave(result);
                        } else {
                            // Default behavior: just apply back to row
                            Object.entries(updatedData).forEach(([id, val]) => {
                                row.data[id] = val;
                            });
                            row.isDirty = true;
                            gs.markRowAsDirty(tableId, row.id);
                            gs.markTableAsUnsaved(tableId);
                            row.render();
                        }

                        closeAndResolve(true);
                    } catch (e) {
                        alert(`Fehler: ${e.message}`);
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Änderungen speichern';
                    }
                };

                if (onRender) onRender(dialog, { inputsMap, data, schema });
            }
        });
    }

    /**
     * Helper to compress image before upload
     */
    static async compressImage(file, { maxWidth = 800, quality = 0.8 } = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const size = Math.min(img.width, img.height);
                    const sourceX = (img.width - size) / 2;
                    const sourceY = (img.height - size) / 2;
                    const targetSize = Math.min(size, maxWidth);
                    canvas.width = targetSize;
                    canvas.height = targetSize;
                    ctx.drawImage(img, sourceX, sourceY, size, size, 0, 0, targetSize, targetSize);
                    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', quality);
                };
                img.onerror = () => reject(new Error('Image load failed'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('FileReader failed'));
            reader.readAsDataURL(file);
        });
    }
}
