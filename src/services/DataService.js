import { SUPABASE_CONFIG } from '../config.js';

/**
 * DataService — CRUD operations against the relational Supabase schema.
 *
 * Maps front-end table IDs to the correct Supabase table and transforms
 * row data between the app format and the database column format.
 */
export class DataService {

    // ── Helpers ────────────────────────────────────────────────

    static _headers(extra = {}) {
        return {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_CONFIG.ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
            ...extra,
        };
    }

    static _url(table, query = '') {
        return `${SUPABASE_CONFIG.URL}/rest/v1/${table}${query}`;
    }

    /**
     * Determine which Supabase table a front-end table ID maps to,
     * and supply additional defaults (e.g. the activity category).
     */
    static _resolveTable(tableId) {
        if (tableId === 'tbl_people' || tableId === 'people_table') {
            return { supaTable: 'people', category: null };
        }
        if (tableId === 'tbl_inventory') {
            return { supaTable: 'inventory', category: null };
        }
        if (tableId.startsWith('tbl_sport_')) {
            const sport = tableId.replace('tbl_sport_', ''); // volleyball | fussball
            return { supaTable: 'sport_venues', category: sport };
        }
        if (tableId.startsWith('tbl_activities_')) {
            const cat = tableId.replace('tbl_activities_', ''); // gruppen | zwischendurch | …
            return { supaTable: 'activities', category: cat };
        }
        // Fallback – treat as-is
        return { supaTable: tableId, category: null };
    }

    // ── READ ───────────────────────────────────────────────────

    /**
     * Load all rows for a front-end table.
     * Returns an array of plain objects.
     */
    static async loadRows(tableId) {
        const { supaTable, category } = this._resolveTable(tableId);

        let query = '?select=*';
        if (supaTable === 'people') {
            // Join with person_teams and teams to get team names
            query = '?select=*,person_teams(teams(name))';
        }

        if (supaTable === 'activities' && category) {
            // Join with activity_required_items and inventory to get item names and quantities
            // Using * for activity_required_items to fetch all columns including 'quantity_needed'
            query = '?select=*,activity_required_items(*,inventory(name))';
            query += `&category=eq.${category}`;
        } else if (supaTable === 'sport_venues' && category) {
            query += `&sport_type=eq.${category}`;
        }

        const res = await fetch(this._url(supaTable, query), {
            headers: this._headers(),
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Load failed for ${tableId}: ${res.status} ${txt}`);
        }

        const rows = await res.json();

        // Map DB column names back to app column names where needed
        return rows.map(r => this._fromDb(supaTable, r));
    }

    // ── SAVE (full table upsert) ──────────────────────────────

    /**
     * Save an entire table's rows. This upserts each row individually.
     * @param {string} tableId  Front-end table ID
     * @param {string} _filename  Legacy param (ignored)
     * @param {Array}  rows  Array of Row instances or plain objects
     */
    static async saveTable(tableId, _filename, rows) {
        const { supaTable, category } = this._resolveTable(tableId);

        const dbRows = rows.map(row => {
            const plain = row.toJSON ? row.toJSON() : row;
            return this._toDb(supaTable, plain, category);
        });

        // First, delete rows that no longer exist (full replace strategy)
        const currentIds = dbRows.map(r => r.id).filter(Boolean);

        if (currentIds.length > 0) {
            // Delete rows for this category/sport that are NOT in the current set
            let deleteQuery = `?id=not.in.(${currentIds.map(id => `"${id}"`).join(',')})`;
            if (supaTable === 'activities' && category) {
                deleteQuery += `&category=eq.${category}`;
            } else if (supaTable === 'sport_venues' && category) {
                deleteQuery += `&sport_type=eq.${category}`;
            }

            await fetch(this._url(supaTable, deleteQuery), {
                method: 'DELETE',
                headers: this._headers(),
            });
        } else {
            // All rows deleted — delete everything for this category
            let deleteQuery = '?id=not.is.null';
            if (supaTable === 'activities' && category) {
                deleteQuery += `&category=eq.${category}`;
            } else if (supaTable === 'sport_venues' && category) {
                deleteQuery += `&sport_type=eq.${category}`;
            }
            await fetch(this._url(supaTable, deleteQuery), {
                method: 'DELETE',
                headers: this._headers(),
            });
        }

        // Upsert all current rows
        if (dbRows.length > 0) {
            const res = await fetch(this._url(supaTable), {
                method: 'POST',
                headers: this._headers({ 'Prefer': 'resolution=merge-duplicates' }),
                body: JSON.stringify(dbRows),
            });

            if (!res.ok) {
                const txt = await res.text();
                console.error(`[DataService] Upsert failed for ${tableId}:`, txt);
                throw new Error(`Fehler beim Speichern: ${res.status}. Grund: ${txt}`);
            }

            // After successful save of main rows, sync junction tables
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const plain = row.toJSON ? row.toJSON() : row;
                const rowId = dbRows[i].id;
                if (!rowId) continue;

                if (supaTable === 'people' && (plain.Team !== undefined)) {
                    await this._syncPersonTeams(rowId, plain.Team);
                } else if (supaTable === 'activities' && (plain.required_items !== undefined)) {
                    await this._syncActivityInventory(rowId, plain.required_items);
                }
            }
        }

        return { success: true, message: `Table ${tableId} saved` };
    }

    // ── Column Mapping: App → DB ──────────────────────────────

    static _toDb(supaTable, row, category) {
        switch (supaTable) {
            case 'people':
                return {
                    id: row.id,
                    vorname: row.vorname || '',
                    nachname: row.nachname || '',
                    telefon: row['Tel.'] || row.telefon || '',
                    status: (row.Status || row.status || 'Aktiv').toLowerCase(),
                    rolle: (row.role || row.rolle || 'User').charAt(0).toUpperCase() + (row.role || row.rolle || 'User').slice(1).toLowerCase(),
                    responsibility_1: row.responsibility_1 ? row.responsibility_1.toLowerCase() : null,
                    responsibility_2: row.responsibility_2 ? row.responsibility_2.toLowerCase() : null,
                    spez_zustaendigkeit: row['Spez. Zuständigkeit'] || row.spez_zustaendigkeit || '',
                };

            case 'activities':
                return {
                    id: row.id,
                    name: row.name || '',
                    category: category,
                    short_description: row.short_description || '',
                    rules: row.rules || '',
                    duration_minutes: row.duration_minutes ? parseInt(row.duration_minutes, 10) || null : null,
                    preparation_minutes: row.preparation_minutes ? parseInt(row.preparation_minutes, 10) || null : null,
                    location: row.location || null,
                    location_notes: row.location_notes || '',
                    min_players: row.min_players ? parseInt(row.min_players, 10) || null : null,
                    max_players: row.max_players ? parseInt(row.max_players, 10) || null : null,
                    cost: row.cost || '',
                    link: row.link || '',
                    team_tasks: row.team_tasks || '',
                    responsible_id: row.responsible || row.responsible_id || null,
                };

            case 'inventory':
                return {
                    id: row.id,
                    name: row.name || '',
                    quantity: row.quantity ? parseInt(row.quantity, 10) || 0 : 0,
                    storage_location: row.storage_location || '',
                    condition: row.condition || 'Gut',
                    last_checked: row.last_checked || null,
                    notes: row.notes || '',
                };

            case 'sport_venues':
                return {
                    id: row.id,
                    sport_type: category,
                    name: row.name || '',
                    address: row.address || '',
                    phone: row.phone || '',
                    venue_type: row.type || row.venue_type || null,
                    indoor_outdoor: row.indoor_outdoor || null,
                    cost: row.cost || '',
                    notes: row.notes || '',
                };

            default:
                return row;
        }
    }

    // ── Column Mapping: DB → App ──────────────────────────────

    static _fromDb(supaTable, row) {
        switch (supaTable) {
            case 'people':
                return {
                    id: row.id,
                    vorname: row.vorname || '',
                    nachname: row.nachname || '',
                    'Tel.': row.telefon || '',
                    Status: row.status ? (row.status.charAt(0).toUpperCase() + row.status.slice(1).toLowerCase()) : 'Aktiv',
                    role: row.rolle || 'User',
                    responsibility_1: row.responsibility_1 ? (row.responsibility_1.charAt(0).toUpperCase() + row.responsibility_1.slice(1).toLowerCase()) : '', 
                    responsibility_2: row.responsibility_2 ? (row.responsibility_2.charAt(0).toUpperCase() + row.responsibility_2.slice(1).toLowerCase()) : '',
                    'Spez. Zuständigkeit': row.spez_zustaendigkeit || '',
                    Team: (row.person_teams || []).map(pt => pt.teams?.name).filter(Boolean).join(', '),
                };

            case 'activities':
                return {
                    id: row.id,
                    name: row.name || '',
                    required_items: (row.activity_required_items || [])
                        .map(ari => ari.quantity_needed ? `${ari.inventory?.name} (${ari.quantity_needed})` : ari.inventory?.name)
                        .filter(Boolean)
                        .join(', '),
                    short_description: row.short_description || '',
                    rules: row.rules || '',
                    duration_minutes: row.duration_minutes ?? '',
                    preparation_minutes: row.preparation_minutes ?? '',
                    location: row.location || '',
                    location_notes: row.location_notes || '',
                    min_players: row.min_players ?? '',
                    max_players: row.max_players ?? '',
                    cost: row.cost || '',
                    link: row.link || '',
                    team_tasks: row.team_tasks || '',
                    responsible: row.responsible_id || '',
                };

            case 'inventory':
                return {
                    id: row.id,
                    name: row.name || '',
                    quantity: row.quantity ?? '',
                    storage_location: row.storage_location || '',
                    condition: row.condition || 'gut',
                    last_checked: row.last_checked || '',
                    notes: row.notes || '',
                };

            case 'sport_venues':
                return {
                    id: row.id,
                    name: row.name || '',
                    address: row.address || '',
                    phone: row.phone || '',
                    type: row.venue_type || '',
                    indoor_outdoor: row.indoor_outdoor || '',
                    cost: row.cost || '',
                    notes: row.notes || '',
                };

            default:
                return row;
        }
    }

    // ── People-specific helpers (used by App) ─────────────────

    static async loadPeople() {
        return this.loadRows('tbl_people');
    }

    static async savePeople(rows) {
        return this.saveTable('tbl_people', null, rows);
    }

    // ── Junction Sync Helpers ────────────────────────────────

    static async _syncPersonTeams(personId, teamString) {
        // 1. Clear existing
        await fetch(this._url('person_teams', `?person_id=eq.${personId}`), {
            method: 'DELETE',
            headers: this._headers(),
        });

        if (!teamString || teamString === '—') return;

        const teamNames = teamString.split(',').map(s => s.trim()).filter(Boolean);
        if (teamNames.length === 0) return;

        // 2. Fetch team IDs
        const teamsRes = await fetch(this._url('teams', `?name=in.(${teamNames.map(n => `"${n}"`).join(',')})`), {
            headers: this._headers(),
        });
        if (!teamsRes.ok) return;
        const teams = await teamsRes.json();

        // 3. Insert new junction rows
        const junctionRows = teams.map(t => ({ person_id: personId, team_id: t.id }));
        if (junctionRows.length > 0) {
            const res = await fetch(this._url('person_teams'), {
                method: 'POST',
                headers: this._headers(),
                body: JSON.stringify(junctionRows),
            });
            if (!res.ok) console.error('[DataService] Sync PersonTeams failed:', await res.text());
        }
    }

    static async _syncActivityInventory(activityId, inventoryString) {
        // 1. Clear existing
        await fetch(this._url('activity_required_items', `?activity_id=eq.${activityId}`), {
            method: 'DELETE',
            headers: this._headers(),
        });

        if (!inventoryString || inventoryString === '—' || !inventoryString.trim()) return;

        // Parse "Item (3), Item"
        const items = inventoryString.split(',').map(s => {
            const match = s.match(/(.+?)\s*\((.+?)\)/);
            if (match) return { name: match[1].trim(), quantity: match[2].trim() };
            return { name: s.trim(), quantity: null };
        }).filter(i => i.name);

        if (items.length === 0) return;

        // 2. Fetch inventory IDs
        const names = items.map(i => i.name);
        const invRes = await fetch(this._url('inventory', `?name=in.(${names.map(n => `"${n}"`).join(',')})`), {
            headers: this._headers(),
        });
        if (!invRes.ok) {
            console.error('[DataService] Sync Inventory fetch failed:', await invRes.text());
            return;
        }
        const inventory = await invRes.json();

        // 3. Insert new junction rows (using column 'count' for quantity as discovered)
        const junctionRows = items.map(item => {
            const match = inventory.find(inv => inv.name.toLowerCase() === item.name.toLowerCase());
            if (!match) return null;
            return {
                activity_id: activityId,
                inventory_id: match.id,
                quantity_needed: item.quantity ? parseInt(item.quantity, 10) || 0 : 0
            };
        }).filter(Boolean);

        if (junctionRows.length > 0) {
            const res = await fetch(this._url('activity_required_items'), {
                method: 'POST',
                headers: this._headers(),
                body: JSON.stringify(junctionRows),
            });
            if (!res.ok) console.error('[DataService] Sync ActivityInventory failed:', await res.text());
        }
    }
}
