import { METATABLES } from '../Constants.js';

export class DataBuilder {

    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.configTableNames = Object.values(METATABLES);
    }

    getAllTables() {
        const allTables = Array.from(this.dataLoader.tables.values());
        return allTables.map(table => this.enrichTable(table));
    }

    getTable(tableName) {
        const table = this.dataLoader.getTable(tableName);
        return table ? this.enrichTable(table) : null;
    }

    getAllEnums() {
        return this.dataLoader.enums;
    }

    getEnum(enumName) {
        return this.dataLoader.getEnum(enumName);
    }

    getConfigTables() {
        return this.getAllTables().filter(t => {
            return this.configTableNames.includes(t.name);
        });
    }

    getDataTables() {
        return this.getAllTables().filter(t => {
            return !this.configTableNames.includes(t.name);
        });
    }

    getGroupedTables() {
        const groupsTable = this.getTable('tt_team_tabellen');
        const teamsTable = this.getTable('tm_teams');

        const dataTables = this.getDataTables();
        const tableGroups = {};

        if (groupsTable) {
            groupsTable.rows.forEach(row => {

                tableGroups[row.data.tt_id] = {
                    id: row.data.tt_id,
                    name: row.data.tt_name,
                    teamId: row.data.tt_tm_id,
                    tables: []
                };
            });
        }

        dataTables.forEach(table => {
            if (table.groupId && tableGroups[table.groupId]) {

                tableGroups[table.groupId].tables.push(table);
            } else {

                if (!tableGroups['ungrouped']) {

                    tableGroups['ungrouped'] = { id: "ungrouped", name: "Ohne Gruppe", tables: [] };
                }
                tableGroups['ungrouped'].tables.push(table);
            }
        });

        const teams = {};
        Object.values(tableGroups).forEach(group => {
            if (group.tables.length === 0) return;

            const tId = group.teamId || 'allgemein';
            if (!teams[tId]) {

                let tName = tId === 'allgemein' ? "Allgemein" : `Team ${tId}`;

                if (teamsTable && tId !== 'allgemein') {

                    const teamRow = teamsTable.rows.find(r => r.data.tm_id == tId || r.data.id == tId);
                    if (teamRow) tName = teamRow.data.tm_name || teamRow.data.name || tName;
                }

                teams[tId] = { id: tId, name: tName, groups: [] };
            }
            teams[tId].groups.push(group);
        });

        return Object.values(teams);
    }

    enrichTable(table) {
        if (!table || !table.fields) return table;

        table.dataLoader = this.dataLoader;

        table.fields.forEach(field => {
            const type = field.type ? field.type.toLowerCase() : '';

            if (type.includes('enum') && field.reference) {
                field.enumValues = this.dataLoader.getEnum(field.reference);

            } else {
                const sourceTableName = field.reference || table.name;
                const refTable = this.dataLoader.getTable(sourceTableName);

                if (refTable) {
                    field.referenceData = refTable.rows.map(r => {
                        const keys = Object.keys(r.data);
                        const idKey = keys.find(k => k.endsWith('_id')) || keys[0];

                        let textValue;
                        if (field.name) {
                            textValue = r.data[field.name] !== undefined && r.data[field.name] !== null ? r.data[field.name] : '';
                        } else {
                            textValue = r.getLabel() || r.data[idKey] || 'Unbekannt';
                        }

                        return {
                            id: r.data[idKey],
                            label: r.getLabel() || r.data[idKey] || 'Unbekannt',
                            textValue: textValue
                        };
                    });
                } else {
                    field.referenceData = [];
                }
            }
        });

        return table;
    }

}
