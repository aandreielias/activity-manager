import { TableModal } from "./TableModal.js";
import { TableBuilder } from "../../Builders/Table/TableBuilder.js";

export class KeyModal extends TableModal {
    constructor(field, row, cellElement) {
        const refTable = row.table.dataLoader?.getTable(field.reference);
        const refTableTitle = refTable ? (refTable.titel || refTable.name) : field.reference;
        const sourceTableTitle = row.table.titel || row.table.name;
        const fieldTitle = field.titel || field.name;

        super(`Auswahl: <span style="color: var(--accent);">Tb.: ${sourceTableTitle} @ Feld: ${fieldTitle} aus Tb.: ${refTableTitle}</span>`);

        this.field = field;
        this.row = row;
        this.cellElement = cellElement;
    }

    renderBody(container) {
        this.styleModalWindow(container);

        const refTable = this.row.table.dataLoader?.getTable(this.field.reference);

        if (refTable && refTable.rows.length > 0) {
            const tableWrapper = document.createElement('div');
            tableWrapper.style.maxHeight = '50vh';
            tableWrapper.style.overflowY = 'auto';
            tableWrapper.style.border = 'var(--border-default)';
            tableWrapper.style.borderRadius = 'var(--radius)';

            this.renderTable(tableWrapper, refTable, {
                isEditable: false,
                enableSelection: true
            });

            const currentVal = this.row.getCellValue(this.field.name);
            if (currentVal !== null && currentVal !== undefined && currentVal != '') {
                const selectedIds = String(currentVal).split(',').map(s => s.trim());
                const checkboxes = tableWrapper.querySelectorAll('.row-select-checkbox');

                checkboxes.forEach(cb => {
                    if (selectedIds.includes(String(cb.dataset.rowId))) {
                        cb.checked = true;
                        cb.closest('.table-row')?.classList.add('row-selected');
                    }
                });
            }

            const innerContainer = tableWrapper.querySelector('.table-container');
            if (innerContainer) {
                innerContainer.style.marginBottom = '0';
                innerContainer.style.border = 'none';
                innerContainer.style.boxShadow = 'none';
            }

            container.appendChild(tableWrapper);

            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Speichern';
            saveBtn.style.marginTop = '16px';
            saveBtn.style.padding = 'var(--padding-sm) var(--padding-lg)';
            saveBtn.style.background = 'var(--accent)';
            saveBtn.style.color = 'white';
            saveBtn.style.border = 'none';
            saveBtn.style.borderRadius = 'var(--radius-md)';
            saveBtn.style.cursor = 'pointer';
            saveBtn.style.fontWeight = '600';

            saveBtn.addEventListener('click', () => this.saveSelection(tableWrapper));
            container.appendChild(saveBtn);

        } else {
            container.innerHTML = '<p style="color: var(--text-muted);">Keine Referenzdaten gefunden</p>';
        }
    }

    saveSelection(tableWrapper) {
        const checkboxes = tableWrapper.querySelectorAll('.row-select-checkbox:checked');
        const selectedIds = Array.from(checkboxes).map(cb => cb.dataset.rowId);

        if (selectedIds.length > 0) {
            this.row.updateValue(this.field.name, selectedIds.join(','));
        } else {
            this.row.updateValue(this.field.name, null);
        }

        this.close();
    }
}
