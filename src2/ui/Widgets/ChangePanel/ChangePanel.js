import { eventBus } from '../../../events/EventBus.js';
import { FieldBuilder } from '../../Builders/Table/FieldBuilder.js';


export class ChangePanel {
  constructor(container) {
    this.container = container || document.body;
    this.element = null;

    this._changes = [];
    this._boundOnChanges = this._onChanges.bind(this);

    this.render();

    eventBus.on('UI', 'CHANGES_MADE', (changes) => {
      this._boundOnChanges(changes);
    });

    eventBus.on('DATABASE', 'SAVE_SUCCESS', ({ changes }) => {
      document.body.style.cursor = '';

      changes.forEach(ch => {
        ch.row.originalData = { ...ch.row.data };
        ch.row.dirtyFields.clear();
        eventBus.emit('TABLE', 'FIELD_UPDATED', {
          row: ch.row,
          fieldName: ch.field,
          initiator: 'save'
        });

        eventBus.emit('CHANGE', 'CLEAR_CHANGE', { changeId: ch.id });
      });

      eventBus.emit('CHANGE', 'CLEAR_CHANGES');

      eventBus.emit('MESSAGE', 'SUCCESS', 'Alle Änderungen erfolgreich gespeichert!');

      const saveBtn = this.element.querySelector('.btn-save');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save All';
      }
    });

    eventBus.on('DATABASE', 'SAVE_FAILED', ({ error }) => {
      document.body.style.cursor = '';

      eventBus.emit('MESSAGE', 'ERROR', error);

      const saveBtn = this.element.querySelector('.btn-save');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save All';
      }
    });
  }

  render() {
    if (this.element) return this.element;

    this.element = document.createElement('aside');

    this.element.className = `ui-panel change-panel`;
    this.element.innerHTML = `            
            <div class="ui-panel-header">
                <div class="ui-panel-title">Changes</div>
                <div class="change-panel-actions">
                    <button class="ui-btn-action btn-save" title="Save all Changes">Save All</button>
                    <button class="ui-btn-action btn-clear" title="Clear all changes">Clear</button>
                </div>
            </div>
            <div class="ui-panel-body">
                <table class="ui-table change-table">
                    <thead>
                        <tr>
                            <th>Feld</th>
                            <th>Orig.</th>
                            <th>Neu</th>
                            <th class="col-revert"></th>
                        </tr>
                    </thead>
                    <tbody class="change-tbody"></tbody>
                </table>
            </div>
            <div class="ui-panel-footer">
                <small class="change-count">0 changes</small>
            </div>
        `;

    this.container.appendChild(this.element);
    this._attachEventListeners();

    this._renderList();

    return this.element;
  }

  _attachEventListeners() {
    this.element.addEventListener('mousedown', (e) => {
      const isRevertOrClear = e.target.closest('.btn-revert') || e.target.closest('.btn-clear');
      if (isRevertOrClear) {
        e.preventDefault();
      }
    });

    this.element.addEventListener('click', async (e) => {
      const saveBtn = e.target.closest('.btn-save');
      if (saveBtn) {
        await this.handleSaveAll();
        return;
      }
      const clearBtn = e.target.closest('.btn-clear');
      if (clearBtn) {
        eventBus.emit('CHANGE', 'REVERT_CHANGES');
        return;
      }
    });
  }

  _onChanges(changes) {
    const changeMap = new Map();
    if (Array.isArray(changes)) {
      changes.forEach(change => {
        if (!change.table && !change.rowId && !change.field) return;

        const key = `${change.table ?? 'null'}_${change.rowId ?? 'null'}_${change.field ?? 'null'}`;
        changeMap.set(key, change);
      });
    }

    this._changes = Array.from(changeMap.values());

    const activeChangeEditor = this.element.querySelector('.change-cell-val.is-editing');
    if (activeChangeEditor) {
      return;
    }

    this._renderList();
  }

  _renderList() {
    const tbodyEl = this.element.querySelector('.change-tbody');
    const countEl = this.element.querySelector('.change-count');

    tbodyEl.innerHTML = '';

    if (!this._changes || this._changes.length === 0) {

      tbodyEl.innerHTML = `
        <tr>
          <td colspan="4" class="change-empty">No changes detected.</td>
        </tr>
      `;
      countEl.textContent = '0 changes';
      return;
    }

    this._changes.slice().reverse().forEach(ch => {

      const tr = document.createElement('tr');
      tr.className = 'change-row';
      const table = ch.table || '-';
      const rowId = ch.rowId ?? '-';
      const field = ch.field || '-';
      const key = `${ch.table ?? 'null'}_${ch.rowId ?? 'null'}_${ch.field ?? 'null'}`;

      if (field === '__ROW_ACTION__') {
        const isAdd = ch.newValue === 'ADD';
        const text = isAdd ? 'Neue Zeile' : 'Zeile gelöscht';
        const color = isAdd ? 'var(--color-success)' : 'var(--color-error)';

        tr.innerHTML = `
              <td class="ui-table-cell change-cell-field" colspan="3">
                  <div class="${isAdd ? 'change-action-add' : 'change-action-delete'}">${text}</div>
                  <div class="change-field-meta">${this._escapeHtml(table)} · row ${rowId}</div>
              </td>
              <td class="ui-table-cell change-cell-revert">
                  <button class="btn-save-single" data-change-key="${key}" title="Änderung speichern">✓</button>
                  <button class="btn-revert" data-change-key="${key}" title="Änderung rückgängig machen">✕</button>
              </td>
          `;
      } else {

        const oldValue = (ch.oldValue === null || ch.oldValue === undefined) ? '' : String(ch.oldValue);
        tr.innerHTML = `                
              <td class="ui-table-cell change-cell-field">
                  <div class="change-field-name">${this._escapeHtml(field)}</div>
                  <div class="change-field-meta">${this._escapeHtml(table)} · row ${rowId}</div>
              </td>
              <td class="ui-table-cell change-cell-val val-old" title="${this._escapeHtml(oldValue)}">
                  ${this._escapeHtml(oldValue) || '<span class="val-empty">empty</span>'}
              </td>
              <td class="ui-table-cell change-cell-revert">
                  <button class="btn-save-single" data-change-key="${key}" title="Änderung speichern">✓</button>
                  <button class="btn-revert" data-change-key="${key}" title="Änderung rückgängig machen">✕</button>
              </td>
          `;
        let valNewTd;
        if (ch.row && ch.fieldMeta) {

          valNewTd = new FieldBuilder(ch.fieldMeta, ch.row).build();
          valNewTd.className = 'ui-table-cell table-field change-cell-val val-new';
        } else {

          const newValue = (ch.newValue === null || ch.newValue === undefined) ? '' : String(ch.newValue);
          valNewTd = document.createElement('td');
          valNewTd.className = 'ui-table-cell change-cell-val val-new';
          valNewTd.title = newValue;
          valNewTd.innerHTML = this._escapeHtml(newValue) || '<span class="val-empty">empty</span>';
        }
        const revertId = tr.querySelector('.change-cell-revert');
        tr.insertBefore(valNewTd, revertId);
      }

      const revertBtn = tr.querySelector('.btn-revert');

      revertBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._removeChange(key);
      });

      const saveSingleBtn = tr.querySelector('.btn-save-single');

      saveSingleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._saveSingleChange(key, saveSingleBtn);
      });

      tbodyEl.appendChild(tr);
    });

    countEl.textContent = `${this._changes.length} change${this._changes.length !== 1 ? 's' : ''}`;
  }

  _removeChange(changeKey) {
    const changeToRemove = this._changes.find(ch => {
      const key = `${ch.table ?? 'null'}_${ch.rowId ?? 'null'}_${ch.field ?? 'null'}`;
      return key === changeKey;
    });

    if (changeToRemove) {
      eventBus.emit('CHANGE', 'REVERT_CHANGE', {
        changeId: changeToRemove.id,
        table: changeToRemove.table,
        rowId: changeToRemove.rowId,
        field: changeToRemove.field
      });

      this._changes = this._changes.filter(ch => ch.id !== changeToRemove.id);
      this._renderList();
    }
  }
  _escapeHtml(string) {
    return String(string)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  handleSaveAll() {
    if (this._changes.length === 0) return;
    const saveBtn = this.element.querySelector('.btn-save');

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving';

    document.body.style.cursor = 'wait';

    eventBus.emit('DATABASE', 'SAVE_CHANGES', { changes: this._changes });
  }

  _saveSingleChange(changeKey, button) {

    const changeToSave = this._changes.find(ch => {
      const key = `${ch.table ?? 'null'}_${ch.rowId ?? 'null'}_${ch.field ?? 'null'}`;
      return key === changeKey;
    });
    if (changeToSave) {
      button.disabled = true;
      button.innerHTML = '⋯';
      button.style.cursor = 'wait';

      document.body.style.cursor = 'wait';

      eventBus.emit('DATABASE', 'SAVE_CHANGES', { changes: [changeToSave] });
    }
  }
}