import { eventBus } from "../../events/EventBus.js";


export class FilterPanel {
    constructor(table, options = {}) {
        this.table = table;
        this.isCollapsed = options.defaultCollapsed !== undefined ? options.defaultCollapsed : true;

        this.currentQuery = options.defaultQuery || { filters: [], groupBy: '' };

        this.filters = this.currentQuery.filters && this.currentQuery.filters.length > 0 ? JSON.parse(JSON.stringify(this.currentQuery.filters)) : [{ field: '', operator: 'contains', value: '', invert: false }];
        this.groupBy = this.currentQuery.groupBy || '';

        this.container = document.createElement('div');
        this.container.classList.add('filter-panel-wrapper');
    }

    render() {
        this.container.innerHTML = '';

        const header = document.createElement('div');
        header.classList.add('filter-panel-header');

        const toggleIcon = document.createElement('span');

        toggleIcon.classList.add('filter-panel-icon');
        toggleIcon.textContent = this.isCollapsed ? '▶' : '▼';

        const titleSpan = document.createElement('span');
        titleSpan.textContent = `Filter`;

        header.appendChild(toggleIcon);
        header.appendChild(titleSpan);

        header.addEventListener('click', () => {
            this.isCollapsed = !this.isCollapsed;
            this.render();
        });

        this.container.appendChild(header);

        if (!this.isCollapsed) {

            const body = document.createElement('div');
            body.classList.add('filter-panel-body');

            eventBus.emit('FILTER', 'GET_OPTIONS', {
                table: this.table,
                callback: (options) => this._renderControls(body, options)
            });

            this.container.appendChild(body);
        }

        return this.container;
    }

    _renderControls(container, options) {
        container.classList.add('filter-panel-controls');

        const topSection = document.createElement('div');
        topSection.classList.add('filter-top-section');

        const topRow = document.createElement('div');
        topRow.classList.add('filter-top-row');

        const groupSection = document.createElement('div');
        groupSection.classList.add('filter-group-section');

        const groupLabel = document.createElement('span');
        groupLabel.textContent = 'Gruppieren:';
        groupLabel.classList.add('filter-label');

        const groupSelect = document.createElement('select');
        groupSelect.classList.add('widget-input');
        groupSelect.innerHTML = '<option value="">None</option>';
        options.groupable.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.label;
            if (this.groupBy === f.id) opt.selected = true;
            groupSelect.appendChild(opt);
        });
        groupSelect.addEventListener('change', e => {
            this.groupBy = e.target.value;
            triggerQuery();
        });

        groupSection.append(groupLabel, groupSelect);

        const getCombinedFilters = () => {
            const combined = [...this.filters];

            if (draftFilter.field && draftFilter.value) {
                let val = draftFilter.value;
                const fieldOpt = options.filterable.find(opt => opt.id === draftFilter.field);

                if (fieldOpt && (fieldOpt.type === 'enum' || fieldOpt.type === 'key') && typeof val === 'string' && val.includes(',')) {
                    val = val.split(',').map(v => v.trim()).filter(v => v.length > 0);
                }

                combined.push({
                    field: draftFilter.field,
                    operator: draftFilter.operator,
                    value: val,
                    invert: draftFilter.invert
                });
            }
            return combined;
        };

        const triggerQuery = () => {
            this.currentQuery = { filters: getCombinedFilters(), groupBy: this.groupBy };

            eventBus.emit('FILTER', 'APPLY_QUERY', {
                tables: [this.table], query: this.currentQuery,

                callback: (results) => {
                    eventBus.emit('UI', 'TABLE_DATA_CHANGED', {
                        tableId: this.table.id || this.table.name,
                        data: results[this.table.id || this.table.name], query: this.currentQuery
                    });
                }
            });
        };

        const draftSection = document.createElement('div');
        draftSection.classList.add('filter-draft-section');

        let draftFilter = { field: '', operator: 'contains', value: '', invert: false };

        const filterLabel = document.createElement('span');
        filterLabel.textContent = 'Filtern:';
        filterLabel.classList.add('filter-label');

        const fieldSelect = document.createElement('select');
        fieldSelect.classList.add('widget-input');
        fieldSelect.innerHTML = '<option value="">Select Field...</option>';

        options.filterable.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.label;
            opt.dataset.type = f.type;
            fieldSelect.appendChild(opt);
        });

        const operatorSelect = document.createElement('select');
        operatorSelect.classList.add('widget-input');

        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.classList.add('widget-input');
        valueInput.placeholder = 'Search value...';

        const invertBtn = document.createElement('button');
        invertBtn.textContent = '!=';
        invertBtn.classList.add('widget-btn');

        const updateInvert = () => {
            if (draftFilter.invert) {
                invertBtn.classList.remove('filter-invert-inactive');
                invertBtn.classList.add('filter-invert-active');
            } else {
                invertBtn.classList.remove('filter-invert-active');
                invertBtn.classList.add('filter-invert-inactive');
            }
        };
        updateInvert();
        invertBtn.addEventListener('click', () => { draftFilter.invert = !draftFilter.invert; updateInvert(); triggerQuery(); });

        const populateOperators = (fieldType) => {
            operatorSelect.innerHTML = '';
            const type = fieldType || 'text';
            const opsMap = {
                text: [{ val: 'contains', label: 'enthält' }, { val: 'equals', label: 'gleich' }, { val: 'startsWith', label: 'beginnt mit' }, { val: 'endsWith', label: 'endet mit' }],
                number: [{ val: 'equals', label: 'gleich' }, { val: 'bigger', label: 'größer' }, { val: 'smaller', label: 'kleiner' }],
                date: [{ val: 'equals', label: 'gleich' }, { val: 'after', label: 'nach' }, { val: 'before', label: 'bevor' }],
                enum: [{ val: 'equals', label: 'gleich' }],
                key: [{ val: 'equals', label: 'gleich' }]
            };
            (opsMap[type] || opsMap.text).forEach(op => {
                const opt = document.createElement('option');
                opt.value = op.val;
                opt.textContent = op.label;
                operatorSelect.appendChild(opt);
            });
            valueInput.placeholder = (type === 'enum' || type === 'key') ? 'Value... (comma separated)' : 'Search value...';
            if (operatorSelect.options.length > 0) draftFilter.operator = operatorSelect.options[0].value;
        };

        fieldSelect.addEventListener('change', (e) => {
            draftFilter.field = e.target.value;
            const sel = e.target.options[e.target.selectedIndex];
            if (sel && sel.value) populateOperators(sel.dataset.type);
            else operatorSelect.innerHTML = '';
            triggerQuery();
        });

        operatorSelect.addEventListener('change', e => {
            draftFilter.operator = e.target.value
            triggerQuery();
        });

        valueInput.addEventListener('input', e => {
            draftFilter.value = e.target.value
            triggerQuery();
        });

        draftSection.append(filterLabel, fieldSelect, operatorSelect, valueInput, invertBtn);
        topRow.append(groupSection, draftSection);

        const appliedFiltersArea = document.createElement('div');
        appliedFiltersArea.classList.add('filter-applied-area');

        const renderBadges = () => {
            appliedFiltersArea.innerHTML = '';

            this.filters = this.filters.filter(f => f.field !== '');

            this.filters.forEach((f, index) => {
                const badge = document.createElement('div');
                badge.classList.add('filter-badge');

                const fieldName = options.filterable.find(opt => opt.id === f.field)?.label || f.field;

                const opLabels = {
                    contains: 'enthält', equals: 'gleich', startsWith: 'beginnt mit', endsWith: 'endet mit',
                    bigger: 'größer', smaller: 'kleiner', after: 'nach', before: 'bevor'
                };

                const opName = opLabels[f.operator] || f.operator;
                const notStr = f.invert ? 'NICHT ' : '';
                badge.textContent = `${notStr}${fieldName} ${opName} "${f.value}"`;

                const removeBtn = document.createElement('span');
                removeBtn.innerHTML = '&#10006;';
                removeBtn.classList.add('filter-badge-remove');
                removeBtn.addEventListener('click', () => {
                    this.filters.splice(index, 1);
                    renderBadges();
                    triggerQuery();

                    this.currentQuery = { filters: this.filters, groupBy: this.groupBy };
                    eventBus.emit('FILTER', 'APPLY_QUERY', {
                        tables: [this.table], query: this.currentQuery,
                        callback: (results) => {
                            eventBus.emit('UI', 'TABLE_DATA_CHANGED', {
                                tableId: this.table.id || this.table.name,
                                data: results[this.table.id || this.table.name], query: this.currentQuery
                            });
                        }
                    });
                });
                badge.appendChild(removeBtn);
                appliedFiltersArea.appendChild(badge);
            });

            if (this.filters.length === 0) {
                const emptyMsg = document.createElement('span');
                emptyMsg.textContent = 'Kein Filter erstellt';
                emptyMsg.classList.add('filter-empty-msg');
                appliedFiltersArea.appendChild(emptyMsg);
            }
        };

        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('filter-button-container');

        const executeApply = () => {
            if (draftFilter.field && draftFilter.value) {

                let val = draftFilter.value;
                const fieldOpt = options.filterable.find(opt => opt.id === draftFilter.field);

                if (fieldOpt && (fieldOpt.type === 'enum' || fieldOpt.type === 'key') && typeof val === 'string' && val.includes(',')) {
                    val = val.split(',').map(v => v.trim()).filter(v => v.length > 0);
                }

                this.filters.push({
                    field: draftFilter.field,
                    operator: draftFilter.operator,
                    value: val,
                    invert: draftFilter.invert
                });

                draftFilter = { field: '', operator: 'contains', value: '', invert: false };
                fieldSelect.value = '';
                operatorSelect.innerHTML = '';
                valueInput.value = '';

                updateInvert();

                renderBadges();
                triggerQuery();
            }
        };

        renderBadges();

        const applyBtn = document.createElement('button');
        applyBtn.classList.add('widget-btn', 'widget-btn-primary');
        applyBtn.textContent = 'Filter erstellen';
        applyBtn.addEventListener('click', executeApply);

        const clearBtn = document.createElement('button');
        clearBtn.classList.add('widget-btn', 'widget-btn-secondary');
        clearBtn.textContent = 'Filter entfernen';

        clearBtn.addEventListener('click', () => {
            this.filters = [];
            this.groupBy = '';

            groupSelect.value = '';
            draftFilter = { field: '', operator: 'contains', value: '', invert: false };

            fieldSelect.value = '';
            operatorSelect.innerHTML = '';
            valueInput.value = '';

            updateInvert();

            renderBadges();
            triggerQuery();
        });

        buttonContainer.append(applyBtn, clearBtn);

        topSection.append(topRow, buttonContainer);

        container.append(topSection, appliedFiltersArea);
    }
}