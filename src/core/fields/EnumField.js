import { Field } from './Field.js';

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

        const emptyItem = document.createElement('button');
        emptyItem.className = 'enum-dropdown-item';
        emptyItem.type = 'button';
        emptyItem.dataset.value = '';
        emptyItem.textContent = '-- Auswählen --';
        if (!originalValue || originalValue === '—') emptyItem.style.color = 'var(--accent)';
        menu.appendChild(emptyItem);

        (this.colDef.options || []).forEach(option => {
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
        let isFinishing = false;

        editor.setSelectionCallback(() => {
            if (!isFinishing) {
                isFinishing = true;
                document.removeEventListener('click', handleOutsideClick);
                document.removeEventListener('keydown', handleEscapeKey);
                finishCallback(true);
            }
        });

        const handleOutsideClick = (e) => {
            if (!isFinishing && !editor.contains(e.target) && !this.td.contains(e.target)) {
                // Determine if we clicked inside the body-mounted menu
                let clickedMenu = false;
                if (e.target.closest('.enum-dropdown-menu')) {
                    clickedMenu = true;
                }
                
                if (!clickedMenu) {
                    document.removeEventListener('click', handleOutsideClick);
                    document.removeEventListener('keydown', handleEscapeKey);
                    isFinishing = true;
                    finishCallback(false);
                }
            }
        };

        const handleEscapeKey = (e) => {
            if (e.key === 'Escape' && !isFinishing) {
                document.removeEventListener('click', handleOutsideClick);
                document.removeEventListener('keydown', handleEscapeKey);
                isFinishing = true;
                editor.closeMenu();
                finishCallback(false);
            }
        };

        document.addEventListener('click', handleOutsideClick);
        document.addEventListener('keydown', handleEscapeKey);
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
}
