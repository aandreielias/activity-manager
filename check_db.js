import { SUPABASE_CONFIG } from './src/config.js';

console.log('Script started');
async function checkDb() {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_CONFIG.ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
        };

        console.log('Fetching app_config...');
        const configRes = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/app_config?id=eq.tables_config`, { headers });
        const configs = await configRes.json();
        console.log('--- Table Config ---');
        console.log(JSON.stringify(configs, null, 2));

        console.log('\nFetching enums...');
        const enumRes = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/rpc/get_all_enums`, { 
            method: 'POST',
            headers 
        });
        const enums = await enumRes.json();
        console.log('--- Enums via RPC ---');
        console.log(JSON.stringify(enums, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

checkDb();
