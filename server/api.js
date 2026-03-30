import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROWS_DIR = path.join(__dirname, '../public/data/rows');

export function setupSaveAPI(app) {
    app.post('/save-table', (req, res) => {
        try {
            const { tableId, filename, rows } = req.body;

            if (!tableId || !filename || !rows) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Security check: ensure filename only contains valid characters
            if (!/^[a-zA-Z0-9_-]+\.json$/.test(filename)) {
                return res.status(400).json({ error: 'Invalid filename' });
            }

            const filePath = path.join(ROWS_DIR, filename);

            // Ensure the file is within the rows directory
            if (!filePath.startsWith(ROWS_DIR)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Write to file
            fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf8');

            res.json({
                success: true,
                message: `Table ${tableId} saved successfully`,
                rowCount: rows.length
            });

        } catch (error) {
            console.error('[API] Error saving table:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
