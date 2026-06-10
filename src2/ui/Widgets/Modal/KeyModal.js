import { TableModal } from "./TableModal.js";
import { TableBuilder } from "../../Builders/Table/TableBuilder.js";

export class KeyModal extends TableModal {
    constructor(field, row, cellElement) {
        const refTable = row.table.dataLoader?.getTable(field.reference);
        const refTableTitle = refTable ? (refTable.titel || refTable.name) : field.reference;
        const sourceTableTitle = row.table.titel || row.table.name;
        const fieldTitle = field.titel || field.name;

        super(`Auswahl: <span class="modal-accent-text">Tb.: ${sourceTableTitle} @ Feld: ${fieldTitle} aus Tb.: ${refTableTitle}</span>`);

        this.field = field;
        this.row = row;
        this.cellElement = cellElement;
    }

    renderBody(container) {
        this.styleModalWindow(container);

        const refTable = this.row.table.dataLoader?.getTable(this.field.reference);

        if (refTable && refTable.rows.length > 0) {
            const tableWrapper = document.createElement('div');
            tableWrapper.classList.add('key-modal-table-wrapper');

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
                innerContainer.classList.add('key-modal-inner-container');
            }

            container.appendChild(tableWrapper);

            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Speichern';
            saveBtn.classList.add('key-modal-save-btn');

            saveBtn.addEventListener('click', () => this.saveSelection(tableWrapper));
            container.appendChild(saveBtn);

        } else {
            container.innerHTML = '<p class="modal-empty-text">Keine Referenzdaten gefunden</p>';
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
