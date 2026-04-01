import { Table } from './Table.js';
import { SUPABASE_CONFIG } from '../config.js';

/**
 * TableLoader - Service for loading table configurations and data.
 */
export class TableLoader {
    static async loadAllTables(peopleData = null) {
        const base = import.meta.env.BASE_URL;

        // Fetch tables configuration
        const tablesRes = await fetch(`${base}data/tables.json`);
        const tablesConfig = await tablesRes.json();

        const tables = {};

        for (const config of tablesConfig) {
            try {
                const data = await this._loadTableData(config, base);
                const table = this._createTableInstance(config, data, peopleData);

                tables[config.id] = {
                    config,
                    instance: table,
                    element: null
                };
            } catch (error) {
                console.error(`[TableLoader] Failed to load table ${config.id}:`, error);
            }
        }

        return tables;
    }

    /**
     * Data loading with Supabase-first strategy and local fallback.
     */
    static async _loadTableData(config, base) {
        let data = null;

        // 1. Try Supabase
        try {
            const res = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data?id=eq.${config.id}&select=rows`, {
                headers: {
                    'apikey': SUPABASE_CONFIG.ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
                }
            });

            if (res.ok) {
                const json = await res.json();
                if (json?.[0]?.rows) {
                    data = json[0].rows;
                    console.log(`[TableLoader] Loaded ${config.id} from Supabase`);
                }
            }
        } catch (e) {
            console.warn(`[TableLoader] Supabase failed for ${config.id}:`, e);
        }

        // 2. Local fallback
        if (!data) {
            const res = await fetch(`${base}data/rows/${config.file}`);
            data = await res.json();
            console.log(`[TableLoader] Loaded ${config.id} from Local Fallback`);
        }

        return Array.isArray(data) ? data : [data];
    }

    /**
     * Create and configure a Table instance.
     */
    static _createTableInstance(config, rows, peopleData) {
        // Build schema
        const schema = config.schema.map(col => ({
            ...col,
            type: col.type,
            options: col.options || []
        }));

        // Dynamic responsible options replacement
        if (config.category === 'spiele' && peopleData?.length > 0) {
            const respCol = schema.find(c => c.id === 'responsible');
            if (respCol) {
                respCol.options = peopleData.map(p => ({
                    label: `${p.vorname} ${p.nachname.charAt(0)}.`,
                    value: p.id
                }));
            }
        }

        return new Table({
            id: config.id,
            title: config.title,
            schema,
            rows: rows || [],
            peopleData: peopleData || [],
            tableConfig: config
        });
    }
}