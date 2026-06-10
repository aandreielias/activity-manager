import { Connector } from './Connector.js';
import { Table } from './Table/Table.js';
import { Field } from './Table/Field.js';
import { METATABLES, PREFIX } from '../Constants.js'
import { eventBus } from '../../events/EventBus.js';
import { Authenticator } from './Authenticator.js';

export class DataLoader {

  constructor() {
    this.tables = new Map();
    this.enums = new Map();
  }

  async loadTables() {
    try {

      const inittables = await Connector.get(METATABLES.TABLES);

      if (!inittables.ok) {
        eventBus.emit('MESSAGE', 'ERROR', `[DataLoader#loadTables]: Failed to load tables: ${inittables.status} ${inittables.statusText}`)
        return;
      }

      const tablesData = await inittables.json();

      const initfields = await Connector.get(METATABLES.FIELDS);

      if (!initfields.ok) {
        eventBus.emit('MESSAGE', 'ERROR', `[DataLoader#loadTables]: Failed to load fields: ${initfields.status} ${initfields.statusText}`);
        return;
      }

      const fieldsData = await initfields.json();

      for (const tData of tablesData) {

        if (Authenticator.canReadTable(tData.t_id, tData.t_tt_id)) {
          const table = new Table(tData);
          this.tables.set(table.id, table);
        }
      }

      for (const fData of fieldsData) {
        const table = this.tables.get(fData.f_t_id);

        if (table && Authenticator.canReadField(fData.f_t_id, fData.f_id, table.groupId)) {
          table.addField(new Field(fData));

        }
      }

      await Promise.all(
        Array.from(this.tables.values()).map(async (table) => {
          const dataResponse = await Connector.get(table.name);

          if (dataResponse.ok) {
            const rowDataList = await dataResponse.json();
            for (const rowData of rowDataList) {
              table.addRow(rowData);
            }
          }
        })
      );

    } catch (error) {
      eventBus.emit('MESSAGE', 'ERROR', '[DataLoader#loadTables]: Error loading data:' + error);
      throw error;
    }
  }

  getTable(tableName) {
    return Array.from(this.tables.values()).find(t => t.name === tableName);
  }

  async loadEnums() {
    try {
      const response = await Connector.get('db_enums');

      if (!response.ok) {
        eventBus.emit('MESSAGE', 'ERROR', `[DataLoader#loadEnums]: Failed to load enums: ${response.status} ${response.statusText}`);
        return;
      }

      const enumsData = await response.json();

      for (const row of enumsData) {
        if (!this.enums.has(row.enum_type)) {
          this.enums.set(row.enum_type, []);
        }
        this.enums.get(row.enum_type).push(row.enum_value);
      }

      return this.enums;

    } catch (error) {

      eventBus.emit('MESSAGE', 'ERROR', '[DataLoader#loadEnums]: Error loading enums:' + error);
      throw error;
    }
  }

  getEnum(enumName) {
    return this.enums?.get(enumName) || [];
  }
}
