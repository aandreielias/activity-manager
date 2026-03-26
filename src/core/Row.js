import { Field } from './Field.js';

// Module-level drag state — accessible across all rows
let activeDrag = null;

/**
 * ContextMenu - Manages right-click context menu for rows
 */
class ContextMenu {
    constructor() {
        this.element = null;
    }

    show(x, y, onDelete) {
        this.close();
        
        this.element = document.createElement('div');
        this.element.className = 'row-context-menu';
        this.element.style.cssText = `
            position: fixed;
            top: ${Math.min(y, window.innerHeight - 100)}px;
            left: ${Math.min(x, window.innerWidth - 160)}px;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            box-shadow: var(--shadow-md);
            z-index: 10000;
            min-width: 150px;
        `;

        const deleteItem = this._createMenuItem('Delete row', () => {
            this.close();
            if (confirm('Delete this row?')) {
                onDelete?.();
            }
        });
        deleteItem.classList.add('context-menu-delete');

        this.element.appendChild(deleteItem);
        document.body.appendChild(this.element);

        // Close on click outside
        const handleClickOutside = (e) => {
            if (!this.element?.contains(e.target)) {
                this.close();
            }
        };

        document.addEventListener('click', handleClickOutside, { once: true });
    }

    _createMenuItem(label, onClickCallback) {
        const item = document.createElement('button');
        item.className = 'context-menu-item';
        item.textContent = label;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            onClickCallback();
        });
        return item;
    }

    close() {
        this.element?.remove();
        this.element = null;
    }
}

const contextMenu = new ContextMenu();

/**
 * Row - Represents a single table row with cells and interactions
 */
export class Row {
    constructor({ id, data, schema, peopleData }) {
        this.id           = id;
        this.data         = data;
        this.schema       = schema;
        this.peopleData   = peopleData;
        this.fields       = this._buildFields();
        this.element      = null;
        this.callbacks    = {};
    }

    _buildFields() {
        const fields = {};
        this.schema.forEach(col => {
            fields[col.id] = new Field({
                id:      `${this.id}__${col.id}`,
                label:   col.label,
                type:    col.type,
                accepts: col.accepts ?? [],
                options: col.options ?? [],
            });
        });
        return fields;
    }

    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    render() {
        this.element = document.createElement('tr');
        this.element.dataset.rowId = this.id;

        this.element.appendChild(this._renderHandle());
        this.schema.forEach(col => {
            this.element.appendChild(this._renderCell(col));
        });

        this._attachRowListeners();
        return this.element;
    }

    _attachRowListeners() {
        // Context menu
        this.element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            contextMenu.show(e.clientX, e.clientY, () => {
                this.callbacks.onDelete?.(this.id);
            });
        });

        // Drag and drop for reordering
        this.element.addEventListener('dragover', (e) => {
            if (!activeDrag || activeDrag.kind !== 'row') return;
            e.preventDefault();
            this.element.classList.add('row-drop-over');
        });

        this.element.addEventListener('dragleave', () => {
            this.element.classList.remove('row-drop-over');
        });

        this.element.addEventListener('drop', (e) => {
            if (!activeDrag || activeDrag.kind !== 'row') return;
            e.preventDefault();
            e.stopPropagation();
            this.element.classList.remove('row-drop-over');
            
            if (activeDrag.sourceRow && activeDrag.sourceRow !== this) {
                this.callbacks.onReorder?.(activeDrag.sourceRow.id, this.id);
            }
        });
    }

    _renderHandle() {
        const td = document.createElement('td');
        td.className = 'row-handle-cell';
        
        const handle = document.createElement('span');
        handle.className = 'row-handle-icon';
        handle.textContent = '⠿';
        handle.draggable = true;
        
        handle.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            activeDrag = { kind: 'row', rowId: this.id, sourceRow: this };
            this.element.classList.add('dragging');
            document.querySelectorAll('tbody tr[data-row-id]').forEach(tr => {
                if (tr !== this.element) {
                    tr.classList.add('row-drop-target');
                }
            });
        });

        handle.addEventListener('dragend', () => {
            this.element.classList.remove('dragging');
            activeDrag = null;
            document.querySelectorAll('.row-drop-target, .row-drop-over')
                .forEach(el => el.classList.remove('row-drop-target', 'row-drop-over'));
        });

        td.appendChild(handle);
        return td;
    }

    _renderCell(col) {
        const field = this.fields[col.id];
        const td    = document.createElement('td');
        td.className     = 'data-cell';
        td.dataset.colId = col.id;
        td.draggable     = true;
        td._rowInstance  = this;  // Store row reference for drag-drop

        const content = document.createElement('div');
        content.className = 'cell-content';
        content.textContent = this._getDisplayValue(col);
        td.appendChild(content);

        // Apply status color if needed
        if (col.type === 'enum' && col.id === 'Status') {
            const statusValue = this.data[col.id];
            this._applyStatusColor(td, statusValue);
        }

        // Attach cell interactions
        this._attachCellListeners(td, col, field, content);

        return td;
    }

    _getDisplayValue(col) {
        let value = this.data[col.id] ?? '—';
        if (col.id === 'responsible' && this.peopleData) {
            const person = this.peopleData.find(p => p.id === value);
            value = person ? person.vorname : value;
        }
        return value;
    }

    _applyStatusColor(td, status) {
        td.classList.add(status === 'aktiv' ? 'status-aktiv' : 'status-inaktiv');
    }

    _attachCellListeners(td, col, field, content) {
        // Single click: expand
        td.addEventListener('click', (e) => {
            if (td.classList.contains('editing')) return;
            
            // Special handling for links
            if (col.id === 'link' && this.data[col.id] && this.data[col.id] !== '—') {
                window.open(this.data[col.id], '_blank');
                return;
            }
            
            const isExpanded = td.classList.contains('expanded');
            document.querySelectorAll('.data-cell.expanded')
                .forEach(el => el.classList.remove('expanded'));
            if (!isExpanded) td.classList.add('expanded');
        });

        // Double click: edit
        td.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (td.classList.contains('editing')) return;
            this._startEditing(td, col, field, content);
        });

        // Drag source
        td.addEventListener('dragstart', (e) => {
            if (td.classList.contains('editing')) {
                e.preventDefault();
                return;
            }
            e.stopPropagation();
            activeDrag = { field, rowId: this.id, colId: col.id };
            td.classList.add('dragging');
            this._highlightDropTargets();
        });

        td.addEventListener('dragend', () => {
            td.classList.remove('dragging');
            activeDrag = null;
            document.querySelectorAll('.drop-compatible, .drop-incompatible, .drop-over')
                .forEach(el => el.classList.remove('drop-compatible', 'drop-incompatible', 'drop-over'));
        });

        // Drag over
        td.addEventListener('dragover', (e) => {
            if (!activeDrag || !activeDrag.field) return;
            const cellField = this.fields[col.id];
            if (cellField && cellField.canAccept(activeDrag.field)) {
                e.preventDefault();
                td.classList.add('drop-over');
            }
        });

        td.addEventListener('dragleave', () => {
            td.classList.remove('drop-over');
        });
    }

    _highlightDropTargets() {
        if (!activeDrag || !activeDrag.field) return;
        document.querySelectorAll('.data-cell').forEach(cell => {
            const cellRow = cell._rowInstance;
            if (!cellRow) return;
            const cellField = cellRow.fields[cell.dataset.colId];
            if (cellField && cellField.canAccept(activeDrag.field)) {
                cell.classList.add('drop-compatible');
            } else {
                cell.classList.add('drop-incompatible');
            }
        });
    }

    _startEditing(td, col, field, content) {
        td.classList.add('editing', 'expanded');
        td.draggable = false;

        const original = this.data[col.id] ?? '';
        content.style.display = 'none';

        const editor = this._createEditor(field, original);
        td.appendChild(editor);
        editor.focus();
        if (editor.tagName === 'TEXTAREA') editor.select();

        this.callbacks.onEditStart?.();

        const finish = (save) => {
            if (save) {
                this._saveEdit(col, editor, content);
            }
            this._finishEditing(td, editor, content);
        };

        this._attachEditorListeners(editor, field, finish);
    }

    _createEditor(field, originalValue) {
        if (field.type === 'enum') {
            // Create custom dropdown to match header style
            const container = document.createElement('div');
            container.className = 'custom-enum-dropdown';
            container.style.cssText = `
                position: relative;
                width: 100%;
                min-height: 36px;
            `;

            const button = document.createElement('button');
            button.className = 'enum-dropdown-btn';
            button.type = 'button';
            button.style.cssText = `
                width: 100%;
                height: 36px;
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 8px 32px 8px 12px;
                font-size: 13px;
                font-weight: 500;
                color: var(--text-primary);
                text-align: left;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                transition: border-color var(--transition), box-shadow var(--transition);
                position: relative;
            `;

            const textSpan = document.createElement('span');
            textSpan.textContent = originalValue || '-- Select --';
            textSpan.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

            const arrowSpan = document.createElement('span');
            arrowSpan.textContent = '▼';
            arrowSpan.style.cssText = `
                font-size: 10px;
                color: var(--accent);
                transition: transform var(--transition);
                margin-left: 8px;
            `;

            button.appendChild(textSpan);
            button.appendChild(arrowSpan);

            const menu = document.createElement('div');
            menu.className = 'enum-dropdown-menu';
            menu.style.cssText = `
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                margin-top: 2px;
                padding: 4px 0;
                display: none;
                flex-direction: column;
                gap: 0;
                box-shadow: var(--shadow-md);
                z-index: 10000;
                max-height: 200px;
                overflow-y: auto;
                border-top: 2px solid var(--accent);
                pointer-events: all;
            `;

            // Add empty option
            const emptyItem = document.createElement('button');
            emptyItem.className = 'enum-dropdown-item';
            emptyItem.type = 'button';
            emptyItem.dataset.value = '';
            emptyItem.textContent = '-- Select --';
            emptyItem.style.cssText = `
                background: none;
                border: none;
                cursor: pointer;
                color: var(--text-secondary);
                font-size: 13px;
                font-weight: 500;
                padding: 8px 12px;
                text-align: left;
                transition: background var(--transition), color var(--transition);
                white-space: nowrap;
                width: 100%;
            `;
            if (!originalValue) emptyItem.style.color = 'var(--accent)';
            menu.appendChild(emptyItem);

            // Add enum options
            field.options.forEach(option => {
                const item = document.createElement('button');
                item.className = 'enum-dropdown-item';
                item.type = 'button';
                item.dataset.value = option;
                item.textContent = option;
                item.style.cssText = `
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--text-primary);
                    font-size: 13px;
                    font-weight: 500;
                    padding: 8px 12px;
                    text-align: left;
                    transition: background var(--transition), color var(--transition);
                    white-space: nowrap;
                    width: 100%;
                `;
                if (option === originalValue) {
                    item.style.color = 'var(--accent)';
                    item.style.fontWeight = '600';
                }
                menu.appendChild(item);
            });

            // Toggle dropdown
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = menu.style.display === 'flex';
                menu.style.display = isOpen ? 'none' : 'flex';
                arrowSpan.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
                button.style.boxShadow = isOpen ? 'none' : '0 0 0 3px var(--accent-light)';
            });

            // Handle item selection
            menu.addEventListener('click', (e) => {
                if (e.target.classList.contains('enum-dropdown-item')) {
                    const value = e.target.dataset.value;
                    textSpan.textContent = value || '-- Select --';
                    button.dataset.value = value;
                    menu.style.display = 'none';
                    arrowSpan.style.transform = 'rotate(0deg)';
                    button.style.boxShadow = 'none';
                }
            });

            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    menu.style.display = 'none';
                    arrowSpan.style.transform = 'rotate(0deg)';
                    button.style.boxShadow = 'none';
                }
            });

            container.appendChild(button);
            container.appendChild(menu);

            // Store value for saving
            container.getValue = () => button.dataset.value || '';

            return container;
        }

        const textarea = document.createElement('textarea');
        textarea.className = 'cell-editor';
        textarea.value = originalValue === '—' ? '' : originalValue;
        return textarea;
    }

    _attachEditorListeners(editor, field, finishCallback) {
        if (field.type === 'enum') {
            // For custom enum dropdown, finish on item selection or outside click
            // The custom dropdown handles its own events
            return;
        } else {
            editor.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') finishCallback(false);
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    finishCallback(true);
                }
            });
            editor.addEventListener('blur', () => finishCallback(true));
        }
    }

    _saveEdit(col, editor, content) {
        let newVal;
        if (col.type === 'enum') {
            newVal = editor.getValue().trim() || '—';
        } else {
            newVal = editor.value.trim() || '—';
        }
        
        if (col.type === 'number') {
            newVal = parseInt(newVal) || 0;
        }
        
        this.data[col.id] = newVal;
        
        let displayValue = newVal;
        if (col.id === 'responsible') {
            const person = this.peopleData?.find(p => p.id === newVal);
            displayValue = person ? person.vorname : newVal;
        }
        content.textContent = displayValue;

        // Update status color
        if (col.type === 'enum' && col.id === 'Status') {
            editor.parentElement?.classList.remove('status-aktiv', 'status-inaktiv');
            editor.parentElement?.classList.add(newVal === 'aktiv' ? 'status-aktiv' : 'status-inaktiv');
        }

        this.callbacks.onEditChange?.();
    }

    _finishEditing(td, editor, content) {
        editor.remove();
        content.style.display = '';
        td.classList.remove('editing');
        td.draggable = true;
    }

    toJSON() {
        const result = { id: this.id };
        this.schema.forEach(col => {
            result[col.id] = this.data[col.id] ?? null; // Ensure each field is explicitly mapped
        });
        return result;
    }
}

