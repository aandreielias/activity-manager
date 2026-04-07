export class TableSorter {
    constructor(table) {
        this.table = table;
        this._sortCol = null;
        this._sortDir = 'asc';
    }

    sortBy(colId, clickedTh) {
        // null -> asc -> desc -> null
        if (this._sortCol === colId) {
            if (this._sortDir === 'asc') this._sortDir = 'desc';
            else if (this._sortDir === 'desc') {
                this._sortDir = null;
                this._sortCol = null;
            }
            else this._sortDir = 'asc';
        } else {
            this._sortCol = colId;
            this._sortDir = 'asc';
        }

        // sort the rows array
        this.table.rows.sort((a, b) => {
            if (!this._sortDir) {
                return (a.defaultIndex || 0) - (b.defaultIndex || 0);
            }

            let valA = a.data[colId] ?? '';
            let valB = b.data[colId] ?? '';

            // Handle objects (e.g. Location objects)
            if (valA && typeof valA === 'object') valA = valA.title || valA.name || valA.label || '';
            if (valB && typeof valB === 'object') valB = valB.title || valB.name || valB.label || '';

            const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
            return this._sortDir === 'asc' ? cmp : -cmp;
        });

        // update sort indicators on all headers
        this.table.renderer.element.querySelectorAll('thead th').forEach(th => {
            th.dataset.sort = '';
        });
        if (this._sortDir) {
            clickedTh.dataset.sort = this._sortDir;
        }

        // re-render tbody
        this.table.renderer.reRenderBody();
    }
}
