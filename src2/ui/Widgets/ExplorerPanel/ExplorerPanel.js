import { eventBus } from '../../../events/EventBus.js';

export class ExplorerPanel {
  constructor(container, teams) {
    this.container = container || document.body;
    this.teams = teams || [];
    this.element = null;

    this._collapsedNodes = new Set();
    this._activeTableId = null;
    this._dirtyTables = new Set();

    this.render();

    eventBus.on('UI', 'NAV_GROUP_SELECTED', (tables) => {
      if (!tables || tables.length === 0) return;

      if (tables.length === 1) {

        this._activeNodeId = `table_${tables[0].name}`;
      } else {

        let matched = false;

        for (const team of this.teams) {

          for (const group of team.groups || []) {
            const gTables = group.tables || [];
            if (gTables.length === tables.length && gTables.every((t, idx) => t.name === tables[idx].name)) {
              this._activeNodeId = `group_${group.id}`;
              matched = true;
              break;
            }
          }
          if (matched) break;
        }

        if (!matched) {

          for (const team of this.teams) {

            const teamTables = team.groups?.flatMap(g => g.tables || []) || [];
            if (teamTables.length === tables.length && teamTables.every((t, idx) => t.name === tables[idx].name)) {
              this._activeNodeId = `team_${team.id}`;
              break;
            }
          }
        }
      }
      this._updateActiveHighlight();
    });

    eventBus.on('UI', 'CHANGES_MADE', (changes) => {
      this._dirtyTables = new Set(changes.map(ch => ch.table));
      this._renderList();
    });
  }

  render() {
    if (this.element) return this.element;

    this.element = document.createElement('aside');
    this.element.className = `ui-panel explorer-panel`;
    this.element.innerHTML = `
      <div class="ui-panel-header">
        <div class="ui-panel-title">Explorer</div>
        <div class="explorer-panel-actions">
          <button class="ui-btn-action btn-expand-all" title="Expand/Collapse All">↕</button>
        </div>
      </div>
      <div class="ui-panel-body">
        <table class="ui-table explorer-table">
          <thead>
            <tr>
              <th>Tabellen</th>
              <th>Einträge</th>
              <th class="col-status"></th>
            </tr>
          </thead>
          <tbody class="explorer-tbody"></tbody>
        </table>
      </div>
      <div class="ui-panel-footer">
        <small class="explorer-summary">0 Tabellen geladen</small>
      </div>
    `;

    this.container.appendChild(this.element);
    this._attachEventListeners();
    this._renderList();

    return this.element;
  }

  _attachEventListeners() {

    this.element.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });


    const toggleBtn = this.element.querySelector('.btn-expand-all');

    toggleBtn.addEventListener('click', () => {

      if (this._collapsedNodes.size > 0) {
        this._collapsedNodes.clear();
      } else {
        this.teams.forEach(t => {
          this._collapsedNodes.add(`team_${t.id}`);
          t.groups?.forEach(g => this._collapsedNodes.add(`group_${g.id}`));
        });
      }
      this._renderList();
    });
  }

  _renderList() {
    const tbodyEl = this.element.querySelector('.explorer-tbody');
    const summaryEl = this.element.querySelector('.explorer-summary');

    tbodyEl.innerHTML = '';
    let totalTablesCount = 0;

    this.teams.forEach(team => {
      const teamId = `team_${team.id}`;
      const isTeamCollapsed = this._collapsedNodes.has(teamId);


      const teamTr = document.createElement('tr');
      teamTr.className = 'explorer-row row-team';
      teamTr.innerHTML = `
        <td class="ui-table-cell explorer-cell-node depth-0">
          <span class="caret-icon">${isTeamCollapsed ? '▶' : '▼'}</span>
          <span class="node-title">${this._escapeHtml(team.name)}</span>
        </td>
        <td class="ui-table-cell explorer-cell-meta">-</td>
        <td class="explorer-cell-status"></td>
      `;


      teamTr.querySelector('.caret-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        if (isTeamCollapsed) this._collapsedNodes.delete(teamId);
        else this._collapsedNodes.add(teamId);
        this._renderList();
      });

      teamTr.addEventListener('click', () => {
        const allTablesInTeam = team.groups?.flatMap(g => g.tables || []) || [];
        if (allTablesInTeam.length > 0) {
          this._activeNodeId = teamId;
          this._updateActiveHighlight();

          const baseUrl = import.meta.env.BASE_URL;

          window.history.pushState({}, '', `${baseUrl}${encodeURIComponent(team.name)}`);
          eventBus.emit('UI', 'URL_CHANGED');
        }
      });

      tbodyEl.appendChild(teamTr);

      if (isTeamCollapsed) return;

      team.groups?.forEach(group => {
        const groupId = `group_${group.id}`;
        const isGroupCollapsed = this._collapsedNodes.has(groupId);


        const groupTr = document.createElement('tr');

        groupTr.className = 'explorer-row row-group';
        groupTr.innerHTML = `
          <td class="ui-table-cell explorer-cell-node depth-1">
            <span class="caret-icon">${isGroupCollapsed ? '▶' : '▼'}</span>
            <span class="node-title">${this._escapeHtml(group.name)}</span>
          </td>
          <td class="ui-table-cell explorer-cell-meta">-</td>
          <td class="explorer-cell-status"></td>
        `;


        groupTr.querySelector('.caret-icon').addEventListener('click', (e) => {
          e.stopPropagation();
          if (isGroupCollapsed) this._collapsedNodes.delete(groupId);
          else this._collapsedNodes.add(groupId);
          this._renderList();
        });

        groupTr.addEventListener('click', () => {
          const allTablesInGroup = group.tables || [];
          if (allTablesInGroup.length > 0) {
            this._activeNodeId = groupId;
            this._updateActiveHighlight();

            const baseUrl = import.meta.env.BASE_URL;

            window.history.pushState({}, '', `${baseUrl}${encodeURIComponent(team.name)}/${encodeURIComponent(group.name)}`);
            eventBus.emit('UI', 'URL_CHANGED');
          }
        });

        tbodyEl.appendChild(groupTr);

        if (isGroupCollapsed) return;

        group.tables?.forEach(table => {
          totalTablesCount++;

          const tableId = table.name;
          const isTableActive = this._activeTableId === tableId;
          const isTableDirty = this._dirtyTables.has(tableId);
          const rowsCount = table.rows ? table.rows.length : 0;


          const tableTr = document.createElement('tr');

          tableTr.className = `explorer-row row-table ${isTableActive ? 'active' : ''}`;
          tableTr.dataset.nodeId = `table_${tableId}`;

          tableTr.innerHTML = `
            <td class="ui-table-cell explorer-cell-node depth-2">
              <span class="caret-icon leaf"></span>
              <span class="node-title">${this._escapeHtml(table.titel || table.name)}</span>
            </td>
            <td class="ui-table-cell explorer-cell-meta">${rowsCount} Reihen</td>
            <td class="explorer-cell-status">
              ${isTableDirty ? '<span class="status-dot pulsing" title="Uncommitted changes">●</span>' : ''}
            </td>
          `;

          tableTr.addEventListener('click', () => {
            this._activeNodeId = `table_${tableId}`;
            this._updateActiveHighlight();

            const baseUrl = import.meta.env.BASE_URL;

            window.history.pushState({}, '', `${baseUrl}${encodeURIComponent(team.name)}/${encodeURIComponent(group.name)}/${encodeURIComponent(table.titel || table.name)}`);
            eventBus.emit('UI', 'URL_CHANGED');
          });

          tbodyEl.appendChild(tableTr);
        });
      });
    });

    summaryEl.textContent = `${totalTablesCount} Tabelle${totalTablesCount !== 1 ? 'n' : ''} geladen`;
  }

  _updateActiveHighlight() {
    this.element.querySelectorAll('.explorer-row').forEach(tr => {
      if (tr.dataset.nodeId === this._activeNodeId) {
        tr.classList.add('active');
      } else {
        tr.classList.remove('active');
      }
    });
  }

  _escapeHtml(string) {
    return String(string)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
