import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://kmsdsymoehleonxzcbnm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imttc2RzeW1vZWhsZW9ueHpjYm5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTg3NjAsImV4cCI6MjA5MDUzNDc2MH0.Z0eznsy0BBFpwHKtlXBVNk5M8Yc_saXEpYB-DH7yt0g';
// ---------------------

async function migrate() {
    console.log('🚀 Starting migration to Supabase...');

    // 1. Migrate Tables
    const tablesConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'public/data/tables.json'), 'utf8'));
    
    for (const table of tablesConfig) {
        const filePath = path.join(__dirname, 'public/data/rows', table.file);
        if (fs.existsSync(filePath)) {
            const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            console.log(`📦 Migrating table: ${table.id} (${rows.length} rows)`);
            
            await uploadToSupabase(table.id, rows);
        }
    }

    // 2. Migrate Auth
    const authPath = path.join(__dirname, 'public/data/auth.json');
    if (fs.existsSync(authPath)) {
        const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        console.log(`🔐 Migrating authentication data...`);
        await uploadToSupabase('app_auth', authData);
    }

    // 3. Migrate Favorites (if exists)
    const favsPath = path.join(__dirname, 'public/data/favorites.json');
    if (fs.existsSync(favsPath)) {
        const favsData = JSON.parse(fs.readFileSync(favsPath, 'utf8'));
        for (const [user, ids] of Object.entries(favsData)) {
            console.log(`⭐ Migrating favorites for user: ${user}`);
            await uploadToSupabase(`favs_${user}`, ids);
        }
    }

    console.log('✅ Migration complete! Your app is now powered by Supabase.');
}

async function uploadToSupabase(id, rows) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/table_data`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ id, rows })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error(`❌ Failed to upload ${id}:`, err);
    }
}

migrate().catch(console.error);
