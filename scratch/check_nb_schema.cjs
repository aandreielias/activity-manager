
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_CONFIG } = require('./src/config.js');

const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

async function checkSchema() {
    // We can't easily see constraints via simple select, but we can try to find them in information_schema
    const { data, error } = await supabase.rpc('get_table_constraints', { t_name: 'nb_nutzer_berechtigungen' });
    if (error) {
        // Fallback: Just try to get column info
        console.log('Error getting constraints, getting columns instead:', error);
        const { data: cols, error: err2 } = await supabase.from('nb_nutzer_berechtigungen').select('*').limit(1);
        console.log('Columns:', Object.keys(cols[0] || {}));
    } else {
        console.log('Constraints:', data);
    }
}

checkSchema();
