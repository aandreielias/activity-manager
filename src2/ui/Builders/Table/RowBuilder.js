import { FieldBuilder } from "./FieldBuilder.js";
import { eventBus } from "../../../events/EventBus.js";

export class RowBuilder {

    constructor(row, fields, options = {}) {
        this.row = row;
        this.fields = fields;

        this.options = options;
    }

    build() {
        const tr = document.createElement('tr');
        tr.classList.add('table-row');
        tr.dataset.rowId = this.row.id;

        if (this.options.enableSelection) {
            const td = document.createElement('td');
            td.style.textAlign = 'center';

            const checkbox = document.createElement('input');

            checkbox.type = 'checkbox';
            checkbox.className = 'row-select-checkbox';
            checkbox.dataset.rowId = this.row.id;

            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    tr.classList.add('row-selected');
                } else {
                    tr.classList.remove('row-selected');
                }
            });

            td.appendChild(checkbox);
            tr.appendChild(td);
        }

        this.fields.forEach(field => {
            const fieldBuilder = new FieldBuilder(field, this.row, this.options);
            const tdElement = fieldBuilder.build();

            tr.appendChild(tdElement);
        });

        tr.addEventListener('mouseenter', () => tr.classList.add('row-hover'));
        tr.addEventListener('mouseleave', () => tr.classList.remove('row-hover'));

        tr.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            eventBus.emit('UI', 'SHOW_CONTEXT_MENU', {
                x: e.clientX,
                y: e.clientY,
                title: `Optionen (ID: ${this.row.id})`,
                items: [
                    {
                        label: 'Eintrag löschen',
                        color: 'var(--color-error)',
                        action: () => {
                            tr.style.opacity = '0.5';
                            setTimeout(() => tr.style.display = 'none', 200);

                            eventBus.emit('DATA', 'DATA_UPDATED', {
                                table: this.row.table.name,
                                rowId: this.row.id,
                                field: '__ROW_ACTION__',
                                value: 'DELETE',
                                row: this.row
                            });
                        }
                    }
                ]
            });
        });

        eventBus.on('UI', 'REVERT_ROW_ACTION', (payload) => {
            if (payload.table === this.row.table.name && payload.rowId === this.row.id) {

                if (payload.action === 'DELETE') {
                    tr.style.display = '';
                    tr.style.opacity = '1';
                }
                else if (payload.action === 'ADD') {
                    tr.remove();
                    const rowIndex = this.row.table.rows.findIndex(r => r.id === this.row.id);
                    if (rowIndex !== -1) this.row.table.rows.splice(rowIndex, 1);
                }
            }
        });

        return tr;
    }
}