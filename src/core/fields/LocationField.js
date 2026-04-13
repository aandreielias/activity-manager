import { Field } from './Field.js';
import { GlobalStateManager } from '../GlobalStateManager.js';
import { SupabaseClient } from '../../services/SupabaseClient.js';
import { Dialog } from '../../ui/Dialog.js';
import { BaseDialog } from '../../ui/BaseDialog.js';

export class LocationField extends Field {
    constructor(params) {
        super(params);
        this.orte = [];
    }

    updateDisplay() {
        if (!this.contentWrap) return;
        this.contentWrap.innerHTML = '';

        const val = this.value; // Expecting an object { id, title, link, ... } or null

        if (!val || (!val.title && typeof val !== 'string')) {
            this.contentWrap.textContent = '—';
            return;
        }

        const title = val.title || (typeof val === 'string' ? val : 'Unbenannt');
        const link = val.link || null;

        if (link && this._isLink(link)) {
            const trimmed = link.trim();
            const href = trimmed.toLowerCase().startsWith('www.') ? `https://${trimmed}` : trimmed;
            const a = document.createElement('a');
            a.href = href;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'cell-link';
            a.textContent = title;
            this.contentWrap.appendChild(a);
        } else {
            this.contentWrap.textContent = title;
        }
    }

    async startEditing() {
        this._showLocationDialog();
    }

    async _showLocationDialog() {
        // Fetch all locations for the selector
        const res = await SupabaseClient.get('ort', '?select=*&order=title.asc');
        let orte = [];
        if (res.ok) orte = await res.json();

        const inputsMap = {};
        this.selectedId = this.value?.id || null;

        return BaseDialog.show({
            overlayClassName: 'custom-dialog-overlay',
            dialogClassName: 'custom-dialog',
            closeOnEscape: false,
            closeOnOutsideClick: true,
            onEscapeValue: null,
            render: (dialog, overlay, resolve, cleanup) => {
                overlay.style.zIndex = '1000';

                dialog.style.display = 'block'; // Override flex
                dialog.style.background = 'var(--bg)';
                dialog.style.border = '1px solid var(--border)';
                dialog.style.width = '640px';
                dialog.style.maxWidth = '95vw';
                dialog.style.padding = '32px';
                dialog.style.borderRadius = 'var(--radius)';
                dialog.style.boxShadow = 'var(--shadow-lg)';
                dialog.style.maxHeight = '90vh';
                dialog.style.overflowY = 'auto';

                const header = document.createElement('div');
                header.style.fontSize = '18px';
                header.style.fontWeight = '600';
                header.style.marginBottom = '8px';
                header.style.color = 'var(--text-primary)';
                header.textContent = 'Standort-Details';
                dialog.appendChild(header);

                // Existing selection - Custom Picker
                const pickerGroup = document.createElement('div');
                pickerGroup.style.marginBottom = '24px';
                pickerGroup.style.padding = '16px';
                pickerGroup.style.background = 'var(--bg-secondary)';
                pickerGroup.style.borderRadius = 'var(--radius)';
                pickerGroup.style.border = '1px solid var(--border-light)';

                const pickerLabel = document.createElement('div');
                pickerLabel.style.fontSize = '11px';
                pickerLabel.style.fontWeight = '600';
                pickerLabel.style.textTransform = 'uppercase';
                pickerLabel.style.letterSpacing = '0.05em';
                pickerLabel.style.color = 'var(--text-muted)';
                pickerLabel.style.marginBottom = '10px';
                pickerLabel.textContent = 'Bestehenden Ort suchen & laden';
                pickerGroup.appendChild(pickerLabel);

                const searchRow = document.createElement('div');
                searchRow.style.display = 'flex';
                searchRow.style.gap = '10px';
                searchRow.style.marginBottom = '8px';

                const searchInput = document.createElement('input');
                searchInput.className = 'dialog-input';
                searchInput.placeholder = 'Nach Titel oder Adresse suchen...';
                searchInput.style.flex = '1';
                searchRow.appendChild(searchInput);

                const plusBtn = document.createElement('button');
                plusBtn.className = 'save-btn-header';
                plusBtn.innerHTML = '<span>+</span> Neuer Ort';
                plusBtn.style.whiteSpace = 'nowrap';
                plusBtn.style.fontSize = '12px';
                plusBtn.style.height = '36px';
                plusBtn.style.display = 'flex';
                plusBtn.style.alignItems = 'center';
                plusBtn.style.gap = '6px';
                plusBtn.style.padding = '0 16px';
                plusBtn.title = 'Alle Felder leeren, um einen neuen Ort zu erstellen';
                plusBtn.onclick = () => {
                    this.selectedId = null;
                    Object.values(inputsMap).forEach(input => input.value = '');
                    searchInput.value = '';
                    plusBtn.style.background = 'var(--accent)';
                    plusBtn.style.color = 'white';
                    setTimeout(() => {
                        plusBtn.style.background = '';
                        plusBtn.style.color = '';
                    }, 1000);
                };
                searchRow.appendChild(plusBtn);
                pickerGroup.appendChild(searchRow);

                const resultsList = document.createElement('div');
                resultsList.style.maxHeight = '150px';
                resultsList.style.overflowY = 'auto';
                resultsList.style.display = 'flex';
                resultsList.style.flexDirection = 'column';
                resultsList.style.gap = '4px';
                pickerGroup.appendChild(resultsList);

                const renderResults = (query = '') => {
                    resultsList.innerHTML = '';
                    const filtered = orte.filter(o =>
                        (o.title || '').toLowerCase().includes(query.toLowerCase()) ||
                        (o.city || '').toLowerCase().includes(query.toLowerCase()) ||
                        (o.street || '').toLowerCase().includes(query.toLowerCase())
                    );

                    if (filtered.length === 0 && query) {
                        const empty = document.createElement('div');
                        empty.textContent = 'Keine Orte gefunden. Sie können unten manuell einen neuen erstellen.';
                        empty.style.fontSize = '12px';
                        empty.style.color = 'var(--text-muted)';
                        empty.style.padding = '8px';
                        resultsList.appendChild(empty);
                        return;
                    }

                    filtered.slice(0, 10).forEach(o => {
                        const btn = document.createElement('button');
                        btn.className = 'suggestion-item';
                        btn.style.display = 'block';
                        btn.style.width = '100%';
                        btn.style.textAlign = 'left';
                        btn.style.padding = '8px 12px';
                        btn.style.fontSize = '13px';
                        btn.style.border = '1px solid var(--border-light)';
                        btn.style.borderRadius = 'var(--radius-sm)';
                        btn.style.background = 'var(--bg)';
                        btn.style.cursor = 'pointer';
                        btn.style.transition = 'all 0.1s';

                        const addr = [o.street, o.zip_code, o.city].filter(x => x).join(', ');
                        btn.innerHTML = `
                            <span style="font-weight: 500;">${o.title}</span>
                            <span style="float: right; color: var(--text-muted); font-size: 11px; margin-left: 12px;">${addr}</span>
                        `;

                        btn.onclick = () => {
                            Object.entries(inputsMap).forEach(([id, input]) => {
                                input.value = o[id] || '';
                            });
                            this.selectedId = o.id; // Track selected ID
                            searchInput.value = o.title;
                            renderResults(); // Clear results list after selection
                        };
                        resultsList.appendChild(btn);
                    });
                };

                searchInput.oninput = () => renderResults(searchInput.value);
                dialog.appendChild(pickerGroup);

                // Initially show some suggestions if any
                renderResults();

                // Form Fields Dynamic Grid
                const fieldsContainer = document.createElement('div');
                fieldsContainer.style.display = 'grid';
                fieldsContainer.style.gridTemplateColumns = 'repeat(12, 1fr)';
                fieldsContainer.style.gap = '20px';

                const current = this.value || {};

                // Find ORT schema
                const ortConfig = GlobalStateManager.getInstance().getTableConfig('tbl_ort');
                const schema = ortConfig?.schema || [
                    { id: 'title', label: 'Titel', type: 'text' },
                    { id: 'street', label: 'Straße', type: 'text' },
                    { id: 'address_extra', label: 'Adresszusatz', type: 'text' },
                    { id: 'zip_code', label: 'PLZ', type: 'text' },
                    { id: 'city', label: 'Ortschaft', type: 'text' },
                    { id: 'link', label: 'Link', type: 'text' },
                    { id: 'notes', label: 'Notiz', type: 'text' }
                ];

                const renderFields = () => {
                    fieldsContainer.innerHTML = '';
                    schema.forEach((col, index) => {
                        if (['id', 'createdBy', 'createdAt'].includes(col.id)) return;

                        const colSpan = (col.id === 'zip_code') ? 3 : (col.id === 'city' ? 9 : (col.id === 'address_extra' ? 5 : (col.id === 'street' ? 7 : 12)));
                        const isTextArea = col.id === 'notes' || col.id === 'notizen';

                        const group = document.createElement('div');
                        group.className = 'field-group-container';
                        group.style.gridColumn = `span ${colSpan}`;
                        group.style.position = 'relative';

                        const labelRow = document.createElement('div');
                        labelRow.style.display = 'flex';
                        labelRow.style.justifyContent = 'space-between';
                        labelRow.style.alignItems = 'center';
                        labelRow.style.marginBottom = '6px';

                        const lbl = document.createElement('div');
                        lbl.style.fontSize = '12px';
                        lbl.style.fontWeight = '500';
                        lbl.style.color = 'var(--text-secondary)';
                        lbl.textContent = col.label;
                        labelRow.appendChild(lbl);

                        // Rearrange controls removed (part of edit mode)

                        const input = document.createElement(isTextArea ? 'textarea' : 'input');
                        input.className = 'dialog-input';
                        input.style.width = '100%';
                        if (isTextArea) {
                            input.style.minHeight = '80px';
                            input.style.resize = 'vertical';
                        }
                        input.value = inputsMap[col.id]?.value || current[col.id] || '';
                        inputsMap[col.id] = input;

                        group.appendChild(labelRow);
                        group.appendChild(input);
                        fieldsContainer.appendChild(group);
                    });
                };

                renderFields();
                dialog.appendChild(fieldsContainer);

                // Buttons
                const btnContainer = document.createElement('div');
                btnContainer.style.marginTop = '24px';
                btnContainer.style.display = 'flex';
                btnContainer.style.justifyContent = 'flex-end';
                btnContainer.style.gap = '12px';

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'discard-btn-header';
                cancelBtn.textContent = 'Abbrechen';
                btnContainer.appendChild(cancelBtn);

                const saveBtn = document.createElement('button');
                saveBtn.className = 'save-btn-header';
                saveBtn.textContent = 'Speichern & Übernehmen';
                btnContainer.appendChild(saveBtn);

                dialog.appendChild(btnContainer);

                cancelBtn.onclick = cleanup;

                saveBtn.onclick = async () => {
                    const data = {};
                    Object.entries(inputsMap).forEach(([id, input]) => {
                        data[id] = input.value.trim();
                    });

                    if (!data.title) {
                        alert('Der Titel ist erforderlich.');
                        return;
                    }

                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Wird gespeichert...';

                    try {
                        // Sync to supabase 'ort' table
                        const payload = { ...data };
                        let ortResult;

                        if (this.selectedId) {
                            // Update existing
                            const res = await SupabaseClient.patch('ort', `?id=eq.${this.selectedId}`, payload);
                            if (!res.ok) throw new Error('Update failed');
                            ortResult = { ...payload, id: this.selectedId };
                        } else {
                            // Create new
                            const res = await SupabaseClient.post('ort', payload, { 'Prefer': 'return=representation' });
                            if (!res.ok) throw new Error('Insert failed');
                            const inserted = await res.json();
                            ortResult = inserted[0];
                        }

                        // Update the field value and trigger change
                        this.saveEdit(ortResult);
                        cleanup();
                    } catch (e) {
                        console.error('[LocationField] Save failed:', e);
                        alert('Fehler beim Speichern des Ortes.');
                    } finally {
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Speichern & Übernehmen';
                    }
                };
            }
        });
    }
}
