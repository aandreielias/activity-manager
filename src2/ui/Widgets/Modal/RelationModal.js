import { TableModal } from './TableModal.js';
import { TableBuilder } from '../../Builders/Table/TableBuilder.js';

export class RelationModal extends TableModal {
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

        const dataLoader = this.row.table.dataLoader;
        const junctionTableName = this.field.reference;
        const sourceTableName = this.row.table.name;
        const junctionTable = dataLoader.getTable(junctionTableName);

        if (!junctionTable) {
            container.innerHTML = `<div class="relation-modal-msg">Verbindungstabelle '${junctionTableName}' nicht gefunden. Bitte f_referenz prüfen.</div>`;
            return;
        }

        const sourceRefField = junctionTable.fields.find(f => f.reference === sourceTableName);

        if (!sourceRefField) {
            container.innerHTML = `<div class="relation-modal-msg">Die Tabelle '${junctionTableName}' hat keine gültige f_referenz auf die Quelltabelle '${sourceTableName}'.</div>`;
            return;
        }

        const actualColA = sourceRefField.name;
        const filteredRows = (junctionTable.rows || []).filter(r => r.data[actualColA] === this.row.id);

        const displayTable = {
            ...junctionTable,
            rows: filteredRows
        };

        const tableContainer = document.createElement('div');
        container.appendChild(tableContainer);

        this.renderTable(tableContainer, displayTable, {
            isEditable: true,
            enableSelection: false,
            defaultValues: {
                [actualColA]: this.row.id
            }
        });
    }
}
