import { Table } from './Table.js';
import { DataService } from '../services/DataService.js';

/**
 * TableLoader — Loads table configurations and row data from
 * the relational Supabase schema. No local JSON fallback.
 */
export class TableLoader {
    static async loadAllTables(peopleData = null) {
        const base = import.meta.env.BASE_URL;

        // Fetch tables configuration (still a static JSON for schema definitions)
        const tablesRes = await fetch(`${base}data/tables.json`);
        const tablesConfig = await tablesRes.json();

        const tables = {};
        const allGames = [];

        for (const config of tablesConfig) {
            try {
                // Load rows from the relational DB via DataService
                const data = await DataService.loadRows(config.id);

                const table = this._createTableInstance(config, data, peopleData);

                if (config.category === 'spiele') {
                    allGames.push(...data);
                }

                tables[config.id] = {
                    config,
                    instance: table,
                    element: null,
                };
            } catch (error) {
                console.error(`[TableLoader] Failed to load table ${config.id}:`, error);
                // Create empty table on error so the UI doesn't break
                const table = this._createTableInstance(config, [], peopleData);
                tables[config.id] = { config, instance: table, element: null };
            }
        }

        // Post-processing to link games to events
        if (tables['tbl_events']) {
            const gamesCol = tables['tbl_events'].instance.schema.find(c => c.id === 'games');
            if (gamesCol) {
                // Remove duplicates and map to simple names
                gamesCol.availableTags = [...new Set(allGames.map(g => g.name))].sort();
            }
        }
 
        return tables;
    }

    /**
     * Create and configure a Table instance.
     */
    static _createTableInstance(config, rows, peopleData) {
        const schema = config.schema.map(col => ({
            ...col,
            type: col.type,
            options: col.options || [],
        }));

        if (config.category === 'spiele' && peopleData?.length > 0) {
            const respCol = schema.find(c => c.id === 'responsible');
            if (respCol) {
                // Filter out inactive members so they cannot be assigned new responsibility
                respCol.options = peopleData
                    .filter(p => (p.Status || '').toLowerCase() !== 'inaktiv')
                    .map(p => ({
                        label: `${p.vorname} ${(p.nachname || '').charAt(0)}.`,
                        value: p.id,
                    }));
            }
        }

        return new Table({
            id: config.id,
            title: config.title,
            schema,
            rows: rows || [],
            peopleData: peopleData || [],
            tableConfig: config,
        });
    }
}