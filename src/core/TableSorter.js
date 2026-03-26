export class TableSorter {
    constructor(table) {
        this.table = table;
        this._sortCol = null;
        this._sortDir = 'asc';
    }

    sortBy(colId, clickedTh) {
        // toggle direction if same column, else default to asc
        if (this._sortCol === colId) {
            this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this._sortCol = colId;
            this._sortDir = 'asc';
        }

        // sort the rows array
        this.table.rows.sort((a, b) => {
            const valA = a.data[colId] ?? '';
            const valB = b.data[colId] ?? '';
            const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
            return this._sortDir === 'asc' ? cmp : -cmp;
        });

        // update sort indicators on all headers
        this.table.renderer.element.querySelectorAll('thead th').forEach(th => {
            th.dataset.sort = '';
        });
        clickedTh.dataset.sort = this._sortDir;

        // re-render tbody
        this.table.renderer.reRenderBody();
    }
}
