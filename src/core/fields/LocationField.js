import { Field } from './Field.js';
import { GlobalStateManager } from '../GlobalStateManager.js';
import { SupabaseClient } from '../../services/SupabaseClient.js';
import { Dialog } from '../../ui/Dialog.js';

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
        const globalState = GlobalStateManager.getInstance();
        if (!globalState.canEditColumn(this.tableId, this.colDef.id)) return;

        this._showLocationDialog();
    }

    async _showLocationDialog() {
        // Fetch all locations for the selector
        const res = await SupabaseClient.get('ort', '?select=*&order=title.asc');
        let orte = [];
        if (res.ok) orte = await res.json();
        
        this.selectedId = this.value?.id || null;

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay';
            overlay.style.zIndex = '1000';

            const dialog = document.createElement('div');
            dialog.className = 'custom-dialog';
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

            const subheader = document.createElement('div');
            subheader.style.fontSize = '13px';
            subheader.style.color = 'var(--text-muted)';
            subheader.style.marginBottom = '24px';
            subheader.textContent = 'Geben Sie eine neue Adresse ein oder wählen Sie einen bestehenden Ort.';
            dialog.appendChild(subheader);

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

            const searchInput = document.createElement('input');
            searchInput.className = 'dialog-input';
            searchInput.placeholder = 'Nach Titel oder Adresse suchen...';
            searchInput.style.width = '100%';
            searchInput.style.marginBottom = '8px';
            pickerGroup.appendChild(searchInput);

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

            // Form Fields Grid
            const fieldsContainer = document.createElement('div');
            fieldsContainer.style.display = 'grid';
            fieldsContainer.style.gridTemplateColumns = 'repeat(12, 1fr)';
            fieldsContainer.style.gap = '20px';

            const createFieldGroup = (label, id, value = '', colSpan = 12, isTextArea = false) => {
                const group = document.createElement('div');
                group.style.gridColumn = `span ${colSpan}`;
                
                const lbl = document.createElement('div');
                lbl.style.fontSize = '12px';
                lbl.style.fontWeight = '500';
                lbl.style.marginBottom = '6px';
                lbl.style.color = 'var(--text-secondary)';
                lbl.textContent = label;
                
                const input = document.createElement(isTextArea ? 'textarea' : 'input');
                input.className = 'dialog-input';
                input.style.width = '100%';
                if (isTextArea) {
                    input.style.minHeight = '80px';
                    input.style.resize = 'vertical';
                }
                input.value = value || '';
                input.dataset.fieldId = id;
                
                group.appendChild(lbl);
                group.appendChild(input);
                return { group, input };
            };

            const current = this.value || {};
            const inputsMap = {};

            // Title - Row 1
            const titleRow = createFieldGroup('Titel / Name des Ortes', 'title', current.title, 12);
            fieldsContainer.appendChild(titleRow.group);
            inputsMap.title = titleRow.input;

            // Street & Extra - Row 2
            const streetCol = createFieldGroup('Straße & Hausnummer', 'street', current.street, 7);
            const extraCol = createFieldGroup('Adresszusatz', 'address_extra', current.address_extra, 5);
            fieldsContainer.appendChild(streetCol.group);
            fieldsContainer.appendChild(extraCol.group);
            inputsMap.street = streetCol.input;
            inputsMap.address_extra = extraCol.input;

            // ZIP & City - Row 3
            const zipCol = createFieldGroup('PLZ', 'zip_code', current.zip_code, 3);
            const cityCol = createFieldGroup('Ortschaft', 'city', current.city, 9);
            fieldsContainer.appendChild(zipCol.group);
            fieldsContainer.appendChild(cityCol.group);
            inputsMap.zip_code = zipCol.input;
            inputsMap.city = cityCol.input;

            // Link - Row 4
            const linkRow = createFieldGroup('Link (Webseite / Google Maps)', 'link', current.link, 12);
            fieldsContainer.appendChild(linkRow.group);
            inputsMap.link = linkRow.input;

            // Notes - Row 5
            const notesRow = createFieldGroup('Notizen / Besonderheiten', 'notes', current.notes, 12, true);
            fieldsContainer.appendChild(notesRow.group);
            inputsMap.notes = notesRow.input;

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
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const cleanup = () => overlay.remove();

            cancelBtn.onclick = cleanup;
            overlay.onclick = (e) => { if (e.target === overlay) cleanup(); };

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
        });
    }
}
