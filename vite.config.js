import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    // Replace 'activity-manager' with your actual repository name if it's different!
    base: '/activity-manager/',
    publicDir: 'public',
    build: {
        outDir: 'dist'
    },
    css: {
        modules: {
            generateScopedName: '[local]'
        }
    }
}