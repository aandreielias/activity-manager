import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { setupSaveAPI } from './server/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let app = null;

export default {
    base: '/activity_manager/',
    build: {
        outDir: 'dist'
    },
    server: {
        middlewareMode: false,
    },
    plugins: [
        {
            name: 'api-server',
            configureServer(server) {
                // Create Express app for API routes
                app = express();
                app.use(express.json({ limit: '50mb' }));
                
                // Setup API routes
                setupSaveAPI(app);
                
                console.log('[Vite] API server configured');
                
                // Mount API routes - use a custom middleware
                server.middlewares.use((req, res, next) => {
                    if (req.url.startsWith('/api/')) {
                        // Remove the /api prefix and pass to express app
                        const originalUrl = req.url;
                        req.url = req.url.slice(4); // Remove '/api'
                        app(req, res, (err) => {
                            req.url = originalUrl;
                            next(err);
                        });
                    } else {
                        next();
                    }
                });
            }
        }
    ]
}