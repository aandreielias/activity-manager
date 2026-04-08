import { Field } from './Field.js';
import { GlobalStateManager } from '../GlobalStateManager.js';

export class TagField extends Field {
    updateDisplay() {
        if (!this.contentWrap) return;
        this.contentWrap.innerHTML = '';

        const rawValue = this.getRawValue();
        if (rawValue === '—' || !rawValue) {
            this.contentWrap.textContent = '—';
            return;
        }

        const tags = rawValue.split(',').map(t => t.trim()).filter(t => t);
        
        tags.forEach(text => {
            const tag = document.createElement('span');
            tag.className = 'inventory-tag available'; // Style like available inventory items
            tag.textContent = text;
            this.contentWrap.appendChild(tag);
        });
    }

    startEditing() {
        this.onEditStart?.();
        this._showPicker();
    }

    async _showPicker() {
        const rawValue = this.getRawValue();
        const currentTags = rawValue === '—' || !rawValue ? [] : rawValue.split(',').map(t => t.trim()).filter(t => t);
        
        const globalState = GlobalStateManager.getInstance();
        let availableTags = this.colDef.availableTags || [];
        
        // If no categories are defined, try to find a matching Postgres Enum or specific table list
        if (availableTags.length === 0) {
            const globalEnums = globalState.getEnumOptionsForColumn(this.colDef.id, this.tableId);
            if (globalEnums) {
                availableTags = globalEnums;
            } else if (this.colDef.id === 'Team') {
                availableTags = ['Aktivitäten'];
            }
        }

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'picker-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'picker-dialog';
            dialog.style.maxWidth = '400px';

            const header = document.createElement('div');
            header.className = 'picker-header';
            header.innerHTML = `<h2>${this.colDef.label} bearbeiten</h2>`;
            dialog.appendChild(header);

            const displayLabel = this.colDef.label;
            let displayLabelPlural = displayLabel.endsWith('e') ? displayLabel : displayLabel + 's';
            let displayLabelSingular = displayLabel.endsWith('e') ? displayLabel.slice(0, -1) : displayLabel;
            let addPrefix = 'Neuen';

            if (displayLabel === 'Spiele') {
                displayLabelPlural = 'Spiele';
                displayLabelSingular = 'Spiel';
                addPrefix = 'Neues';
            }

            const content = document.createElement('div');
            content.className = 'picker-content';
            dialog.appendChild(content);

            let internalSelected = [...currentTags];

            const refreshSelected = () => {
                const existingSection = content.querySelector('.selected-section');
                if (existingSection) existingSection.remove();

                const section = document.createElement('div');
                section.className = 'picker-section selected-section';

                const sectionTitle = document.createElement('div');
                sectionTitle.className = 'picker-section-title';
                sectionTitle.textContent = `Ausgewählte ${displayLabelPlural}`;
                section.appendChild(sectionTitle);

                const list = document.createElement('div');
                list.className = 'picker-list';
                list.style.flexDirection = 'row';
                list.style.flexWrap = 'wrap';

                internalSelected.forEach((text, idx) => {
                    const tagContainer = document.createElement('div');
                    tagContainer.style.display = 'flex';
                    tagContainer.style.alignItems = 'center';
                    tagContainer.style.gap = '4px';
                    tagContainer.className = 'inventory-tag available';
                    tagContainer.style.paddingRight = '4px';

                    const span = document.createElement('span');
                    span.textContent = text;
                    tagContainer.appendChild(span);

                    const removeBtn = document.createElement('span');
                    removeBtn.innerHTML = '✕';
                    removeBtn.style.cursor = 'pointer';
                    removeBtn.style.fontSize = '10px';
                    removeBtn.style.opacity = '0.6';
                    removeBtn.onclick = (e) => {
                        e.stopPropagation();
                        internalSelected.splice(idx, 1);
                        refreshSelected();
                    };
                    tagContainer.appendChild(removeBtn);

                    list.appendChild(tagContainer);
                });

                if (internalSelected.length === 0) {
                    const empty = document.createElement('div');
                    empty.textContent = `Keine ${displayLabelPlural} ausgewählt`;
                    empty.style.color = 'var(--text-muted)';
                    empty.style.fontSize = '13px';
                    list.appendChild(empty);
                }

                section.appendChild(list);
                content.prepend(section);
            };

            // Suggestions Section
            let suggSection = null;
            let suggestionList = null;

            if (availableTags.length > 0) {
                suggSection = document.createElement('div');
                suggSection.className = 'picker-section';
                suggSection.innerHTML = `<div class="picker-section-title">Verfügbare ${displayLabelPlural}</div>`;
                
                suggestionList = document.createElement('div');
                suggestionList.className = 'picker-list';
                suggestionList.style.flexDirection = 'row';
                suggestionList.style.flexWrap = 'wrap';

                availableTags.forEach(text => {
                    const tag = document.createElement('span');
                    tag.className = 'inventory-tag available';
                    tag.style.cursor = 'pointer';
                    tag.textContent = text;
                    tag.onclick = () => {
                        if (!internalSelected.includes(text)) {
                            internalSelected.push(text);
                            refreshSelected();
                        }
                    };
                    suggestionList.appendChild(tag);
                });
                suggSection.appendChild(suggestionList);
                content.appendChild(suggSection);
            }

            const filterSuggestions = (val) => {
                if (!suggestionList) return;
                const search = val.toLowerCase().trim();
                const children = suggestionList.children;
                let foundMatch = false;

                for (let child of children) {
                    const matches = child.textContent.toLowerCase().includes(search);
                    child.style.display = matches ? 'flex' : 'none';
                    if (matches) foundMatch = true;
                }

                if (suggSection) {
                    suggSection.style.display = search.length === 0 || foundMatch ? 'block' : 'none';
                }
            };

            // Custom Add Section (only if not restricted)
            if (this.colDef.id !== 'Team') {
                const addSection = document.createElement('div');
                addSection.className = 'picker-section';
                addSection.innerHTML = `<div class="picker-section-title">${addPrefix} ${displayLabelSingular} hinzufügen</div>`;
                
                const inputGroup = document.createElement('div');
                inputGroup.style.display = 'flex';
                inputGroup.style.gap = '8px';

                const input = document.createElement('input');
                input.className = 'dialog-input';
                input.style.flex = '1';
                input.placeholder = `${displayLabelSingular} Name...`;
                inputGroup.appendChild(input);

                const addBtn = document.createElement('button');
                addBtn.className = 'picker-btn primary';
                addBtn.textContent = 'Hinzufügen';
                inputGroup.appendChild(addBtn);

                addSection.appendChild(inputGroup);
                content.appendChild(addSection);

                const addTag = () => {
                    const val = input.value.trim();
                    if (val && !internalSelected.includes(val)) {
                        internalSelected.push(val);
                        input.value = '';
                        filterSuggestions('');
                        refreshSelected();
                    }
                };
                addBtn.onclick = addTag;
                input.oninput = (e) => filterSuggestions(e.target.value);
                input.onkeydown = (e) => { 
                    if (e.key === 'Enter') { 
                        e.preventDefault(); 
                        addTag(); 
                    } 
                };
            }

            refreshSelected();

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
                const newVal = internalSelected.join(', ') || '—';
                this.onChange?.(this.colDef.id, newVal);
                this.value = newVal;
                this.updateDisplay();
                overlay.remove();
                document.removeEventListener('keydown', onEsc);
            };
        });
    }
}
