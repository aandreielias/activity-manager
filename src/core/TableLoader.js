import { Table } from './Table.js';

export class TableLoader {
    static async loadAllTables(peopleData = null) {
        const base = import.meta.env.BASE_URL;

        // Fetch tables config
        const tablesRes = await fetch(`${base}data/tables.json`);
        const tablesConfig = await tablesRes.json();

        const tables = {};

        for (const tableConfig of tablesConfig) {
            try {
                // Fetch the row data file
                const rowsRes = await fetch(`${base}data/rows/${tableConfig.file}`);
                let data = await rowsRes.json();

                // Ensure data is an array
                if (!Array.isArray(data)) {
                    data = [data];
                }

                // Create schema from config
                const schema = tableConfig.schema.map(col => ({
                    ...col,
                    type: col.type,
                    options: col.options || []
                }));

                // Generate enum options for "responsible" field from people data
                if (tableConfig.category === 'spiele' && peopleData && Array.isArray(peopleData)) {
                    const responsibleCol = schema.find(col => col.id === 'responsible');
                    if (responsibleCol) {
                        responsibleCol.options = peopleData.map(person => ({
                            label: `${person.vorname} ${person.nachname.charAt(0)}.`,
                            value: person.id
                        }));
                    }
                }

                const table = new Table({
                    id: tableConfig.id,
                    title: tableConfig.title,
                    schema: schema,
                    rows: Array.isArray(data) ? data : [],
                    peopleData: peopleData || [],
                    tableConfig: tableConfig
                });

                tables[tableConfig.id] = {
                    config: tableConfig,
                    instance: table,
                    element: null
                };

            } catch (error) {
                console.error(`Fehler beim Laden der Tabelle ${tableConfig.id}:`, error);
            }
        }

        return tables;
    }
}