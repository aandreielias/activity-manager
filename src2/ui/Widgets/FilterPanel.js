import { eventBus } from "../../events/EventBus";

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
        container.style.flexDirection = 'column';
        container.style.gap = '16px';
        container.style.alignItems = 'stretch';

        const topSection = document.createElement('div');
        topSection.style.display = 'flex';
        topSection.style.justifyContent = 'space-between';
        topSection.style.alignItems = 'flex-start';
        topSection.style.gap = '16px';
        topSection.style.flexWrap = 'wrap';

        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.alignItems = 'center';
        topRow.style.gap = '32px';
        topRow.style.flexWrap = 'wrap';

        const groupSection = document.createElement('div');
        groupSection.style.display = 'flex';
        groupSection.style.alignItems = 'center';
        groupSection.style.gap = '12px';

        const groupLabel = document.createElement('span');
        groupLabel.textContent = 'Gruppieren:';
        groupLabel.style.fontWeight = '500';
        groupLabel.style.fontSize = '13px';
        groupLabel.style.color = 'var(--text-secondary)';

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
        draftSection.style.display = 'flex';
        draftSection.style.alignItems = 'center';
        draftSection.style.gap = '8px';

        let draftFilter = { field: '', operator: 'contains', value: '', invert: false };

        const filterLabel = document.createElement('span');
        filterLabel.textContent = 'Filtern:';
        filterLabel.style.fontWeight = '500';
        filterLabel.style.fontSize = '13px';
        filterLabel.style.color = 'var(--text-secondary)';

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
                invertBtn.style.background = 'var(--color-error)';
                invertBtn.style.color = '#fff';
                invertBtn.style.border = '1px solid var(--color-error)';
            } else {
                invertBtn.style.background = 'transparent';
                invertBtn.style.color = 'var(--text-secondary)';
                invertBtn.style.border = '1px solid var(--border)';
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
        appliedFiltersArea.style.display = 'flex';
        appliedFiltersArea.style.flexWrap = 'wrap';
        appliedFiltersArea.style.gap = '8px';
        appliedFiltersArea.style.borderTop = '1px solid var(--border)';
        appliedFiltersArea.style.paddingTop = '12px';
        appliedFiltersArea.style.marginTop = '4px';

        const renderBadges = () => {
            appliedFiltersArea.innerHTML = '';

            this.filters = this.filters.filter(f => f.field !== '');

            this.filters.forEach((f, index) => {
                const badge = document.createElement('div');
                badge.style.display = 'flex';
                badge.style.alignItems = 'center';
                badge.style.gap = '6px';
                badge.style.padding = '4px 8px';
                badge.style.background = 'var(--bg-tertiary)';
                badge.style.border = '1px solid var(--border)';
                badge.style.borderRadius = 'var(--radius)';
                badge.style.fontSize = '12px';
                badge.style.color = 'var(--text-primary)';

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
                removeBtn.style.cursor = 'pointer';
                removeBtn.style.color = 'var(--color-error)';
                removeBtn.style.marginLeft = '4px';
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
                emptyMsg.style.color = 'var(--text-secondary)';
                emptyMsg.style.fontSize = '12px';
                appliedFiltersArea.appendChild(emptyMsg);
            }
        };

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'row';
        buttonContainer.style.gap = '8px';
        buttonContainer.style.marginLeft = '16px';

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