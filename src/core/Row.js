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
            if (col.hidden) return;
            
            // COLUMN SECURITY
            if (!globalState.canView(`col_${this.tableId}.${col.id}`)) return;

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
                onEditRow: canEditTable ? async () => {
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
            const imgPath = data.photo || data.image_url;
            if (imgPath) {
                const isFull = imgPath.includes('://') || imgPath.startsWith('data:');
                const imgUrl = isFull ? imgPath : `${SUPABASE_CONFIG.URL}/storage/v1/object/public/inventory_picture_bucket/${imgPath}`;
                const html = `<div style="display: flex; align-items: center; justify-content: center; width: 220px; height: 220px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background: var(--bg-secondary); position: relative;"><div class="tooltip-loader" style="position: absolute; z-index: 1;"></div><img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transition: opacity 0.2s ease; z-index: 2;" onload="this.style.opacity='1'; this.previousElementSibling.style.display='none';" onerror="this.previousElementSibling.style.display='none';"></div>`;
                const condition = () => !Object.values(this.fields).some(f => f.td?.classList.contains('editing'));
                Tooltip.attach(this.element, html, 400, condition);
            }
        }

        // Tooltip for People Table
        if (this.tableId === 'tbl_people') {
            const data = this.data;
            const imgPath = data.image_url || data.photo;
            const bucket = 'user_picture_bucket';
            const isFull = imgPath?.includes('://') || imgPath?.startsWith('data:');
            const imgUrl = imgPath ? (isFull ? imgPath : `${SUPABASE_CONFIG.URL}/storage/v1/object/public/${bucket}/${imgPath}`) : null;

            const name = `${data.vorname || ''} ${data.nachname || ''}`.trim() || 'Unbekannt';
            const team = data.Team || data.Teams || '-';
            const role = data.role || data.Rolle || 'User';
            const status = data.Status || 'Aktiv';
            const email = data.email || data.Email || '-';
            const phone = data['Tel.'] || data.Telefon || '-';
            const isActive = String(status).toLowerCase() === 'aktiv';

            // Ultra-compact rewrite
            const html = `
                <div style="width: 220px; display: flex; flex-direction: column; gap: 6px; color: var(--text-primary); font-family: inherit;">
                    <!-- Identity Header -->
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <!-- Avatar -->
                        <div style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; border: 1px solid var(--border-color); background: var(--bg-tertiary); flex-shrink: 0; display: flex; align-items: center; justify-content: center; position: relative;">
                            ${imgUrl ? `
                                <div class="tooltip-loader" style="position: absolute; width: 14px; height: 14px; border-width: 1px; z-index: 1;"></div>
                                <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.2s ease; z-index: 2;" onload="this.style.opacity='1'; this.previousElementSibling.style.display='none';" onerror="this.previousElementSibling.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-size: 18px; opacity: 0.3;\\'>👤</span>';">
                            ` : '<span style="font-size: 18px; opacity: 0.3;">👤</span>'}
                        </div>
                        
                        <!-- Name & Role -->
                        <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                            <div style="font-weight: 700; color: var(--accent); font-size: 14px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${name}
                            </div>
                            <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap;">
                                ${role}
                            </div>
                        </div>
                    </div>

                    <div style="height: 1px; background: var(--border-light); opacity: 0.4;"></div>

                    <!-- Compact Grid -->
                    <div style="display: grid; grid-template-columns: 55px 1fr; gap: 2px 8px; font-size: 10px; line-height: 1.2;">
                        <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">Team</div>
                        <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${team}</div>
                        
                        <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">E-Mail</div>
                        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.8;">${email}</div>
                        
                        <div style="color: var(--text-muted); font-weight: 700; text-transform: uppercase; font-size: 8px;">Telefon</div>
                        <div style="opacity: 0.8;">${phone}</div>
                    </div>
                </div>`.trim();

            const condition = () => !Object.values(this.fields).some(f => f.td?.classList.contains('editing'));
            Tooltip.attach(this.element, html, 400, condition);
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
