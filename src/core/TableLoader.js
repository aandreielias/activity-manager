import { Table } from './Table.js';
import tablesConfig from '../data/tables.json';

export class TableLoader {
    static async loadAllTables(peopleData = null) {
        const tables = {};
        
        for (const tableConfig of tablesConfig) {
            try {
                // Dynamically import the data file
                const rowsData = await import(/* @vite-ignore */ `../data/rows/${tableConfig.file}`);
                let data = rowsData.default || rowsData;
                
                // If data is a string, try to parse it as JSON
                if (typeof data === 'string') {
                    try {
                        data = JSON.parse(data);
                    } catch (e) {
                        console.error(`Failed to parse JSON for ${tableConfig.file}:`, e);
                        data = [];
                    }
                }
                
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
                if (tableConfig.id === 'tbl_activities' && peopleData && Array.isArray(peopleData)) {
                    const responsibleCol = schema.find(col => col.id === 'responsible');
                    if (responsibleCol) {
                        // Generate options from people names: "FirstName LastInitial"
                        responsibleCol.options = peopleData.map(person => 
                            `${person.vorname} ${person.nachname.charAt(0)}.`
                        );
                    }
                }
                
                // Create table instance
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
                console.error(`Failed to load table ${tableConfig.id}:`, error);
            }
        }
        
        return tables;
    }

    static getTableConfigs() {
        return tablesConfig;
    }
}
