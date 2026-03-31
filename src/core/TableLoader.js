import { Table } from './Table.js';
import { SUPABASE_CONFIG } from '../config.js';

export class TableLoader {
    static async loadAllTables(peopleData = null) {
        const base = import.meta.env.BASE_URL;

        // Fetch tables config
        const tablesRes = await fetch(`${base}data/tables.json`);
        const tablesConfig = await tablesRes.json();

        const tables = {};

        for (const tableConfig of tablesConfig) {
            try {
                let data = null;

                // 1. Try Supabase first
                try {
                    const sbRes = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data?id=eq.${tableConfig.id}&select=rows`, {
                        headers: {
                            'apikey': SUPABASE_CONFIG.ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
                        }
                    });
                    
                    if (sbRes.ok) {
                        const sbData = await sbRes.json();
                        if (sbData && sbData.length > 0) {
                            data = sbData[0].rows;
                        }
                    }
                } catch (e) {
                    console.warn(`[TableLoader] Supabase load failed for ${tableConfig.id}, falling back to local:`, e);
                }

                // 2. Fallback to local JSON if Supabase has no data
                if (!data) {
                    const rowsRes = await fetch(`${base}data/rows/${tableConfig.file}`);
                    data = await rowsRes.json();
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