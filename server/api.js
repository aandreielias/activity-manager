import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROWS_DIR = path.join(__dirname, '../public/data/rows');
const AUTH_FILE = path.join(__dirname, '../public/data/auth.json');
const FAVORITES_FILE = path.join(__dirname, '../public/data/favorites.json');

export function setupSaveAPI(app) {
    // Helper to handle both /api/path and /path
    const registerPost = (route, handler) => {
        app.post(route, handler);
        if (!route.startsWith('/api/')) {
            app.post('/api' + (route.startsWith('/') ? '' : '/') + route, handler);
        }
    };

    const registerGet = (route, handler) => {
        app.get(route, handler);
        if (!route.startsWith('/api/')) {
            app.get('/api' + (route.startsWith('/') ? '' : '/') + route, handler);
        }
    };

    registerGet('/favorites', (req, res) => {
        try {
            if (!fs.existsSync(FAVORITES_FILE)) {
                return res.json({});
            }
            const data = JSON.parse(fs.readFileSync(FAVORITES_FILE, 'utf8'));
            res.json(data);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    registerPost('/favorites', (req, res) => {
        try {
            const { username, favoriteIds } = req.body;
            if (!username) return res.status(400).json({ error: 'Missing username' });

            let data = {};
            if (fs.existsSync(FAVORITES_FILE)) {
                data = JSON.parse(fs.readFileSync(FAVORITES_FILE, 'utf8'));
            }

            data[username] = favoriteIds || [];
            fs.writeFileSync(FAVORITES_FILE, JSON.stringify(data, null, 2), 'utf8');
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    registerPost('/auth/login', (req, res) => {
        console.log(`[API] Login request for user: ${req.body?.username}`);
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: 'Missing username or password' });
            }

            let authData = {};
            if (fs.existsSync(AUTH_FILE)) {
                try {
                    const authFileContent = fs.readFileSync(AUTH_FILE, 'utf8');
                    authData = JSON.parse(authFileContent);
                    if (Array.isArray(authData)) {
                        authData = {}; // Migrate from [] to {}
                    }
                } catch(e) {
                    authData = {};
                }
            }

            if (!authData[username]) {
                // First time login for this user: register the password
                authData[username] = password;
                fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2), 'utf8');
                return res.json({ success: true, message: 'Password set and logged in', role: username === 'root' ? 'admin' : 'user' });
            }

            if (authData[username] !== password) {
                return res.status(401).json({ error: 'Invalid password' });
            }

            res.json({ success: true, message: 'Logged in successfully', role: username === 'root' ? 'admin' : 'user' });

        } catch (error) {
            console.error('[API] Error in login:', error);
            res.status(500).json({ error: error.message });
        }
    });

    registerPost('/auth/change-password', (req, res) => {
        try {
            const { username, newPassword } = req.body;
            if (!username || !newPassword) {
                return res.status(400).json({ error: 'Missing username or password' });
            }

            let authData = {};
            if (fs.existsSync(AUTH_FILE)) {
                try {
                    authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
                } catch(e) {
                    authData = {};
                }
            }

            authData[username] = newPassword;
            fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2), 'utf8');
            
            res.json({ success: true, message: 'Passwort erfolgreich geändert' });
        } catch (error) {
            console.error('[API] Error changing password:', error);
            res.status(500).json({ error: error.message });
        }
    });

    registerPost('/save-table', (req, res) => {
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
