import { FieldFactory } from './fields/FieldFactory.js';
import { Dialog } from '../ui/Dialog.js';
import { GlobalStateManager } from './GlobalStateManager.js';
import { contextMenu } from '../ui/ContextMenu.js';
import { CalendarExport } from '../utils/CalendarExport.js';
import { Tooltip } from '../ui/Tooltip.js';
import { SUPABASE_CONFIG } from '../config.js';

/**
 * Row - Represents a single table row serving as a container for Field variants
 */
export class Row {
    constructor({ id, data, schema, peopleData, tableId, defaultIndex }) {
        this.id = id;
        this.data = data;
        this.schema = schema;
        this.peopleData = peopleData;
        this.tableId = tableId;
        this.defaultIndex = defaultIndex ?? 0;
        this.element = null;
        this.callbacks = {};

        this.createdBy = data.createdBy || 'Unbekannt';
        this.createdAt = data.createdAt || null;
        this._isDirty = GlobalStateManager.getInstance().isRowDirty(this.tableId, this.id);
        if (data.isDirty) this.isDirty = true; // Handle explicitly passed dirty state

        this.fields = this._buildFields();
    }

    get isDirty() {
        return GlobalStateManager.getInstance().isRowDirty(this.tableId, this.id);
    }

    set isDirty(val) {
        if (val) {
            GlobalStateManager.getInstance().markRowAsDirty(this.tableId, this.id);
        } else {
            // Usually clearing is handled via clearDirtyRowIds
        }
    }

    _buildFields() {
        const fields = {};
        this.schema.forEach(col => {
            fields[col.id] = FieldFactory.createField({
                rowId: this.id,
                rowData: this.data,
                colDef: col,
                value: this.data[col.id],
                peopleData: this.peopleData,
                tableId: this.tableId,
                onChange: (fieldId, newVal) => {
                    this.data[fieldId] = newVal;
                    this.isDirty = true;
                    this.callbacks.onEditChange?.();
                },
                onEditStart: () => {
                    this.callbacks.onEditStart?.();
                },
                onTab: (fieldId) => {
                    this._editNextField(fieldId);
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

        // Bulk Selection Checkbox
        const bulkTd = document.createElement('td');
        bulkTd.className = 'bulk-cell';
        const isSelected = globalState.isRowSelected(this.tableId, this.id);
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'bulk-checkbox';
        checkbox.checked = isSelected;
        checkbox.onclick = (e) => {
            e.stopPropagation();
            this.callbacks.onSelect?.(this.id, checkbox.checked);
        };
        this.bulkCheckbox = checkbox;
        bulkTd.appendChild(checkbox);
        this.element.appendChild(bulkTd);

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
            if (col.hidden) return;
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
                onEditRow: this.tableId === 'tbl_inventory' ? async () => {
                    const { InventoryEditDialog } = await import('../ui/InventoryEditDialog.js');
                    await InventoryEditDialog.show(this);
                } : null,
                onToggleFavorite: () => this.toggleFavorite(),
                isFavorite: GlobalStateManager.getInstance().isFavorite(this.id),
                onExportToCalendar: this.tableId === 'tbl_events' ? () => CalendarExport.exportEvent(this.data, GlobalStateManager.getInstance().getTables()) : null,
                onShowInfo: () => {
                    const dateStr = this.createdAt ? new Date(this.createdAt).toLocaleString('de-DE') : 'Unbekannt';
                    Dialog.alert({
                        title: 'Eintragsinformationen',
                        message: `Erstellt von: ${this.createdBy}\nErstellt am: ${dateStr}`
                    });
                }
            });
        });

        // Tooltip for Inventory Table
        if (this.tableId === 'tbl_inventory') {
            const data = this.data;
            if (data.image_url) {
                const isFull = data.image_url.includes('://') || data.image_url.startsWith('data:');
                const imgUrl = isFull ? data.image_url : `${SUPABASE_CONFIG.URL}/storage/v1/object/public/inventory_picture_bucket/${data.image_url}`;
                
                // Framed photo tooltip matching standard themed box (no newlines to avoid pre-wrap space)
                const html = `<div style="display: block; width: 220px; height: 220px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);"><img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block;"></div>`;
                Tooltip.attach(this.element, html, 400);
            }
        }
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

        this.isDirty = true;
        this.callbacks.onEditChange?.();
    }

    _editNextField(currentFieldId) {
        const colIds = this.schema.map(c => c.id);
        const currentIndex = colIds.indexOf(currentFieldId);
        if (currentIndex !== -1 && currentIndex < colIds.length - 1) {
            const nextColId = colIds[currentIndex + 1];
            const nextField = this.fields[nextColId];
            if (nextField) {
                // Short timeout to let current finishEditing work
                setTimeout(() => nextField.startEditing(), 10);
            }
        }
    }

    toJSON() {
        const result = { id: this.id };
        this.schema.forEach(col => {
            result[col.id] = this.data[col.id] ?? null;
        });

        // Ensure internal fields are preserved even if not in schema
        if (this.data.image_url !== undefined) result.image_url = this.data.image_url;
        if (this.data.updated_at !== undefined) result.updated_at = this.data.updated_at;

        if (this.createdBy) result.createdBy = this.createdBy;
        if (this.createdAt) result.createdAt = this.createdAt;

        return result;
    }
}
