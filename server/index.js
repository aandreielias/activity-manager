import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupSaveAPI } from './api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Setup API routes
setupSaveAPI(app);

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('[Server] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`[Server] Activity Manager running on http://localhost:${PORT}`);
    console.log('[Server] API endpoint: /api/save-table');
});

