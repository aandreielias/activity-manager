import { BaseModal } from './BaseModal.js';
import { TableBuilder } from '../../Builders/Table/TableBuilder.js';

export class TableModal extends BaseModal {
    constructor(titleOrTable, defaultQuery = null) {
        const isTable = typeof titleOrTable === 'object' && titleOrTable !== null;
        super(isTable ? (titleOrTable.titel || titleOrTable.name) : titleOrTable);

        if (isTable) {
            this.table = titleOrTable;
            this.defaultQuery = defaultQuery;
        }
    }

    styleModalWindow(container) {
        setTimeout(() => {
            const modalWindow = container.closest('.modal-window');
            if (modalWindow) {
                modalWindow.classList.add('table-modal-window');
            }
            container.classList.add('table-modal-container');
        }, 0);
    }

    renderBody(container) {
        this.styleModalWindow(container);

        if (this.table) {
            this.renderTable(container, this.table, {}, this.defaultQuery);
        }
    }

    renderTable(container, tableToRender, options = {}, query = null) {
        const originalState = window.history.state;

        if (query) {
            window.history.replaceState({ ...originalState, defaultQuery: query }, '');
        }

        const tableBuilder = new TableBuilder(container, options);
        tableBuilder.render(Array.isArray(tableToRender) ? tableToRender : [tableToRender]);

        if (query) {
            window.history.replaceState(originalState, '');
        }
    }
}
