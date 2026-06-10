import { eventBus } from "../../../events/EventBus.js";

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

export class Row {
  constructor(data, table) {

    this.data = data;
    this.originalData = { ...data };
    this.table = table;
    this.id = this._resolvePk(data, table.name);
    this.dirtyFields = new Set();

    eventBus.on('DATA', 'DATA_UPDATED', (payload) => {

      if (payload.table === this.table.name && payload.rowId === this.id && payload.field) {

        const fieldName = payload.field;
        const rawValue = payload.value;
        const initiator = payload.initiator;

        if (!areValuesEqual(this.originalData[fieldName], rawValue)) {

          this.data[fieldName] = coerceValue(this.originalData[fieldName], rawValue);
          this.dirtyFields.add(fieldName);

          const junctionKey = fieldName + '_junction';
          if (this.data[junctionKey] !== undefined) {

            const fieldMeta = this.table.fields?.find(f => f.name === fieldName);
            if (fieldMeta && fieldMeta.reference) {

              const prefixA = this.table.name.substring(0, 3);
              const prefixB = fieldMeta.reference.substring(0, 3);

              let foundJunction = null;
              for (const candidateTable of this.table.dataLoader?.tables.values() || []) {

                if (candidateTable.name.startsWith('pt_') && candidateTable.rows && candidateTable.rows.length > 0) {

                  const keys = Object.keys(candidateTable.rows[0].data);
                  const colToA = keys.find(k => k.endsWith(`${prefixA}id`));
                  const colToB = keys.find(k => k.endsWith(`${prefixB}id`));

                  if (colToA && colToB) {
                    const match = candidateTable.rows.find(jr => jr.data[colToA] === this.id && jr.data[colToB] === rawValue);
                    if (match) {
                      foundJunction = { ...match.data };
                      break;
                    }
                  }
                }
              }

              this.data[junctionKey] = foundJunction;
            }
          }
        } else {

          this.data[fieldName] = this.originalData[fieldName];
          this.dirtyFields.delete(fieldName);
        }

        eventBus.emit('TABLE', 'FIELD_UPDATED', {
          row: this,
          fieldName: fieldName,
          initiator: initiator
        });
      }
    });
  }

  getCellValue(fieldName) {
    return this.data[fieldName];
  }

  updateValue(fieldName, value) {

    eventBus.emit('DATA', 'DATA_UPDATED', {
      table: this.table.name,
      rowId: this.id,
      field: fieldName,
      value: value,
      row: this,
      initiator: 'input'
    });
  }

  getLabel() {
    const labelFields = this.table.fields.filter(f => f.isLabel);

    if (labelFields.length > 0) {
      return labelFields.map(f => {
        let val = this.data[f.name];

        if (f.referenceData) {
          const matchedRef = f.referenceData.find(ref => ref.id == val);
          if (matchedRef) return matchedRef.label;
        }

        if (f.reference && this.table.dataLoader) {
          const targetTable = this.table.dataLoader.getTable(f.reference);
          if (targetTable) {
            const targetRow = targetTable.rows.find(tr => {
              const idKey = Object.keys(tr.data).find(k => k.endsWith('_id')) || Object.keys(tr.data)[0];
              return tr.data[idKey] == val;
            });

            if (targetRow) return targetRow.getLabel();
          }
        }
        return val;
      }).filter(Boolean).join(': ');
    }

    const keys = Object.keys(this.data);
    const idKey = keys.find(k => k.endsWith('_id')) || keys[0];
    const nameKey = keys.find(k => k.includes('name') || k.includes('titel') || k.includes('bezeichnung'));

    if (nameKey && this.data[nameKey]) return this.data[nameKey];

    const vNameKey = keys.find(k => k.includes('vorname'));
    const nNameKey = keys.find(k => k.includes('nachname'));
    if (vNameKey && nNameKey && this.data[vNameKey] && this.data[nNameKey]) {
      return this.data[vNameKey] + ' ' + this.data[nNameKey];
    }

    return this.data[keys[1]] || this.data[idKey];
  }


  _resolvePk(data, tableName) {

    const conventionKey = `${tableName}_id`;
    if (data[conventionKey] !== undefined) return data[conventionKey];

    if (data.id !== undefined) return data.id;
    if (data.f_id !== undefined) return data.f_id;

    const idKeys = Object.keys(data).filter(k => k.endsWith('_id'));

    if (idKeys.length > 1) {
      idKeys.sort();
      return idKeys.map(k => data[k]).join('|');
    }

    return idKeys.length > 0 ? data[idKeys[0]] : null;
  }

  revert() {
    const changedFields = new Set();

    Object.keys(this.originalData).forEach(fieldName => {
      if (this.data[fieldName] !== this.originalData[fieldName]) {
        changedFields.add(fieldName);
      }
    });


    this.data = { ...this.originalData };
    this.dirtyFields.clear();

    changedFields.forEach(fieldName => {
      eventBus.emit('UI', 'CELL_REVERTED', {
        row: this,
        fieldName: fieldName
      });
    });
  }
}