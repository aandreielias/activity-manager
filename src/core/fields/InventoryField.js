import { Field } from './Field.js';
import { GlobalStateManager } from '../GlobalStateManager.js';

export class InventoryField extends Field {
    updateDisplay() {
        if (!this.contentWrap) return;
        this.contentWrap.innerHTML = '';

        const rawValue = this.getRawValue();
        if (rawValue === '—' || !rawValue) {
            this.contentWrap.textContent = '—';
            return;
        }

        // Parse items like "Sessel (3), Tisch (Spieler -1)"
        const items = this._parseItems(rawValue);
        const inventory = GlobalStateManager.getInstance().getInventory();
        const inventoryNames = inventory.map(row => (row.data?.name || '').toLowerCase());

        items.forEach(item => {
            const tag = document.createElement('span');
            const isAvailable = inventoryNames.includes(item.name.toLowerCase());

            tag.className = `inventory-tag ${isAvailable ? 'available' : 'unavailable'}`;
            tag.textContent = item.quantity ? `${item.name} (${item.quantity})` : item.name;
            this.contentWrap.appendChild(tag);
        });
    }

    _parseItems(rawValue) {
        if (!rawValue || rawValue === '—') return [];
        return rawValue.split(',').map(s => {
            const match = s.match(/(.+?)\s*\((.+?)\)/);
            if (match) {
                return { name: match[1].trim(), quantity: match[2].trim() };
            }
            return { name: s.trim(), quantity: '' };
        }).filter(item => item.name);
    }

    startEditing() {
        this.onEditStart?.();
        this._showPicker();
    }

    async _showPicker() {
        const globalState = GlobalStateManager.getInstance();
        const inventory = globalState.getInventory();
        const currentItems = this._parseItems(this.getRawValue());

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'permission-overlay'; // Reuse for blur and centering
            overlay.style.zIndex = '10000';

            const dialog = document.createElement('div');
            dialog.className = 'permission-dialog inventory-picker-window';
            dialog.style.maxWidth = '480px';
            dialog.style.maxHeight = '90vh';

            const title = document.createElement('h2');
            title.textContent = 'Gegenstände auswählen';
            dialog.appendChild(title);

            // Container for vertical layout
            const scrollContainer = document.createElement('div');
            scrollContainer.className = 'permission-container';
            dialog.appendChild(scrollContainer);

            let internalSelected = [...currentItems.map(i => ({ ...i }))];

            const refreshSelected = () => {
                const existingSection = scrollContainer.querySelector('.selected-items-section');
                if (existingSection) existingSection.remove();

                const section = document.createElement('div');
                section.className = 'person-permission-section selected-items-section';
                section.style.background = 'var(--bg)';

                const sectionTitle = document.createElement('div');
                sectionTitle.className = 'person-name';
                sectionTitle.textContent = 'Gewählte Gegenstände';
                sectionTitle.style.marginBottom = '12px';
                section.appendChild(sectionTitle);

                const list = document.createElement('div');
                list.style.display = 'flex';
                list.style.flexDirection = 'column';
                list.style.gap = '8px';

                const inventoryNames = inventory.map(row => (row.data?.name || '').toLowerCase());

                internalSelected.forEach((item, idx) => {
                    const row = document.createElement('div');
                    row.className = 'inventory-picker-row';
                    row.style.display = 'grid';
                    row.style.gridTemplateColumns = '1fr 120px auto';
                    row.style.alignItems = 'center';
                    row.style.gap = '12px';
                    row.style.padding = '8px';
                    row.style.borderRadius = 'var(--radius)';
                    row.style.border = '1px solid var(--border-light)';
                    row.style.background = 'var(--bg-secondary)';

                    const isAvailable = inventoryNames.includes(item.name.toLowerCase());
                    const tag = document.createElement('span');
                    tag.className = `inventory-tag ${isAvailable ? 'available' : 'unavailable'}`;
                    tag.textContent = item.name;
                    tag.style.justifySelf = 'start';
                    row.appendChild(tag);

                    const qInput = document.createElement('input');
                    qInput.type = 'text';
                    qInput.placeholder = 'Anzahl';
                    qInput.value = item.quantity;
                    qInput.className = 'dialog-input'; // Use standard dialog input styling
                    qInput.style.width = '100%';
                    qInput.style.fontSize = '12px';
                    qInput.style.padding = '6px 12px';
                    qInput.style.borderRadius = 'var(--radius)'; // Standard rounding
                    qInput.style.border = '1px solid var(--border-light)'; // Light border
                    qInput.style.outline = 'none';
                    qInput.oninput = () => { item.quantity = qInput.value; };
                    row.appendChild(qInput);

                    const removeBtn = document.createElement('button');
                    removeBtn.innerHTML = '✕';
                    removeBtn.className = 'footer-btn cancel';
                    removeBtn.style.padding = '0';
                    removeBtn.style.borderRadius = 'var(--radius-sm)'; // Standard small rounding
                    removeBtn.style.width = '28px';
                    removeBtn.style.height = '28px';
                    removeBtn.style.display = 'flex';
                    removeBtn.style.alignItems = 'center';
                    removeBtn.style.justifyContent = 'center';
                    removeBtn.style.border = '1px solid var(--border-light)';
                    removeBtn.style.fontSize = '12px';
                    removeBtn.style.flexShrink = '0';
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
                scrollContainer.prepend(section);
            };

            // Search / Add New
            const searchSection = document.createElement('div');
            searchSection.className = 'person-permission-section';

            const searchTitle = document.createElement('div');
            searchTitle.className = 'person-name';
            searchTitle.textContent = 'Gegenstand hinzufügen';
            searchTitle.style.marginBottom = '8px';
            searchSection.appendChild(searchTitle);

            const inputGroup = document.createElement('div');
            inputGroup.style.display = 'flex';
            inputGroup.style.gap = '8px';

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '';
            input.className = 'dialog-input';
            input.style.flex = '1';
            input.style.borderRadius = 'var(--radius)';
            input.style.border = '1px solid var(--border-light)';
            input.style.padding = '8px 16px';
            input.style.outline = 'none';
            inputGroup.appendChild(input);

            const addBtn = document.createElement('button');
            addBtn.className = 'save-btn-header';
            addBtn.textContent = 'Hinzufügen';
            addBtn.style.fontSize = '12px';
            addBtn.style.borderRadius = 'var(--radius-sm)';
            inputGroup.appendChild(addBtn);

            searchSection.appendChild(inputGroup);
            scrollContainer.appendChild(searchSection);

            // Inventory List Section
            const invSection = document.createElement('div');
            invSection.className = 'person-permission-section';

            const invTitle = document.createElement('div');
            invTitle.className = 'person-name';
            invTitle.textContent = 'Inventar';
            invTitle.style.marginBottom = '8px';
            invSection.appendChild(invTitle);

            const invList = document.createElement('div');
            invList.className = 'specific-tables-container';
            invList.style.display = 'flex';
            invList.style.flexDirection = 'column';
            invList.style.maxHeight = '200px';
            invList.style.overflowY = 'auto';
            invSection.appendChild(invList);

            const refreshInventorySuggestions = (query = '') => {
                invList.innerHTML = '';
                const filtered = inventory.filter(row => {
                    const name = (row.data?.name || '').toLowerCase();
                    return name.includes(query.toLowerCase());
                });

                if (filtered.length === 0) {
                    const noResults = document.createElement('div');
                    noResults.textContent = 'Keine Treffer im Inventar';
                    noResults.style.padding = '8px 12px';
                    noResults.style.color = 'var(--text-muted)';
                    noResults.style.fontSize = '13px';
                    invList.appendChild(noResults);
                    return;
                }

                filtered.forEach(row => {
                    const name = row.data?.name || 'Unbekannt';
                    const quantity = row.data?.quantity || 0;
                    
                    const btn = document.createElement('button');
                    btn.className = 'suggestion-item';
                    btn.style.textAlign = 'left';
                    btn.style.border = 'none';
                    btn.style.background = 'transparent';
                    btn.style.padding = '8px 12px';
                    btn.style.borderRadius = 'var(--radius-sm)';
                    btn.style.fontSize = '13px';
                    btn.style.display = 'flex';
                    btn.style.justifyContent = 'space-between';
                    btn.innerHTML = `<span>${name}</span> <span style="color:var(--text-muted)">(${quantity})</span>`;

                    btn.onclick = () => {
                        if (!internalSelected.find(i => i.name === name)) {
                            internalSelected.push({ name: name, quantity: '' });
                            refreshSelected();
                        }
                    };
                    invList.appendChild(btn);
                });
            };

            scrollContainer.appendChild(invSection);

            input.oninput = () => {
                refreshInventorySuggestions(input.value.trim());
            };

            refreshSelected();
            refreshInventorySuggestions();

            const addItem = () => {
                const val = input.value.trim();
                if (val && !internalSelected.find(i => i.name === val)) {
                    internalSelected.push({ name: val, quantity: '' });
                    input.value = '';
                    refreshSelected();
                    refreshInventorySuggestions();
                }
            };

            addBtn.onclick = addItem;
            input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } };

            // Footer
            const footer = document.createElement('div');
            footer.className = 'dialog-footer';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'footer-btn cancel';
            cancelBtn.textContent = 'Abbrechen';
            cancelBtn.style.borderRadius = 'var(--radius-sm)';
            footer.appendChild(cancelBtn);

            const saveBtn = document.createElement('button');
            saveBtn.className = 'footer-btn save';
            saveBtn.textContent = 'Speichern';
            saveBtn.style.borderRadius = 'var(--radius-sm)';
            footer.appendChild(saveBtn);

            dialog.appendChild(footer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            setTimeout(() => input.focus(), 50);

            cancelBtn.onclick = () => overlay.remove();
            saveBtn.onclick = () => {
                const newVal = internalSelected
                    .map(i => i.quantity ? `${i.name} (${i.quantity})` : i.name)
                    .join(', ') || '—';
                this.onChange?.(this.colDef.id, newVal);
                this.value = newVal;
                this.updateDisplay();
                overlay.remove();
            };
        });
    }
}
