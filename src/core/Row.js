import { FieldFactory } from './fields/FieldFactory.js';
import { Dialog } from '../ui/Dialog.js';
import { GlobalStateManager } from './GlobalStateManager.js';
import { RIGHTS } from './Constants.js';
import { contextMenu } from '../ui/ContextMenu.js';
import { CalendarExport } from '../utils/CalendarExport.js';
import { Tooltip } from '../ui/Tooltip.js';
import { TooltipGenerator } from '../utils/TooltipGenerator.js';
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
                readOnly: GlobalStateManager.getInstance().getRight(this.tableId, col.id) < RIGHTS.WRITE,
                onChange: (fieldId, newVal) => {
                    this.data[fieldId] = newVal;
                    this.isDirty = true;
                    this.callbacks.onEditChange?.();
                },
                onEditStart: () => {
                    Tooltip.hide();
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
            if (col.hidden || globalState.getRight(this.tableId, col.id) === RIGHTS.NONE) return;
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

            let onEdit = null;
            if (cell) {
                const colId = cell.dataset.colId;
                if (colId && this.fields[colId] && !cell.classList.contains('editing')) {
                    const canWrite = GlobalStateManager.getInstance().getRight(this.tableId, colId) === RIGHTS.WRITE;
                    if (canWrite) {
                        onEdit = () => {
                            this.fields[colId].startEditing();
                        };
                    }
                }
            }

            const canWriteTable = GlobalStateManager.getInstance().getRight(this.tableId) === RIGHTS.WRITE;
            let onDelete = canWriteTable ? () => this.callbacks.onDelete?.(this.id) : null;

            contextMenu.show(e.clientX, e.clientY, {
                onDelete: onDelete,
                onEdit: onEdit,
                onEditRow: async () => {
                    if (this.tableId === 'tbl_inventory') {
                        const { InventoryEditDialog } = await import('../ui/InventoryEditDialog.js');
                        await InventoryEditDialog.show(this);
                    } else if (this.tableId === 'tbl_people' || this.tableId === 'people_table') {
                        const { PersonEditDialog } = await import('../ui/PersonEditDialog.js');
                        await PersonEditDialog.show(this);
                    } else {
                        const { RowEditDialog } = await import('../ui/RowEditDialog.js');
                        await RowEditDialog.show(this);
                    }
                },
                editRowLabel: canWriteTable ? 'Eintrag bearbeiten' : 'Details anzeigen',
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
            const html = TooltipGenerator.generateInventoryImageTooltip(this.data);
            if (html) {
                const condition = () => {
                    // Lowest priority: don't show if any field is editing
                    if (Object.values(this.fields).some(f => f.td?.classList.contains('editing'))) return false;
                    
                    // Don't show if hovering over a cell that has its own tooltip (pointer cursor)
                    const hovered = document.querySelector(':hover');
                    if (hovered) {
                        const cell = hovered.classList.contains('data-cell') ? hovered : hovered.closest('.data-cell');
                        if (cell && cell.style.cursor === 'pointer') return false;
                    }
                    return true;
                };
                Tooltip.attach(this.element, html, 400, condition);
            }
        }

        // Tooltip for People Table
        if (this.tableId === 'tbl_people') {
            const html = TooltipGenerator.generatePersonTooltip(this.data);
            if (html) {
                const condition = () => {
                    if (Object.values(this.fields).some(f => f.td?.classList.contains('editing'))) return false;
                    
                    const hovered = document.querySelector(':hover');
                    if (hovered) {
                        const cell = hovered.classList.contains('data-cell') ? hovered : hovered.closest('.data-cell');
                        if (cell && cell.style.cursor === 'pointer') return false;
                    }
                    return true;
                };
                Tooltip.attach(this.element, html, 400, condition);
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
        if (this.data.photo !== undefined) result.photo = this.data.photo;
        if (this.data.image_url !== undefined) result.image_url = this.data.image_url;
        if (this.data.updated_at !== undefined) result.updated_at = this.data.updated_at;
        if (this.data.category !== undefined) result.category = this.data.category;
        if (this.data.sport_type !== undefined) result.sport_type = this.data.sport_type;

        if (this.createdBy) result.createdBy = this.createdBy;
        if (this.createdAt) result.createdAt = this.createdAt;

        return result;
    }
}
