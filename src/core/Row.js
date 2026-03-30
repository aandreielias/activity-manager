import { FieldFactory } from './fields/FieldFactory.js';

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
        this.element.style.top = `${Math.min(y, window.innerHeight - 100)}px`;
        this.element.style.left = `${Math.min(x, window.innerWidth - 160)}px`;

        const deleteItem = this._createMenuItem('Zeile löschen', () => {
            this.close();
            if (confirm('Diese Zeile löschen?')) {
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
 * Row - Represents a single table row serving as a container for Field variants
 */
export class Row {
    constructor({ id, data, schema, peopleData }) {
        this.id           = id;
        this.data         = data;
        this.schema       = schema;
        this.peopleData   = peopleData;
        this.element      = null;
        this.callbacks    = {};

        this.fields       = this._buildFields();
    }

    _buildFields() {
        const fields = {};
        this.schema.forEach(col => {
            fields[col.id] = FieldFactory.createField({
                rowId: this.id,
                colDef: col,
                value: this.data[col.id],
                peopleData: this.peopleData,
                onChange: (fieldId, newVal) => {
                    this.data[fieldId] = newVal;
                    this.callbacks.onEditChange?.();
                },
                onEditStart: () => {
                    this.callbacks.onEditStart?.();
                }
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

        this.schema.forEach(col => {
            const field = this.fields[col.id];
            this.element.appendChild(field.render());
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
    }

    toJSON() {
        const result = { id: this.id };
        this.schema.forEach(col => {
            result[col.id] = this.data[col.id] ?? null;
        });
        return result;
    }
}
