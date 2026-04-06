import { SUPABASE_CONFIG } from './src/config.js';

async function setupStatusColumn() {
    const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_CONFIG.ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
    };

    try {
        // 1. Create Enum
        console.log('Creating task_status_enum...');
        await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/rpc/create_enum_type`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                t_name: 'task_status_enum',
                options: ['To Do', 'In Progress', 'Done']
            })
        });

        // 2. Add column to activities
        console.log('Adding status to activities...');
        await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/rpc/add_table_column`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                t_name: 'activities',
                c_name: 'status',
                c_type: 'task_status_enum'
            })
        });

        // 3. Add column to events
        console.log('Adding status to events...');
        await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/rpc/add_table_column`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                t_name: 'events',
                c_name: 'status',
                c_type: 'task_status_enum'
            })
        });

        // 4. Update app_config
        console.log('Updating app_config...');
        const configRes = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/app_config?id=eq.tables_config`, { headers });
        const configs = await configRes.json();
        const fullConfig = configs[0].config;

        const statusCol = { id: 'status', label: 'Status', type: 'enum' };

        fullConfig.forEach(table => {
            if (table.category === 'spiele' || table.id === 'tbl_events') {
                // Add status before createdBy
                const schema = table.schema;
                if (!schema.find(c => c.id === 'status')) {
                    const auditIdx = schema.findIndex(c => c.id === 'createdBy');
                    if (auditIdx !== -1) schema.splice(auditIdx, 0, statusCol);
                    else schema.push(statusCol);
                }
            }
        });

        const updateRes = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/app_config?id=eq.tables_config`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                config: fullConfig,
                updated_at: new Date().toISOString()
            })
        });

        if (updateRes.ok) {
            console.log('Successfully updated app_config');
        } else {
            console.error('Failed to update app_config:', await updateRes.text());
        }

    } catch (err) {
        console.error('Error during setup:', err);
    }
}

setupStatusColumn();
