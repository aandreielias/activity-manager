import { Table } from './Table.js';
import { DataService } from '../services/DataService.js';

/**
 * TableLoader — Loads table configurations and row data from
 * the relational Supabase schema. Provides better error handling
 * and recovery options.
 */
export class TableLoader {
    static async loadAllTables(peopleData = null, tablesConfig = []) {
        if (!tablesConfig || tablesConfig.length === 0) {
            console.error('[TableLoader] No table configurations provided.');
            return {};
        }

        const tables = {};
        const allGames = [];
        const loadErrors = [];

        for (const config of tablesConfig) {
            try {
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
                // Log error with context instead of silently failing
                const errorMsg = `Failed to load table ${config.id}: ${error.message}`;
                console.error(`[TableLoader] ${errorMsg}`, error);
                loadErrors.push({
                    tableId: config.id,
                    error: error.message,
                    context: error.context || {}
                });

                // Create empty table as fallback, but mark it as having errors
                const table = this._createTableInstance(config, [], peopleData);
                table._loadError = error;
                tables[config.id] = { 
                    config, 
                    instance: table, 
                    element: null,
                    error: errorMsg
                };
            }
        }

        // Log summary if there were errors
        if (loadErrors.length > 0) {
            console.warn(`[TableLoader] ${loadErrors.length} table(s) failed to load:`, loadErrors);
        }

        // Post-processing to link games to events
        if (tables['tbl_events'] && tables['tbl_events'].instance) {
            const gamesCol = tables['tbl_events'].instance.schema.find(c => ['reihenfolge', 'games', 'spiele'].includes(c.id) || c.header === 'Spiele');
            if (gamesCol) {
                gamesCol.header = 'Reihenfolge';
                gamesCol.label = 'Reihenfolge';
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

        if ((config.category === 'spiele' || config.id === 'tbl_events') && peopleData?.length > 0) {
            const respCol = schema.find(c => c.id === 'responsible');
            if (respCol) {
                // Filter for available responsible people
                const isEventTable = config.id === 'tbl_events';
                respCol.options = peopleData
                    .filter(p => {
                        const status = (p.Status || '').toLowerCase();
                        if (status === 'inaktiv') return false;

                        // Only "Events" main column requires Supervisor+
                        if (isEventTable) {
                            const role = (p.role || '').toLowerCase();
                            return ['supervisor', 'admin', 'superadmin'].includes(role);
                        }
                        return true;
                    })
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