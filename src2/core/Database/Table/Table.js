import { Row } from './Row.js';

export class Table {
  constructor(metadata) {
    this.id = metadata.t_id;
    this.name = metadata.t_name;
    this.titel = metadata.t_titel;
    this.groupId = metadata.t_tt_id;
    this.fields = [];
    this.rows = [];
  }
  addField(field) {
    this.fields.push(field);
  }
  addRow(rowData) {
    const row = new Row(rowData, this);
    this.rows.push(row);
  }
  setRows(rowsData) {
    this.rows = rowsData.map(data => new Row(data, this));
  }
  getField(name) {
    return this.fields.find(f => f.name === name);
  }
}