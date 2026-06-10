import { RowBuilder } from './RowBuilder.js';
import { TableManager } from './TableManager.js';
import { FilterPanel } from '../../Widgets/FilterPanel.js';
import { eventBus } from '../../../events/EventBus.js';
import { Row } from '../../../core/Database/Table/Row.js';
import { Authenticator } from '../../../core/Database/Authenticator.js';
import { TableModal } from '../../Widgets/Modal/TableModal.js';
import { METATABLES } from "../../../core/Constants.js";


export class TableBuilder {
    constructor(containerElement, options = {}) {
        if (!containerElement) {
            throw new Error("TableBuilder requires a valid container element.");
        }
        this.container = containerElement;

        this.options = {
            isEditable: true,
            enableSelection: false,
            defaultValues: {},
            ...options
        }

        eventBus.on('UI', 'NAVIGATE_TO_ROW', ({ rowId, fieldName, searchText }) => {

            setTimeout(() => {
                const tr = this.container.querySelector(`.table-row[data-row-id="${rowId}"]`);
                if (tr) {

                    tr.scrollIntoView({ behavior: 'smooth', block: 'center' });


                    tr.classList.add('table-row-highlight');
                    setTimeout(() => tr.classList.remove('table-row-highlight'), 2000);

                    if (fieldName && searchText) {
                        const td = tr.querySelector(`td[data-field-name="${fieldName}"]`);
                        if (td) {
                            const cellText = td.textContent;
                            const lowerCell = cellText.toLowerCase();
                            const lowerSearch = searchText.toLowerCase();
                            const matchIndex = lowerCell.indexOf(lowerSearch);

                            if (matchIndex !== -1) {
                                const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                const before = cellText.substring(0, matchIndex);
                                const match = cellText.substring(matchIndex, matchIndex + searchText.length);
                                const after = cellText.substring(matchIndex + searchText.length);

                                td.innerHTML = `${escapeHtml(before)}<mark class="search-highlight">${escapeHtml(match)}</mark>${escapeHtml(after)}`;
                            }
                        }
                    }
                }
            }, 50);
        });

        eventBus.on('TABLE', 'FIELD_UPDATED', ({ row, fieldName, initiator }) => {

            if (initiator === 'revert' && String(row.id).startsWith('NEW_')) {
                const prefix = row.table.name.split('_')[0];
                if (fieldName === `${prefix}_id`) {

                    const tr = this.container.querySelector(`.table-row[data-row-id="${row.id}"]`);
                    if (tr) tr.remove();

                    const rowIndex = row.table.rows.findIndex(r => r.id === row.id);
                    if (rowIndex !== -1) {
                        row.table.rows.splice(rowIndex, 1);
                    }

                    if (row.table.rows.length === 0) {
                        const tbody = this.container.querySelector(`.tbody-table-${row.table.id || row.table.name}`);
                        if (tbody) {
                            const colCount = this.options.enableSelection ? row.table.fields.length + 1 : row.table.fields.length;
                            this.renderEmptyState(tbody, colCount);
                        }
                    }
                }
            }
        });
    }


    render(tables) {
        const tablesToRender = Array.isArray(tables) ? tables : [tables];

        this.container.innerHTML = '';

        tablesToRender.forEach(table => {
            if (!table.fields || table.fields.length === 0) {

                const wrapper = document.createElement('div');
                wrapper.classList.add('table-container');

                const title = document.createElement('h2');
                title.textContent = table.titel || table.name;

                if (Authenticator.canManageTable(table.id, table.groupId)) {
                    title.classList.add('cursor-context-menu');

                    title.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        eventBus.emit('UI', 'SHOW_CONTEXT_MENU', {
                            x: e.clientX,
                            y: e.clientY,
                            title: `Tabelle: ${table.titel || table.name}`,
                            items: [
                                {
                                    label: 'Tabelle bearbeiten',
                                    action: () => {
                                        const tabellenTable = table.dataLoader?.getTable(METATABLES.TABLES);
                                        if (!tabellenTable) return;
                                        const modal = new TableModal(tabellenTable, {
                                            filters: [{ field: 't_id', operator: 'equals', value: table.id }],
                                            groupBy: ''
                                        });
                                        modal.open();

                                        setTimeout(() => {
                                            eventBus.emit('UI', 'NAVIGATE_TO_ROW', {
                                                rowId: table.id
                                            });
                                        }, 100);
                                    }
                                }
                            ]
                        });
                    });
                }

                wrapper.appendChild(title);

                const pre = document.createElement('pre');
                pre.classList.add('table-debug-pre');

                const rowDataList = (table.rows || []).map(row => row.data);

                pre.textContent = JSON.stringify(rowDataList, null, 2);

                wrapper.appendChild(pre);
                this.container.appendChild(wrapper);

                return;
            }

            const tableSection = this.buildTableSection(table);
            this.container.appendChild(tableSection);
        });
    }

    buildTableSection(table) {

        if (table.fields && table.fields.length > 0) {
            table.fields = [...table.fields].sort((a, b) => {
                const weightA = a.weight !== undefined && a.weight !== null ? a.weight : 50;
                const weightB = b.weight !== undefined && b.weight !== null ? b.weight : 50;

                return weightA - weightB;
            });
        }

        const wrapper = document.createElement('div');
        wrapper.classList.add('table-container');

        const tableHeader = document.createElement('div');
        tableHeader.className = 'table-header';

        const title = document.createElement('h2');
        title.textContent = table.titel || table.name;

        tableHeader.appendChild(title);
        wrapper.appendChild(tableHeader);

        const scrollWrapper = document.createElement('div');
        scrollWrapper.className = 'table-scroll-wrapper';

        scrollWrapper.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                const canScroll = scrollWrapper.scrollWidth > scrollWrapper.clientWidth;
                if (canScroll) {
                    e.preventDefault();
                    scrollWrapper.scrollLeft += e.deltaY;
                }
            }
        }, { passive: false });

        const colCount = this.options.enableSelection ? table.fields.length + 1 : table.fields.length;

        const tableEl = document.createElement('table');
        tableEl.classList.add('data-table');

        const thead = this.buildHeader(table);
        tableEl.appendChild(thead);

        const filterTr = document.createElement('tr');
        const filterTd = document.createElement('td');

        filterTd.colSpan = colCount;
        filterTd.classList.add('table-filter-td');

        const defaultQuery = window.history.state?.defaultQuery;
        const filterPanel = new FilterPanel(table, {
            defaultQuery: defaultQuery,
            defaultCollapsed: defaultQuery ? false : true
        });


        const panelContainer = filterPanel.render();

        panelContainer.classList.add('table-filter-panel');

        filterTd.appendChild(panelContainer);
        filterTr.appendChild(filterTd);

        thead.insertBefore(filterTr, thead.firstChild);

        tableEl.appendChild(thead);

        const tbody = document.createElement('tbody');
        tbody.className = `tbody-table-${table.id}`;

        if (defaultQuery) {
            eventBus.emit('FILTER', 'APPLY_QUERY', {
                tables: [table],
                query: defaultQuery,
                callback: (results) => {
                    const filteredData = results[table.id || table.name] || [];
                    filteredData.forEach(row => {
                        const rowBuilder = new RowBuilder(row, table.fields, this.options);
                        tbody.appendChild(rowBuilder.build());
                    });
                    if (filteredData.length === 0) this.renderEmptyState(tbody, table.fields.length);
                }
            });
        } else {
            const rows = table.rows || [];
            rows.forEach(row => {
                const rowBuilder = new RowBuilder(row, table.fields, this.options);
                tbody.appendChild(rowBuilder.build());
            });
            if (rows.length === 0) this.renderEmptyState(tbody, table.fields.length);
        }

        eventBus.on('UI', 'TABLE_DATA_CHANGED', (payload) => {

            if (payload.tableId === (table.id || table.name)) {

                tbody.innerHTML = '';
                const filteredData = payload.data || [];
                if (Array.isArray(filteredData)) {
                    filteredData.forEach(row => {
                        const rowBuilder = new RowBuilder(row, table.fields, this.options);
                        tbody.appendChild(rowBuilder.build());
                    });

                    if (filteredData.length === 0) this.renderEmptyState(tbody, table.fields.length);

                } else {

                    Object.entries(filteredData).forEach(([groupName, groupRows]) => {

                        const groupTr = document.createElement('tr');
                        const groupTd = document.createElement('td');

                        groupTd.colSpan = colCount;
                        groupTd.textContent = groupName;
                        groupTd.classList.add('table-group-td');

                        groupTr.appendChild(groupTd);
                        tbody.appendChild(groupTr);

                        groupRows.forEach(row => {
                            const rowBuilder = new RowBuilder(row, table.fields);
                            tbody.appendChild(rowBuilder.build());
                        });
                    });

                    if (Object.keys(filteredData).length === 0) this.renderEmptyState(tbody, colCount);
                }
            }
        });

        tableEl.appendChild(tbody);

        if (Authenticator.canWriteTable(table.id, table.groupId)) {
            const tfoot = document.createElement('tfoot');
            const addRowTr = document.createElement('tr');
            const addRowTd = document.createElement('td');

            addRowTd.colSpan = colCount;

            addRowTd.classList.add('table-add-row-td');
            addRowTd.innerHTML = `
            <div class="table-add-row-btn">
                 + Reihe hinzufügen
            </div>
            `;

            addRowTd.addEventListener('click', () => {
                const tempId = `NEW_${Date.now()}`;

                const prefix = table.name.split('_')[0];
                const pkName = `${prefix}_id`;

                const newData = { [pkName]: tempId };

                table.fields.forEach(f => {
                    newData[f.name] =
                        this.options.defaultValues[f.name] !== undefined
                            ? this.options.defaultValues[f.name]
                            : '';
                });

                const newRow = new Row(newData, table);
                newRow.originalData = {};

                if (!table.rows) table.rows = [];
                table.rows.push(newRow);

                eventBus.emit('DATA', 'DATA_UPDATED', {
                    table: table.name,
                    rowId: newRow.id,
                    field: '__ROW_ACTION__',
                    value: 'ADD',
                    row: newRow
                });

                const emptyState = tbody.querySelector('.empty-state');
                if (emptyState) emptyState.parentElement.remove();

                const rowBuilder = new RowBuilder(newRow, table.fields, this.options);
                tbody.appendChild(rowBuilder.build());

                newRow.updateValue(pkName, tempId);
            });

            addRowTr.appendChild(addRowTd);
            tfoot.appendChild(addRowTr);
            tableEl.appendChild(tfoot);
        }

        scrollWrapper.appendChild(tableEl);
        wrapper.appendChild(scrollWrapper);
        return wrapper;
    }

    buildHeader(table) {
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');

        if (this.options.enableSelection) {
            const th = document.createElement('th');
            th.classList.add('table-select-th');

            const selectAllCheckbox = document.createElement('input');
            selectAllCheckbox.type = 'checkbox';
            selectAllCheckbox.className = 'select-all-checkbox';

            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = this.container.querySelectorAll('.row-select-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    cb.dispatchEvent(new Event('change'));
                });
            });

            th.appendChild(selectAllCheckbox);
            tr.appendChild(th);
        }

        table.fields.forEach(field => {

            const th = document.createElement('th');
            th.classList.add('table-header-th');

            const titleText = document.createElement('span');
            titleText.textContent = field.titel || field.name;
            th.appendChild(titleText);

            if (Authenticator.canManageTable(table.id, table.groupId)) {
                TableManager.attachTo(th, tr, table, field);
            }

            tr.appendChild(th);

        });

        thead.appendChild(tr);
        return thead;
    }

    renderEmptyState(tbody, colSpan) {

        const emptyTr = document.createElement('tr');
        const emptyTd = document.createElement('td');

        emptyTd.colSpan = colSpan || 1;
        emptyTd.textContent = 'Keine Datensätze gefunden.';
        emptyTd.classList.add('empty-state');

        emptyTr.appendChild(emptyTd);

        tbody.appendChild(emptyTr);
    }
}
