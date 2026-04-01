/**
 * Migration Script: Old blob `table_data` → New relational tables
 *
 * Reads all data from the old `table_data` table (Supabase blob store)
 * and inserts it into the new relational tables.
 *
 * Usage: node migrate_to_relational.js
 */

const SUPABASE_URL = 'https://kmsdsymoehleonxzcbnm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imttc2RzeW1vZWhsZW9ueHpjYm5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTg3NjAsImV4cCI6MjA5MDUzNDc2MH0.Z0eznsy0BBFpwHKtlXBVNk5M8Yc_saXEpYB-DH7yt0g';

const headers = {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
};

async function supaFetch(path, opts = {}) {
    const { headers: extraHeaders, ...restOpts } = opts;
    const mergedHeaders = { ...headers, ...(extraHeaders || {}) };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...restOpts,
        headers: mergedHeaders,
    });
    return res;
}

async function loadOldBlob(id) {
    const res = await supaFetch(`table_data?id=eq.${id}&select=rows`);
    if (!res.ok) { console.log(`  ⚠ Could not load ${id}: ${res.status}`); return null; }
    const data = await res.json();
    return data?.[0]?.rows || null;
}

async function upsert(table, rows) {
    if (!rows || rows.length === 0) { console.log(`  → ${table}: nothing to insert`); return; }
    const res = await supaFetch(table, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
    });
    if (!res.ok) {
        const txt = await res.text();
        console.error(`  ✗ ${table} insert failed: ${res.status} ${txt}`);
    } else {
        console.log(`  ✓ ${table}: ${rows.length} rows inserted`);
    }
}

// ────────────────────────────────────────────────────────────────
// Migration functions
// ────────────────────────────────────────────────────────────────

async function migratePeople() {
    console.log('\n── Migrating People ──');
    const rows = await loadOldBlob('tbl_people');
    if (!rows || !Array.isArray(rows)) { console.log('  No people data found'); return; }

    const mapped = rows.map(r => ({
        id: crypto.randomUUID(),
        vorname: r.vorname || '',
        nachname: r.nachname || '',
        telefon: r['Tel.'] || r.telefon || '',
        status: (r.Status || r.status || 'aktiv').toLowerCase() === 'aktiv' ? 'aktiv' : 'inaktiv',
        rolle: mapRolle(r.role || r.rolle),
        spez_zustaendigkeit: r['Spez. Zuständigkeit'] || r.spez_zustaendigkeit || '',
    }));

    await upsert('people', mapped);
}

function mapRolle(role) {
    const r = (role || '').trim();
    if (['Superadmin', 'Admin', 'Supervisor', 'User'].includes(r)) return r;
    if (r.toLowerCase() === 'admin') return 'Admin';
    if (r.toLowerCase() === 'superadmin') return 'Superadmin';
    return 'User';
}

async function migrateActivities(tableId, category) {
    console.log(`\n── Migrating Activities: ${tableId} (${category}) ──`);
    const rows = await loadOldBlob(tableId);
    if (!rows || !Array.isArray(rows)) { console.log(`  No data for ${tableId}`); return; }

    const mapped = rows.map(r => ({
        id: crypto.randomUUID(),
        name: r.name || '',
        category: category,
        short_description: r.short_description || '',
        rules: r.rules || '',
        duration_minutes: parseInt(r.duration_minutes) || null,
        preparation_minutes: parseInt(r.preparation_minutes) || null,
        location: mapLocation(r.location),
        location_notes: r.location_notes || '',
        min_players: parseInt(r.min_players) || null,
        max_players: parseInt(r.max_players) || null,
        cost: r.cost || '',
        link: r.link || '',
        team_tasks: r.team_tasks || '',
        responsible_id: null, // Would need person UUID lookup
    }));

    await upsert('activities', mapped);
}

function mapLocation(loc) {
    if (!loc) return null;
    const l = loc.toLowerCase().trim();
    if (l === 'überall' || l === 'ueberall') return 'ueberall';
    if (l === 'indoor') return 'indoor';
    if (l === 'outdoor') return 'outdoor';
    return null;
}

async function migrateInventory() {
    console.log('\n── Migrating Inventory ──');
    const rows = await loadOldBlob('tbl_inventory');
    if (!rows || !Array.isArray(rows)) { console.log('  No inventory data'); return; }

    const mapped = rows.map(r => ({
        id: crypto.randomUUID(),
        name: r.name || '',
        quantity: parseInt(r.quantity) || 0,
        storage_location: r.storage_location || '',
        condition: mapCondition(r.condition),
        last_checked: r.last_checked || null,
        notes: r.notes || '',
    }));

    await upsert('inventory', mapped);
}

function mapCondition(c) {
    if (!c) return 'gut';
    const v = c.toLowerCase().trim();
    if (['neu', 'gut', 'gebraucht', 'defekt'].includes(v)) return v;
    return 'gut';
}

async function migrateSportVenues(tableId, sportType) {
    console.log(`\n── Migrating Sport Venues: ${tableId} (${sportType}) ──`);
    const rows = await loadOldBlob(tableId);
    if (!rows || !Array.isArray(rows)) { console.log(`  No data for ${tableId}`); return; }

    const mapped = rows.map(r => ({
        id: crypto.randomUUID(),
        sport_type: sportType,
        name: r.name || '',
        address: r.address || '',
        phone: r.phone || '',
        venue_type: mapVenueType(r.type),
        indoor_outdoor: mapIndoorOutdoor(r.indoor_outdoor),
        cost: r.cost || '',
        notes: r.notes || '',
    }));

    await upsert('sport_venues', mapped);
}

function mapVenueType(t) {
    if (!t) return null;
    const valid = ['Halle', 'Sand', 'Rasen', 'Kunstrasen', 'Hartplatz'];
    // Handle "Sand / Beach" -> "Sand"
    for (const v of valid) {
        if (t.includes(v)) return v;
    }
    return null;
}

function mapIndoorOutdoor(v) {
    if (!v) return null;
    if (v.toLowerCase().includes('indoor')) return 'Indoor';
    if (v.toLowerCase().includes('outdoor')) return 'Outdoor';
    return null;
}

async function migrateAuth() {
    console.log('\n── Migrating Auth → Users table ──');
    const authMap = await loadOldBlob('app_auth');
    if (!authMap || typeof authMap !== 'object') { console.log('  No auth data'); return; }

    for (const [username, password] of Object.entries(authMap)) {
        // Check if user exists first
        const checkRes = await supaFetch(`users?username=eq.${encodeURIComponent(username)}&select=id`);
        const existing = checkRes.ok ? await checkRes.json() : [];
        if (existing.length > 0) {
            console.log(`  → User "${username}" already exists, skipping`);
            continue;
        }

        const user = {
            id: crypto.randomUUID(),
            username: username,
            password_hash: password,
            role: (username === 'root' || username === 'Elias Andrei') ? 'admin' : 'user',
        };

        const res = await supaFetch('users', {
            method: 'POST',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify(user),
        });
        if (res.ok) {
            console.log(`  ✓ User "${username}" created`);
        } else {
            const txt = await res.text();
            console.error(`  ✗ User "${username}" failed: ${txt}`);
        }
    }
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

async function main() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║  Migration: table_data → relational schema ║');
    console.log('╚════════════════════════════════════════════╝');

    // 1. People
    await migratePeople();

    // 2. Activities (5 categories)
    await migrateActivities('tbl_activities_gruppen', 'gruppen');
    await migrateActivities('tbl_activities_zwischendurch', 'zwischendurch');
    await migrateActivities('tbl_activities_icebreaker', 'icebreaker');
    await migrateActivities('tbl_activities_sport', 'sport');
    await migrateActivities('tbl_activities_sonstige', 'sonstige');

    // 3. Inventory
    await migrateInventory();

    // 4. Sport Venues
    await migrateSportVenues('tbl_sport_volleyball', 'volleyball');
    await migrateSportVenues('tbl_sport_fussball', 'fussball');

    // 5. Auth → Users
    await migrateAuth();

    console.log('\n✅ Migration complete!');
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
