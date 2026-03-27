import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    base: '/activity_manager/',
    publicDir: 'public',
    build: {
        outDir: 'dist'
    },
    plugins: [
        {
            name: 'api-server',
            apply: 'serve',
            async configureServer(server) {
                const { default: express } = await import('express');
                const { setupSaveAPI } = await import('./server/api.js');

                const app = express();
                app.use(express.json({ limit: '50mb' }));
                setupSaveAPI(app);

                console.log('[Vite] API server configured');

                server.middlewares.use((req, res, next) => {
                    if (req.url.startsWith('/api/')) {
                        const originalUrl = req.url;
                        req.url = req.url.slice(4);
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