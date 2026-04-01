import { FieldFactory } from './fields/FieldFactory.js';
import { Dialog } from '../ui/Dialog.js';
import { GlobalStateManager } from './GlobalStateManager.js';
import { contextMenu } from '../ui/ContextMenu.js';

/**
 * Row - Represents a single table row serving as a container for Field variants
 */
export class Row {
    constructor({ id, data, schema, peopleData, tableId }) {
        this.id = id;
        this.data = data;
        this.schema = schema;
        this.peopleData = peopleData;
        this.tableId = tableId;
        this.element = null;
        this.callbacks = {};

        this.createdBy = data.createdBy || 'Unbekannt';
        this.createdAt = data.createdAt || null;

        this.fields = this._buildFields();
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

        const globalState = GlobalStateManager.getInstance();
        const isFav = globalState.isFavorite(this.id);
        if (isFav) {
            this.element.dataset.favorite = 'true';
        }

        const favTd = document.createElement('td');
        favTd.className = 'favorite-cell';

        const heartSpan = document.createElement('span');
        heartSpan.className = 'favorite-heart-icon';
        heartSpan.textContent = '❤️';
        if (!isFav) heartSpan.style.display = 'none';

        this.heartSpan = heartSpan;
        favTd.appendChild(heartSpan);
        favTd.addEventListener('click', (e) => {
            e.stopPropagation();
            this.element.classList.toggle('expanded-row');
        });
        this.element.appendChild(favTd);

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

            const cell = e.target.closest('.data-cell');
            const currentUser = GlobalStateManager.getInstance().getCurrentUser();
            const canEditTable = GlobalStateManager.getInstance().canEdit(this.tableId);

            let onEdit = null;
            if (cell && canEditTable) {
                const colId = cell.dataset.colId;
                if (colId && this.fields[colId] && !cell.classList.contains('editing')) {
                    onEdit = () => {
                        this.fields[colId].startEditing();
                    };
                }
            }

            let onDelete = null;
            if (canEditTable) {
                onDelete = () => this.callbacks.onDelete?.(this.id);
            }

            contextMenu.show(e.clientX, e.clientY, {
                onDelete: onDelete,
                onEdit: onEdit,
                onToggleFavorite: () => this.toggleFavorite(),
                isFavorite: GlobalStateManager.getInstance().isFavorite(this.id),
                onShowInfo: () => {
                    const dateStr = this.createdAt ? new Date(this.createdAt).toLocaleString('de-DE') : 'Unbekannt';
                    Dialog.alert({
                        title: 'Eintragsinformationen',
                        message: `Erstellt von: ${this.createdBy}\nErstellt am: ${dateStr}`
                    });
                }
            });
        });
    }

    toggleFavorite() {
        const globalState = GlobalStateManager.getInstance();
        globalState.toggleFavorite(this.id);

        const isFav = globalState.isFavorite(this.id);
        if (this.element) {
            if (isFav) {
                this.element.dataset.favorite = 'true';
                if (this.heartSpan) this.heartSpan.style.display = '';
            } else {
                delete this.element.dataset.favorite;
                if (this.heartSpan) this.heartSpan.style.display = 'none';
            }
        }

        this.callbacks.onEditChange?.();
    }

    toJSON() {
        const result = { id: this.id };
        this.schema.forEach(col => {
            result[col.id] = this.data[col.id] ?? null;
        });

        if (this.createdBy) result.createdBy = this.createdBy;
        if (this.createdAt) result.createdAt = this.createdAt;

        return result;
    }
}
