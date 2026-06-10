import { eventBus } from "../events/EventBus";

function areValuesEqual(val1, val2) {
  const normalize = (v) => {
    if (v === null || v === undefined || v === '') return '';
    return String(v).trim();
  };
  return normalize(val1) === normalize(val2);
}

function coerceValue(originalValue, newValue) {
  if (newValue === '' || newValue === null || newValue === undefined) {
    return (originalValue === null || originalValue === undefined) ? newValue : null;
  }
  if (typeof originalValue === 'number') {
    const num = Number(newValue);
    return isNaN(num) ? newValue : num;
  }
  if (typeof originalValue === 'boolean') {
    return newValue === true || newValue === 'true' || newValue === 1 || newValue === '1';
  }
  return newValue;
}

export class ChangeService {

  constructor() {
    this._changes = [];
    this._initListener();
  }

  _initListener() {
    eventBus.on('DATA', 'DATA_UPDATED', (payload) => {
      this._handleChange(payload);
    });


    eventBus.on('CHANGE', 'CLEAR_CHANGE', (data) => {
      if (data.changeId) this.clearChange(data.changeId);
    })

    eventBus.on('CHANGE', 'CLEAR_CHANGES', () => {
      this.clearChanges();
    })

    eventBus.on('CHANGE', 'REVERT_CHANGE', (data) => {
      if (data.changeId) {
        const change = this._changes.find(ch => ch.id === data.changeId);
        if (change) {
          if (change.field === '__ROW_ACTION__') {
            eventBus.emit('UI', 'REVERT_ROW_ACTION', { table: change.table, rowId: change.rowId, action: change.newValue });
          } else {
            eventBus.emit('DATA', 'DATA_UPDATED', {
              table: change.table, rowId: change.rowId, field: change.field, value: change.oldValue, initiator: 'revert'
            });
          }
        }
      }
      eventBus.emit('CHANGE', 'CLEAR_CHANGE', data);
    });
    eventBus.on('CHANGE', 'REVERT_CHANGES', () => {
      this._changes.slice().reverse().forEach(change => {
        if (change.field === '__ROW_ACTION__') {
          eventBus.emit('UI', 'REVERT_ROW_ACTION', { table: change.table, rowId: change.rowId, action: change.newValue });
        } else {
          eventBus.emit('DATA', 'DATA_UPDATED', {
            table: change.table, rowId: change.rowId, field: change.field, value: change.oldValue, initiator: 'revert'
          });
        }
      });
      eventBus.emit('CHANGE', 'CLEAR_CHANGES');
    });
  }

  _handleChange(payload) {

    const table = payload.table;
    const rowId = payload.rowId;
    const field = payload.field;
    const value = payload.value;
    const row = payload.row;

    if (!row) return;

    if (field === '__ROW_ACTION__') {

      const existingAction = this._changes.find(ch => ch.table === table && ch.rowId === rowId && ch.field === '__ROW_ACTION__');
      if (existingAction && existingAction.newValue === 'ADD' && value === 'DELETE') {
        this._changes = this._changes.filter(ch => !(ch.table === table && ch.rowId === rowId));
        this._emitUpdate();
        return;
      }

      this._changes = this._changes.filter(ch => !(ch.table === table && ch.rowId === rowId));
      const change = {
        id: `${Date.now()}_${Math.random()}`,
        event: 'DATA_UPDATED',
        table: table,
        rowId: rowId,
        field: '__ROW_ACTION__',
        row: row,
        newValue: value,
        timestamp: new Date().toISOString(),
      };
      this._changes.push(change);
      this._emitUpdate();
      return;
    }
    const isRowAdded = this._changes.find(ch => ch.table === table && ch.rowId === rowId && ch.field === '__ROW_ACTION__' && ch.newValue === 'ADD');
    if (isRowAdded) {
      return;
    }

    const oldValue = row.originalData?.[field] ?? null;

    if (areValuesEqual(oldValue, value)) {
      this._changes = this._changes.filter(
        ch => !(ch.table === table && ch.rowId === rowId && ch.field === field)
      );
      this._emitUpdate();
      return;
    }

    const changeIndex = this._changes.findIndex(
      ch => ch.table === table && ch.rowId === rowId && ch.field === field
    );

    const change = {
      id: changeIndex !== -1 ? this._changes[changeIndex].id : `${Date.now()}_${Math.random()}`,

      event: 'DATA_UPDATED',

      table: table,
      rowId: rowId,
      field: field,

      fieldMeta: row.table?.getField?.(field) ?? null,
      row: row,

      type: row.table?.getField?.(field)?.type ?? null,

      oldValue: oldValue,
      newValue: coerceValue(oldValue, value),

      timestamp: new Date().toISOString(),
    };

    if (changeIndex !== -1) {
      this._changes[changeIndex] = change;
    } else {
      this._changes.push(change);
    }
    this._emitUpdate();
  }

  _emitUpdate() {
    eventBus.emit('UI', 'CHANGES_MADE', this.getChanges());
  }

  getChanges() {
    return [...this._changes];
  }

  clearChanges() {
    this._changes = [];
    this._emitUpdate();
  }

  clearChange(changeId) {
    this._changes = this._changes.filter(ch => ch.id !== changeId);
    this._emitUpdate();
    return this._changes;
  }
}