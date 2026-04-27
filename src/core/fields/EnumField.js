import { Field } from './Field.js';
import { GlobalStateManager } from '../GlobalStateManager.js';
import { TABLE_NAMES } from '../Constants.js';

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
        
        // Use global options if found, otherwise fallback to column options
        let optionsToUse = globalOptions || (this.colDef.options || []);
        
        // Ensure that if we specifically found a global enum name, we don't accidentally fallback
        // to wrong hardcoded options if the global fetch returns null (though it shouldn't)
        if (globalEnumName && (!globalOptions || globalOptions.length === 0)) {
             // If we expect a global enum but don't have it yet, show a loading/fallback
             if (globalEnumName === 'pe_status_typ') optionsToUse = ['Aktiv', 'Inaktiv'];
        }

        // Requirement: Team-based filtering for responsibility fields in people table
        const isResponsibility = this.colDef.id.toLowerCase().includes('verantwortlich') || this.colDef.id.toLowerCase().includes('responsibility');
        const isPeopleTable = this.tableId && (this.tableId.includes(TABLE_NAMES.PEOPLE) || this.tableId.includes('personen'));

        if (isResponsibility && isPeopleTable && this.row && this.row.data.Team) {
            const personTeams = String(this.row.data.Team).split(',').map(t => t.trim());
            const filteredGroups = globalState.getOptionsForTeams(personTeams, 'category');

            // If no teams matched, fallback to all options
            if (filteredGroups.length > 0) {
                // If 2 teams, use a two-column layout with a vertical line separator
                if (filteredGroups.length === 2) {
                    menu.style.flexDirection = 'row';
                    menu.style.gap = '0';
                    
                    filteredGroups.forEach((group, gIndex) => {
                        const col = document.createElement('div');
                        col.style.display = 'flex';
                        col.style.flexDirection = 'column';
                        col.style.flex = '1';
                        
                        if (gIndex > 0) {
                            col.style.borderLeft = '1px solid var(--border-color)';
                        }
                        
                        group.options.forEach(option => {
                            this._createOptionItem(option, originalValue, textSpan, col);
                        });
                        menu.appendChild(col);
                    });
                } else {
                    filteredGroups.forEach((group, gIndex) => {
                        if (gIndex > 0) {
                            const sep = document.createElement('div');
                            sep.className = 'enum-dropdown-separator';
                            sep.style.height = '1px';
                            sep.style.background = 'var(--border-color)';
                            sep.style.margin = '4px 8px';
                            menu.appendChild(sep);
                        }
                        group.options.forEach(option => {
                            this._createOptionItem(option, originalValue, textSpan, menu);
                        });
                    });
                }
                optionsToUse = [];
            }
        }

        optionsToUse.forEach(option => {
            this._createOptionItem(option, originalValue, textSpan, menu);
        });


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
            const isPeople = this.tableId && (
                this.tableId.includes(TABLE_NAMES.PEOPLE) || 
                this.tableId.includes('personen') || 
                this.tableId.includes('people') ||
                this.tableId.includes('pe_')
            );
            if (isPeople) return 'pe_status_typ';
            return 'ev_status_enum';
        }
        if (id === 'role' || id === 'rolle') return 'pe_rolle_typ';
        if (id === 'location' || id === 'ort') return 'st_ort_typ';
        if (id === 'category' || id === 'kategorie') {
            if (this.tableId && this.tableId.includes(TABLE_NAMES.INVENTORY)) return 'in_kategorie_typ';
            return 'ak_kategorie_typ';
        }
        if (id === 'condition' || id === 'zustand') return 'in_zustand_typ';
        if (id.includes('responsibility') || id.includes('verantwortlich') || id.includes('zuständig')) {
            return 'ak_kategorie_typ';
        }
        if (id === 'type' || id === 'typ') {
            if (this.tableId && this.tableId.includes(TABLE_NAMES.INVENTORY)) return 'in_zustand_typ';
            if (this.tableId && this.tableId.includes(TABLE_NAMES.PEOPLE)) return 'pe_rolle_typ';
            if (this.tableId && (this.tableId === `tbl_${TABLE_NAMES.USERS}` || this.tableId === TABLE_NAMES.USERS)) return 'pe_rolle_typ';
            if (this.tableId && (this.tableId.includes('sport') || this.tableId.includes(TABLE_NAMES.SPORT_VENUES))) return 'sp_typ_enum';
        }
        if (id === 'indoor_outdoor' || id === 'umgebung') return 'st_umgebung_typ';
        return null;
    }

    _createOptionItem(option, originalValue, textSpan, menu) {
        const item = document.createElement('button');
        item.className = 'enum-dropdown-item';
        item.type = 'button';

        const isObject = typeof option === 'object' && option !== null;
        const value = isObject ? option.value : option;
        const label = isObject ? option.label : option;

        item.dataset.value = value;
        item.textContent = label;
        const isMatch = String(value).toLowerCase().trim() === String(originalValue).toLowerCase().trim();
        if (isMatch) {
            item.style.color = 'var(--accent)';
            item.style.fontWeight = '600';
            textSpan.textContent = label;
        }
        menu.appendChild(item);
        return item;
    }
}
