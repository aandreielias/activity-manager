import { SUPABASE_CONFIG } from '../config.js';

/**
 * DataService handles all API calls for saving and loading data
 */
export class DataService {
    static async saveTable(tableId, filename, rows) {
        try {
            const payload = {
                id: tableId,
                rows: rows.map(row => row.toJSON ? row.toJSON() : row)
            };

            // Using Supabase REST API (PostgREST)
            // 'Prefer: resolution=merge-duplicates' handles UPSERT based on the primary key 'id'
            const response = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_CONFIG.ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[DataService] Supabase Fehler ${response.status}: ${errorText}`);
                throw new Error(`Fehler beim Speichern in Supabase (${response.status})`);
            }

            return { success: true, message: `Table ${tableId} saved to Supabase` };

        } catch (error) {
            console.error(`[DataService] Fehler beim Speichern der Tabelle ${tableId}:`, error);
            throw error;
        }
    }
}
