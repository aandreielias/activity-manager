import { Row } from './Row.js';
import { TableRenderer } from './TableRenderer.js';
import { TableSorter } from './TableSorter.js';
import { TableEditor } from './TableEditor.js';
import { TableDataManager } from './TableDataManager.js';

export class Table {
    /**
     * @param {Object}   json
     * @param {string}   json.id
     * @param {string}   json.title
     * @param {Object[]} json.schema   - column definitions
     * @param {Object[]} json.rows     - raw row data
     * @param {Object[]} json.peopleData - people data for relations
     * @param {Object}   json.tableConfig - table configuration from tables.json
     */
    constructor(json) {
        this.id = json.id;
        this.title = json.title;
        this.schema = json.schema;
        this.peopleData = json.peopleData;
        this.sourceData = json.sourceData || null;

        this.rows = json.rows.map((r, i) => new Row({
            id: r.id,
            data: r,
            schema: json.schema,
            peopleData: json.peopleData,
            tableId: json.id,
            defaultIndex: i
        }));
        this.element = null;
        this.tableConfig = json.tableConfig;

        this.localFilters = {
            active: false,
            groupBy: null,
            filters: [{ attrId: null, mode: null, value: [], quantityMode: 'any', quantityValue: '', availability: [] }]
        };

        // Compose with smaller classes
        this.renderer = new TableRenderer(this);
        this.sorter = new TableSorter(this);
        this.editor = new TableEditor(this);
        this.dataManager = new TableDataManager(this);

        this._tbody = null; // Will be set by renderer
        this.onDataChangeCallbacks = [];
    }

    onDataChange(cb) {
        this.onDataChangeCallbacks.push(cb);
    }

    notifyDataChange() {
        this.onDataChangeCallbacks.forEach(cb => cb());
    }

    render() {
        this.element = this.renderer.render();
        return this.element;
    }

    addRow(rowData) {
        return this.dataManager.addRow(rowData);
    }

    removeRow(id) {
        this.dataManager.removeRow(id);
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            schema: this.schema,
            rows: this.rows.map(r => r.toJSON()),
        };
    }
}