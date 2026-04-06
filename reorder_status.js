import { SUPABASE_CONFIG } from './src/config.js';

async function reorderStatusColumn() {
    const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_CONFIG.ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
    };

    try {
        console.log('Fetching current app_config...');
        const configRes = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/app_config?id=eq.tables_config`, { headers });
        const configs = await configRes.json();
        const fullConfig = configs[0].config;

        fullConfig.forEach(table => {
            const schema = table.schema;
            const statusIdx = schema.findIndex(c => c.id === 'status');
            if (statusIdx === -1) return;

            // Remove it first
            const statusCol = schema.splice(statusIdx, 1)[0];

            if (table.category === 'spiele') {
                // Spiele: after name (Index 1)
                const nameIdx = schema.findIndex(c => c.id === 'name');
                if (nameIdx !== -1) {
                    schema.splice(nameIdx + 1, 0, statusCol);
                    console.log(`Reordered status for ${table.id} (after name)`);
                } else {
                    schema.unshift(statusCol); // Fallback to first
                }
            } else if (table.id === 'tbl_events') {
                // Events: after date (Index 2 if name is 0, date is 1)
                const dateIdx = schema.findIndex(c => c.id === 'date');
                if (dateIdx !== -1) {
                    schema.splice(dateIdx + 1, 0, statusCol);
                    console.log(`Reordered status for ${table.id} (after date)`);
                } else {
                    schema.splice(1, 0, statusCol); // Fallback to second
                }
            }
        });

        console.log('Updating app_config with new order...');
        const updateRes = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/app_config?id=eq.tables_config`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                config: fullConfig,
                updated_at: new Date().toISOString()
            })
        });

        if (updateRes.ok) {
            console.log('Successfully reordered status column in app_config');
        } else {
            console.error('Failed to update app_config:', await updateRes.text());
        }

    } catch (err) {
        console.error('Error during reordering:', err);
    }
}

reorderStatusColumn();
