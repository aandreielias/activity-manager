/**
 * DataService handles all API calls for saving and loading data
 */
export class DataService {
    
    static async saveTable(tableId, filename, rows) {
        try {
            console.log(`[DataService] Saving table ${tableId} to ${filename}`);
            
            const payload = {
                tableId,
                filename,
                rows: rows.map(row => row.toJSON ? row.toJSON() : row)
            };
            
            console.log(`[DataService] Payload: ${JSON.stringify(payload).substring(0, 200)}...`);
            
            const response = await fetch('/api/save-table', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            console.log(`[DataService] Response status: ${response.status}`);
            console.log(`[DataService] Response headers:`, response.headers);

            const contentType = response.headers.get('content-type');
            
            let responseText = '';
            try {
                responseText = await response.text();
                console.log(`[DataService] Raw response: ${responseText.substring(0, 200)}`);
            } catch (e) {
                console.error('[DataService] Failed to read response', e);
            }

            if (!response.ok) {
                console.error(`[DataService] Error response: ${responseText}`);
                throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 100)}`);
            }

            if (!contentType || !contentType.includes('application/json')) {
                console.error(`[DataService] Non-JSON response: ${responseText.substring(0, 100)}`);
                throw new Error(`Server returned non-JSON response: ${responseText.substring(0, 100)}`);
            }

            const result = JSON.parse(responseText);
            console.log(`[Save] ${result.message}`);
            return result;

        } catch (error) {
            console.error(`[Save Error] Failed to save ${tableId}:`, error);
            throw error;
        }
    }
}
