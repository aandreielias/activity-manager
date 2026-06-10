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
                modalWindow.style.width = '90vw';
                modalWindow.style.maxWidth = '1400px';
                modalWindow.style.maxHeight = '90vh';
                modalWindow.style.display = 'flex';
                modalWindow.style.flexDirection = 'column';
            }
            container.style.padding = '24px';
            container.style.overflowY = 'auto';
            container.style.flex = '1';
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
