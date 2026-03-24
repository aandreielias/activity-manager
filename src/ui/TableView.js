export class TableView {
    /**
     * @param {Object} config
     * @param {string} config.tableId
     * @param {string} config.title
     * @param {Array<{id: string, label: string, type: string}>} config.columns
     * @param {Array<Object>} config.rows
     */
    constructor({ tableId, title, columns = [], rows = [] }) {

        this.tableId = tableId;
        this.title = title;
        this.columns = columns;
        this.rows = rows;
        this.element = null;
    }

    render() {

        this.element = document.createElement('div');
        this.element.className = 'table-wrapper';
        this.element.dataset.tableId = this.tableId;

        this.element.innerHTML = `
      <div class="table-header">
        <span class="table-title">${this.title}</span>
        <span class="table-meta">${this.rows.length} rows</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>${this._renderHead()}</thead>
          <tbody>${this._renderBody()}</tbody>
        </table>
      </div>
    `;

        this._injectStyles();
        return this.element;
    }

    _renderHead() {

        const cells = this.columns
            .map(col => `<th data-col="${col.id}">${col.label}</th>`)
            .join('');
        return `<tr>${cells}</tr>`;
    }

    _renderBody() {

        if (this.rows.length === 0) return this._renderEmpty();

        return this.rows
            .map(row => `
        <tr data-row="${row.id}">
          ${this.columns.map(col => `
            <td data-col="${col.id}">
              ${row[col.id] ?? '—'}
            </td>
          `).join('')}
        </tr>
      `)
            .join('');
    }

    _renderEmpty() {

        return `
      <tr class="empty-row">
        <td colspan="${this.columns.length}">No entries yet</td>
      </tr>
    `;
    }

    updateRows(rows) {

        this.rows = rows;

        const tbody = this.element?.querySelector('tbody');
        const meta = this.element?.querySelector('.table-meta');

        if (tbody) tbody.innerHTML = this._renderBody();
        if (meta) meta.textContent = `${rows.length} rows`;
    }

    _injectStyles() {

        if (document.getElementById('table-styles')) return;

        const style = document.createElement('style');
        style.id = 'table-styles';
        style.textContent = `
            .table-wrapper {
              background: var(--bg);
              border: 1px solid var(--border);
              border-radius: var(--radius);
              overflow: hidden;
              box-shadow: var(--shadow-sm);
              transition: background var(--transition), border-color var(--transition);
            }
            .table-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 14px 18px;
              border-bottom: 1px solid var(--border);
            }
            .table-title {
              font-size: 13px;
              font-weight: 600;
              color: var(--text-primary);
              letter-spacing: -0.01em;
            }
            .table-meta {
              font-size: 12px;
              color: var(--text-muted);
              font-family: 'DM Mono', monospace;
            }
            .table-scroll {
              overflow-x: auto;
            }
            .data-table {
              width: 100%;
              border-collapse: collapse;
            }
            .data-table th {
              padding: 8px 18px;
              text-align: left;
              font-size: 11px;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: var(--text-muted);
              background: var(--bg-secondary);
              border-bottom: 1px solid var(--border);
              white-space: nowrap;
            }
            .data-table td {
              padding: 10px 18px;
              font-size: 13px;
              color: var(--text-primary);
              border-bottom: 1px solid var(--border);
              transition: background var(--transition);
            }
            .data-table tr:last-child td {
              border-bottom: none;
            }
            .data-table tbody tr:hover td {
              background: var(--bg-hover);
            }
            .empty-row td {
              text-align: center;
              color: var(--text-muted);
              font-size: 13px;
              padding: 32px 18px;
            }
        `;
        document.head.appendChild(style);
    }
}