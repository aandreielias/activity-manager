import { Field } from './Field.js';
import { GlobalStateManager } from '../GlobalStateManager.js';
import { InventoryService } from '../../services/InventoryService.js';
import { Tooltip } from '../../ui/Tooltip.js';
import { TooltipGenerator } from '../../utils/TooltipGenerator.js';

export class InventoryField extends Field {
    updateDisplay() {
        if (!this.contentWrap) return;
        this.contentWrap.innerHTML = '';

        const rawValue = this.getRawValue();
        if (rawValue === '—' || !rawValue) {
            this.contentWrap.textContent = '—';
            return;
        }

        const globalState = GlobalStateManager.getInstance();
        const inventory = globalState.getInventory();

        const items = InventoryService.parseInventoryString(rawValue);
        items.forEach(item => {
            const validation = InventoryService.validateAvailability(item.name, item.quantity);
            const tag = document.createElement('span');
            tag.className = `inventory-tag ${validation.status}`;
            tag.textContent = item.quantity ? `${item.name} (${item.quantity})` : item.name;
            tag.style.cursor = 'pointer';
            
            // Attach tooltip for this specific item
            const invItem = inventory.find(r => (r.data?.name || '').toLowerCase() === item.name.toLowerCase());
            if (invItem) {
                const html = TooltipGenerator.generateInventoryTooltip(invItem.data);
                const condition = () => !this.td?.classList.contains('editing');
                Tooltip.attach(tag, html, 400, condition);
            }
            
            this.contentWrap.appendChild(tag);
        });
    }

    // Helper methods moved to InventoryService ──────────────────────

    startEditing() {
        this.onEditStart?.();
        this._showPicker();
    }

    async _showPicker() {
        const globalState = GlobalStateManager.getInstance();
        const inventory = globalState.getInventory();
        const currentItems = InventoryService.parseInventoryString(this.getRawValue());

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'picker-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'picker-dialog';
            dialog.style.maxWidth = '500px';

            const header = document.createElement('div');
            header.className = 'picker-header';
            header.innerHTML = '<h2>Gegenstände auswählen</h2>';
            dialog.appendChild(header);

            const content = document.createElement('div');
            content.className = 'picker-content';
            dialog.appendChild(content);

            let internalSelected = [...currentItems.map(i => ({ ...i }))];

            const refreshSelected = () => {
                const existingSection = content.querySelector('.selected-section');
                if (existingSection) existingSection.remove();

                const section = document.createElement('div');
                section.className = 'picker-section selected-section';

                const sectionTitle = document.createElement('div');
                sectionTitle.className = 'picker-section-title';
                sectionTitle.textContent = 'Gewählte Gegenstände';
                section.appendChild(sectionTitle);

                const list = document.createElement('div');
                list.className = 'picker-list';

                internalSelected.forEach((item, idx) => {
                    const row = document.createElement('div');
                    row.className = 'picker-row';
                    row.style.gridTemplateColumns = '1fr 100px auto';

                    const invItem = inventory.find(r => (r.data?.name || '').toLowerCase() === item.name.toLowerCase());
                    const invQuantityAvailable = invItem ? parseInt(invItem.data?.quantity || 0, 10) : 0;
                    const isAvailable = !!invItem;

                    const nameCol = document.createElement('div');
                    nameCol.style.display = 'flex';
                    nameCol.style.flexDirection = 'column';

                    const tag = document.createElement('span');
                    tag.className = 'inventory-tag';
                    tag.textContent = item.name;
                    tag.style.alignSelf = 'start';
                    nameCol.appendChild(tag);

                    const errorMsg = document.createElement('div');
                    errorMsg.style.color = 'var(--error)';
                    errorMsg.style.fontSize = '9px';
                    errorMsg.style.marginTop = '2px';
                    nameCol.appendChild(errorMsg);

                    const updateErrors = () => {
                        const validation = InventoryService.validateAvailability(item.name, item.quantity);
                        errorMsg.textContent = validation.message;
                        tag.className = `inventory-tag ${validation.status}`;
                    };

                    row.appendChild(nameCol);

                    const qInput = document.createElement('input');
                    qInput.type = 'text';
                    qInput.placeholder = 'Anzahl';
                    qInput.value = item.quantity;
                    qInput.className = 'dialog-input';
                    qInput.style.width = '100%';
                    qInput.oninput = () => {
                        item.quantity = qInput.value;
                        updateErrors();
                    };
                    row.appendChild(qInput);

                    updateErrors();

                    const removeBtn = document.createElement('button');
                    removeBtn.innerHTML = '✕';
                    removeBtn.className = 'picker-btn secondary';
                    removeBtn.style.padding = '0';
                    removeBtn.style.width = '28px';
                    removeBtn.style.height = '28px';
                    removeBtn.onclick = () => {
                        internalSelected.splice(idx, 1);
                        refreshSelected();
                    };
                    row.appendChild(removeBtn);

                    list.appendChild(row);
                });

                if (internalSelected.length === 0) {
                    const empty = document.createElement('div');
                    empty.textContent = 'Keine Gegenstände gewählt';
                    empty.style.color = 'var(--text-muted)';
                    empty.style.fontSize = '13px';
                    empty.style.textAlign = 'center';
                    empty.style.padding = '12px';
                    list.appendChild(empty);
                }

                section.appendChild(list);
                content.prepend(section);
            };

            // Add Section
            const addSection = document.createElement('div');
            addSection.className = 'picker-section';
            addSection.innerHTML = '<div class="picker-section-title">Gegenstand hinzufügen</div>';

            const inputGroup = document.createElement('div');
            inputGroup.style.display = 'flex';
            inputGroup.style.gap = '8px';

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Name eingeben...';
            input.className = 'dialog-input';
            input.style.flex = '1';
            inputGroup.appendChild(input);

            const addBtn = document.createElement('button');
            addBtn.className = 'picker-btn primary';
            addBtn.textContent = 'Hinzufügen';
            inputGroup.appendChild(addBtn);

            addSection.appendChild(inputGroup);
            content.appendChild(addSection);

            // Inventory List Section
            const invSection = document.createElement('div');
            invSection.className = 'picker-section';
            invSection.innerHTML = '<div class="picker-section-title">Vorschläge aus Inventar</div>';

            const invList = document.createElement('div');
            invList.className = 'picker-list';
            invList.style.maxHeight = '180px';
            invList.style.overflowY = 'auto';
            invSection.appendChild(invList);

            const refreshSuggestions = (query = '') => {
                invList.innerHTML = '';
                const filtered = inventory.filter(row => {
                    const name = (row.data?.name || '').toLowerCase();
                    return name.includes(query.toLowerCase());
                });

                if (filtered.length === 0) {
                    const noResults = document.createElement('div');
                    noResults.textContent = 'Keine Treffer';
                    noResults.style.padding = '8px';
                    noResults.style.color = 'var(--text-muted)';
                    noResults.style.fontSize = '12px';
                    invList.appendChild(noResults);
                    return;
                }

                filtered.forEach(row => {
                    const name = row.data?.name || 'Unbekannt';
                    const btn = document.createElement('button');
                    btn.className = 'suggestion-item';
                    btn.style.textAlign = 'left';
                    btn.style.padding = '8px 12px';
                    btn.style.fontSize = '13px';
                    btn.style.border = '1px solid var(--border-light)';
                    btn.style.borderRadius = 'var(--radius-sm)';
                    btn.style.background = 'var(--bg)';
                    btn.style.cursor = 'pointer';
                    btn.innerHTML = `${name} <span style="float:right; color:var(--text-muted); font-size:11px;">(${row.data?.quantity || 0})</span>`;

                    btn.onclick = () => {
                        if (!internalSelected.find(i => i.name === name)) {
                            internalSelected.push({ name: name, quantity: '' });
                            refreshSelected();
                        }
                    };
                    invList.appendChild(btn);
                });
            };

            content.appendChild(invSection);

            input.oninput = () => refreshSuggestions(input.value.trim());
            refreshSelected();
            refreshSuggestions();

            const addItem = () => {
                const val = input.value.trim();
                if (val && !internalSelected.find(i => i.name === val)) {
                    internalSelected.push({ name: val, quantity: '' });
                    input.value = '';
                    refreshSelected();
                    refreshSuggestions();
                }
            };

            addBtn.onclick = addItem;
            input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } };

            // Footer
            const footer = document.createElement('div');
            footer.className = 'picker-footer';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'picker-btn secondary';
            cancelBtn.textContent = 'Abbrechen';
            footer.appendChild(cancelBtn);

            const saveBtn = document.createElement('button');
            saveBtn.className = 'picker-btn primary';
            saveBtn.textContent = 'Speichern';
            footer.appendChild(saveBtn);

            dialog.appendChild(footer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            setTimeout(() => input.focus(), 50);

            // Esc Key support
            const onEsc = (e) => {
                if (e.key === 'Escape') {
                    overlay.remove();
                    document.removeEventListener('keydown', onEsc);
                }
            };
            document.addEventListener('keydown', onEsc);

            overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); document.removeEventListener('keydown', onEsc); } };
            cancelBtn.onclick = () => { overlay.remove(); document.removeEventListener('keydown', onEsc); };
            saveBtn.onclick = () => {
                const newVal = InventoryService.formatInventoryString(internalSelected);
                this.onChange?.(this.colDef.id, newVal);
                this.value = newVal;
                this.updateDisplay();
                overlay.remove();
                document.removeEventListener('keydown', onEsc);
            };
        });
    }
}
