/**
 * DataService handles all API calls for saving and loading data
 */
export class DataService {
    static async saveTable(tableId, filename, rows) {
        try {
            const payload = {
                tableId,
                filename,
                rows: rows.map(row => row.toJSON ? row.toJSON() : row)
            };

            const response = await fetch('/api/save-table', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const contentType = response.headers.get('content-type');

            let responseText = '';
            try {
                responseText = await response.text();
            } catch (e) {
                console.error('[DataService] Fehler beim Lesen der Antwort', e);
                throw new Error('Netzwerkfehler: Server-Antwort konnte nicht gelesen werden');
            }

            if (!response.ok) {
                let errorMsg = responseText.substring(0, 150) || response.statusText;
                console.error(`[DataService] HTTP Fehler ${response.status}: ${errorMsg}`);
                throw new Error(`Serverfehler (${response.status}): ${errorMsg}`);
            }

            if (!contentType || !contentType.includes('application/json')) {
                console.error(`[DataService] Unerwarteter Content-Type: ${contentType}`);
                throw new Error('Server hat ein ungültiges Format zurückgegeben (JSON erwartet)');
            }

            try {
                return JSON.parse(responseText);
            } catch (parseError) {
                console.error(`[DataService] JSON Parsing-Fehler:`, parseError);
                throw new Error('Fehler beim Parsen der Server-Antwort als JSON');
            }

        } catch (error) {
            console.error(`[DataService] Fehler beim Speichern der Tabelle ${tableId}:`, error);
            throw error;
        }
    }
}
