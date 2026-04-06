import { Field } from './Field.js';
import { GlobalStateManager } from '../GlobalStateManager.js';

export class EnumField extends Field {
    createEditor() {
        const originalValue = this.getRawValue();
        const container = document.createElement('div');
        container.className = 'custom-enum-dropdown';
        container._isFixedPositioning = true;
        container.isEnumDropdown = true;

        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'custom-enum-dropdown-wrapper';

        const button = document.createElement('button');
        button.className = 'enum-dropdown-btn';
        button.type = 'button';

        const textSpan = document.createElement('span');
        textSpan.className = 'enum-dropdown-btn-text';

        const arrowSpan = document.createElement('span');
        arrowSpan.textContent = '▼';
        arrowSpan.className = 'enum-dropdown-btn-arrow';

        button.appendChild(textSpan);
        button.appendChild(arrowSpan);

        const menu = document.createElement('div');
        menu.className = 'enum-dropdown-menu';

        const globalState = GlobalStateManager.getInstance();
        const globalEnumName = this._getEnumNameForColumn(this.colDef.id);
        const globalOptions = globalEnumName ? globalState.getEnumOptions(globalEnumName) : null;
        const optionsToUse = globalOptions || (this.colDef.options || []);

        optionsToUse.forEach(option => {
            const item = document.createElement('button');
            item.className = 'enum-dropdown-item';
            item.type = 'button';

            const isObject = typeof option === 'object' && option !== null;
            const value = isObject ? option.value : option;
            const label = isObject ? option.label : option;

            item.dataset.value = value;
            item.textContent = label;
            if (value === originalValue) {
                item.style.color = 'var(--accent)';
                item.style.fontWeight = '600';
                textSpan.textContent = label;
            }
            menu.appendChild(item);
        });

        // Edit Mode: Add new option button
        if (globalState.isEditModeActive() && globalEnumName) {
            const separator = document.createElement('div');
            separator.className = 'context-menu-separator';
            menu.appendChild(separator);

            const addBtn = document.createElement('button');
            addBtn.className = 'enum-dropdown-item add-enum-option-btn';
            addBtn.innerHTML = '<span style="color:var(--warning)">+ Option hinzufügen</span>';
            addBtn.style.fontStyle = 'italic';
            addBtn.onclick = async (e) => {
                 e.stopPropagation();
                 const newValue = prompt(`Neue Auswahl für '${this.colDef.label}' (${globalEnumName}):`);
                 if (newValue && newValue.trim()) {
                    try {
                        await globalState.addEnumOption(globalEnumName, newValue.trim());
                        container.closeMenu();
                    } catch (err) {
                        alert(`Fehler: ${err.message}`);
                    }
                }
            };
            menu.appendChild(addBtn);
        }

        if (!textSpan.textContent) {
            textSpan.textContent = '-- Auswählen --';
        }

        const updateMenuPosition = () => {
            const rect = button.getBoundingClientRect();
            menu.style.position = 'fixed';
            menu.style.top = `${rect.bottom + 2}px`;
            menu.style.left = `${rect.left}px`;
            menu.style.minWidth = `${rect.width}px`;
        };

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.style.display === 'flex';
            if (isOpen) {
                menu.style.display = 'none';
                arrowSpan.style.transform = 'rotate(0deg)';
                button.style.boxShadow = 'none';
            } else {
                updateMenuPosition();
                menu.style.display = 'flex';
                arrowSpan.style.transform = 'rotate(180deg)';
                button.style.boxShadow = '0 0 0 3px var(--accent-light)';
            }
        });

        const handleScrollOrResize = () => {
            if (menu.style.display === 'flex') {
                updateMenuPosition();
            }
        };
        window.addEventListener('resize', handleScrollOrResize);
        document.addEventListener('scroll', handleScrollOrResize, true);

        let onItemSelected = null;
        menu.addEventListener('click', (e) => {
            if (e.target.classList.contains('enum-dropdown-item')) {
                const value = e.target.dataset.value;
                const label = e.target.textContent;
                textSpan.textContent = label;
                button.dataset.value = value;
                menu.style.display = 'none';
                arrowSpan.style.transform = 'rotate(0deg)';
                button.style.boxShadow = 'none';

                if (onItemSelected) {
                    onItemSelected();
                }
            }
        });

        buttonWrapper.appendChild(button);
        document.body.appendChild(menu); // Append to body to escape overflow: auto parents
        container.appendChild(buttonWrapper);

        container.getValue = () => button.dataset.value || '';
        container.closeMenu = () => {
            menu.style.display = 'none';
            arrowSpan.style.transform = 'rotate(0deg)';
            button.style.boxShadow = 'none';
        };
        container.setSelectionCallback = (callback) => {
            onItemSelected = callback;
        };
        container.destroy = () => {
            menu.remove();
            window.removeEventListener('resize', handleScrollOrResize);
            document.removeEventListener('scroll', handleScrollOrResize, true);
        };

        return container;
    }

    attachEditorListeners(editor, finishCallback) {
        editor.setSelectionCallback(() => {
            document.removeEventListener('click', handleOutsideClick);
            document.removeEventListener('keydown', handleKeyDown);
            finishCallback(true);
        });

        const handleOutsideClick = (e) => {
            if (!editor.contains(e.target) && !this.td.contains(e.target)) {
                // Determine if we clicked inside the body-mounted menu
                let clickedMenu = false;
                if (e.target.closest('.enum-dropdown-menu')) {
                    clickedMenu = true;
                }
                
                if (!clickedMenu) {
                    document.removeEventListener('click', handleOutsideClick);
                    document.removeEventListener('keydown', handleKeyDown);
                    finishCallback(false);
                }
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('click', handleOutsideClick);
                document.removeEventListener('keydown', handleKeyDown);
                editor.closeMenu();
                finishCallback(false);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                document.removeEventListener('click', handleOutsideClick);
                document.removeEventListener('keydown', handleKeyDown);
                editor.closeMenu();
                finishCallback(true, true); // save=true, advance=true
            }
        };

        document.addEventListener('click', handleOutsideClick);
        document.addEventListener('keydown', handleKeyDown);
    }

    extractValue(editor) {
        return editor.getValue().trim() || '—';
    }

    finishEditing(editor) {
        super.finishEditing(editor);
        if (editor.destroy) {
            editor.destroy();
        }
    }

    _getEnumNameForColumn(colId) {
        const id = colId.toLowerCase();
        if (id === 'status' || id === 'Status') {
            if (this.tableId === 'tbl_people') return 'status_enum';
            return 'task_status_enum';
        }
        if (id === 'role' || id === 'rolle') return 'rolle_enum';
        if (id === 'location' || id === 'ort') return 'location_enum';
        if (id === 'category' || id === 'kategorie') return 'activity_category_enum';
        if (id === 'condition' || id === 'zustand') return 'condition_enum';
        if (id === 'type' || id === 'typ') {
            // Need table context here or common guess
            if (this.tableId === 'tbl_inventory') return 'condition_enum';
            if (this.tableId === 'tbl_people') return 'rolle_enum';
            if (this.tableId === 'tbl_users' || this.tableId === 'users') return 'rolle_enum';
            if (this.tableId.includes('sport')) return 'venue_type_enum';
        }
        if (id === 'indoor_outdoor') return 'indoor_outdoor_enum';
        return null;
    }
}
