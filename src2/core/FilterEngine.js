import { eventBus } from '../events/EventBus.js';

export class FilterEngine {
    constructor() {
        this._setupListeners();
    }

    _setupListeners() {

        eventBus.on('FILTER', 'APPLY_QUERY', ({ tables, query, callback }) => {
            const results = this.processQuery(tables, query);
            if (callback) callback(results);
            eventBus.emit('FILTER', 'QUERY_APPLIED', { results, query });
        });

        eventBus.on('FILTER', 'GET_OPTIONS', ({ table, callback }) => {
            if (callback) callback(this.getValidOptions(table));
        });

        eventBus.on('FILTER', 'GLOBAL_SEARCH', ({ tables, text, callback }) => {
            const results = this.globalSearch(tables, text);
            if (callback) callback(results);
        });
    }

    getValidOptions(table) {
        if (!table || !table.fields) return { filterable: [], groupable: [] };

        const options = table.fields.map(f => ({
            id: f.name || f.id,
            label: f.titel,
            type: f.type || 'text'
        }));

        const groupable = options.filter(opt => opt.type === 'enum' || opt.type === 'key' || opt.type === 'junction');

        return {
            filterable: options,
            groupable: groupable
        };
    }

    processQuery(tables, query) {
        const tableList = Array.isArray(tables) ? tables : [tables];
        const results = {};

        tableList.forEach(table => {

            const tableKey = table.id || table.name;

            if (!table.rows || !query) {
                results[tableKey] = table.rows || [];
                return;
            }

            let filteredRows = [...table.rows];

            if (query.filters && query.filters.length > 0) {
                query.filters.forEach(filterObj => {

                    if (filterObj.field) {
                        filteredRows = this._applyFilter(filteredRows, filterObj);
                    }
                });
            }

            if (query.groupBy) {
                results[tableKey] = this._applyGrouping(filteredRows, { field: query.groupBy }, table);
            } else {
                results[tableKey] = filteredRows;
            }
        });
        return results;
    }

    _applyFilter(rows, query) {
        const { field, operator, value, invert } = query;

        if (!field || value === undefined || value === '') return [...rows];

        return rows.filter(row => {
            const cellValue = row.getCellValue(field);

            if (cellValue === undefined || cellValue === null) {
                return invert ? true : false;
            }

            let match = false;
            if (Array.isArray(value) && operator === 'equals') {
                const lowerCell = String(cellValue).toLowerCase();
                match = value.some(v => String(v).toLowerCase() === lowerCell);

            } else {

                const strCellValue = String(cellValue).toLowerCase();
                const strValue = String(value).toLowerCase();
                const numCellValue = Number(cellValue);
                const numValue = Number(value);

                switch (operator) {
                    case 'equals':
                        match = strCellValue === strValue;
                        break;
                    case 'contains':
                        match = strCellValue.includes(strValue);
                        break;
                    case 'startsWith':
                        match = strCellValue.startsWith(strValue);
                        break;
                    case 'endsWith':
                        match = strCellValue.endsWith(strValue);
                        break;
                    case 'bigger':
                    case 'after':
                        match = !isNaN(numCellValue) && !isNaN(numValue)
                            ? numCellValue > numValue
                            : strCellValue > strValue;
                        break;
                    case 'smaller':
                    case 'before':
                        match = !isNaN(numCellValue) && !isNaN(numValue)
                            ? numCellValue < numValue
                            : strCellValue < strValue;
                        break;
                    default:
                        match = strCellValue.includes(strValue);
                }
            }
            return invert ? !match : match;
        });
    }

    _applyGrouping(rows, query, table) {

        const { field } = query;

        if (!field || !table) return rows;

        const fieldDef = table.fields.find(f => f.name === field || f.id === field);
        if (!fieldDef) return rows;

        const groups = {};

        rows.forEach(row => {
            if (fieldDef.type === 'junction') {
                const junctionTableName = fieldDef.reference;
                const junctionTable = table.dataLoader?.getTable(junctionTableName);

                if (junctionTable) {
                    const sourceRefField = junctionTable.fields.find(f => f.reference === table.name);
                    if (sourceRefField) {

                        const relatedRows = (junctionTable.rows || []).filter(r => r.data[sourceRefField.name] === row.id);

                        if (relatedRows.length === 0) {
                            if (!groups['Keine Daten']) groups['Keine Daten'] = [];
                            groups['Keine Daten'].push(row);

                        } else {
                            relatedRows.forEach(jRow => {
                                const groupKey = jRow.getLabel();

                                if (!groups[groupKey]) groups[groupKey] = [];
                                groups[groupKey].push(row);
                            });
                        }
                        return;
                    }
                }

                if (!groups['Ungrouped']) groups['Ungrouped'] = [];
                groups['Ungrouped'].push(row);
                return;
            }

            const cellValue = fieldDef.name ? row.getCellValue(fieldDef.name) : null;
            let groupKey = 'Ungrouped';
            if (cellValue !== undefined && cellValue !== null && cellValue !== '') {

                if (fieldDef.type === 'key' && fieldDef.referenceData) {
                    const ids = String(cellValue).split(',').map(s => s.trim());
                    const labels = ids.map(id => {
                        const match = fieldDef.referenceData.find(r => r.id == id);
                        return match ? match.label : id;
                    });

                    groupKey = labels.join(', ');
                } else {
                    groupKey = String(cellValue);
                }
            }

            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(row);
        });
        return groups;
    }

    globalSearch(tables, searchText) {
        if (!searchText) return [];

        const tableList = Array.isArray(tables) ? tables : [tables];
        const results = [];
        const lowerSearch = searchText.toLowerCase();

        tableList.forEach(table => {
            if (!table.rows) return;

            table.rows.forEach(row => {
                let matchFound = false;
                let matchedFieldName = null;

                for (const [key, value] of Object.entries(row.data)) {
                    if (value !== null && value !== undefined && String(value).toLowerCase().includes(lowerSearch)) {
                        matchFound = true;
                        matchedFieldName = key;
                        break;
                    }
                }

                if (matchFound) {
                    const fieldDef = table.fields?.find(f => f.name === matchedFieldName);
                    const fieldLabel = fieldDef ? (fieldDef.titel || fieldDef.name) : matchedFieldName;

                    results.push({
                        tableName: table.titel || table.name,
                        tableId: table.id,
                        rowId: row.id,
                        fieldLabel: fieldLabel,
                        fieldName: matchedFieldName,
                        row: row
                    });
                }
            });
        });

        return results;
    }
}

export const filerEngine = new FilterEngine();