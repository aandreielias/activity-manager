import { SupabaseClient } from './SupabaseClient.js';
import { InventoryService } from './InventoryService.js';
import { ColourFactory } from '../utils/ColourFactory.js';

/**
 * DataService — CRUD operations against the relational Supabase schema.
 *
 * Maps front-end table IDs to the correct Supabase table and transforms
 * row data between the app format and the database column format.
 */
export class DataService {

    /**
     * Determine which Supabase table a front-end table ID maps to,
     * and supply additional defaults (e.g. the activity category).
     */
    static _resolveTable(tableId) {
        // Resolve virtual people tables to the real 'people' table
        if (tableId.startsWith('people_') || tableId.startsWith('split_people_') || tableId === 'tbl_people') {
            return { supaTable: 'people', category: null };
        }
        if (tableId === 'tbl_inventory') {
            return { supaTable: 'inventory', category: null };
        }
        if (tableId.startsWith('tbl_sport_')) {
            return { supaTable: 'sport_venues', category: tableId.replace('tbl_sport_', '') };
        }
        if (tableId.startsWith('tbl_activities_')) {
            return { supaTable: 'activities', category: tableId.replace('tbl_activities_', '') };
        }
        if (tableId === 'tbl_events') {
            return { supaTable: 'events', category: null };
        }
        if (tableId === 'tbl_ort') {
            return { supaTable: 'ort', category: null };
        }
        return { supaTable: tableId, category: null };
    }

    // ── READ ───────────────────────────────────────────────────
    
    /**
     * Loads the global table definitions from the structured table_definitions table.
     * Replaces the old app_config JSON approach.
     */
    static async loadTableDefinitions() {
        const res = await SupabaseClient.get('table_definitions', '?order=order_index.asc');
        if (!res.ok) {
            console.warn('[DataService] Structured table_definitions not found or inaccessible.');
            return null;
        }
        return await res.json();
    }

    /**
     * Load all rows for a front-end table.
     * Returns an array of plain objects.
     */
    static async loadRows(tableId) {
        const { supaTable, category } = this._resolveTable(tableId);

        let query = '?select=*';
        if (supaTable === 'people') {
            query = '?select=*,person_teams(teams(name))';
        } else if (supaTable === 'activities' && category) {
            query = `?select=*,activity_required_items(*,inventory(name))&category=eq.${category}`;
        } else if (supaTable === 'sport_venues') {
            query = '?select=*,address:ort(*)';
            if (category) query += `&sport_type=eq.${category}`;
        } else if (supaTable === 'events') {
            query = '?select=*,location:ort(*)';
        }

        const res = await SupabaseClient.get(supaTable, query);

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Load failed for ${tableId}: ${res.status} ${txt}`);
        }

        const rows = await res.json();
        return rows.map(r => this._fromDb(supaTable, r));
    }

    // ── SAVE (full table upsert) ──────────────────────────────

    /**
     * Save an entire table's rows. This upserts each row individually.
     * @param {string} tableId  Front-end table ID
     * @param {string} _filename  Legacy param (ignored)
     * @param {Array}  rows  Array of Row instances or plain objects
     * @param {Array}  deletedIds  Optional list of IDs to delete
     */
    static async saveTable(tableId, _filename, rows, deletedIds = []) {
        const { supaTable, category } = this._resolveTable(tableId);

        if (supaTable === 'events') {
            await this._checkConflicts(rows);
        }

        // Check for concurrent edits
        await this._checkConcurrentEdits(tableId, rows);

        const dbRows = rows.map(row => {
            const plain = row.toJSON ? row.toJSON() : row;
            return this._toDb(supaTable, plain, category);
        });

        // Delete rows that were explicitly removed
        if (deletedIds && deletedIds.length > 0) {
            await this._deleteRemovedRows(supaTable, category, deletedIds, tableId);
        }

        // Upsert all current rows
        if (dbRows.length > 0) {
            const res = await SupabaseClient.post(supaTable, dbRows, { 'Prefer': 'resolution=merge-duplicates' });

            if (!res.ok) {
                const txt = await res.text();
                console.error(`[DataService] Upsert failed for ${tableId}:`, txt);
                throw new Error(`Fehler beim Speichern: ${res.status}. Grund: ${txt}`);
            }

            // After successful save, sync junction tables
            for (let i = 0; i < rows.length; i++) {
                const plain = rows[i].toJSON ? rows[i].toJSON() : rows[i];
                const rowId = dbRows[i].id;
                if (!rowId) continue;

                if (supaTable === 'people' && plain.Team !== undefined) {
                    await this._syncPersonTeams(rowId, plain.Team);
                } else if (supaTable === 'activities' && plain.required_items !== undefined) {
                    await this._syncActivityInventory(rowId, plain.required_items);
                }
            }
        }
        
        await this.logAudit('UPSERT', supaTable, { affected: dbRows.length, category: category || 'none' });

        return { success: true, message: `Table ${tableId} saved` };
    }

    static async _checkConflicts(rows) {
        const userToTime = {};
        const conflicts = [];

        for (const row of rows) {
            const data = row.toJSON ? row.toJSON() : row;
            if (!data.date || !data.time || !data.games) continue;
            
            try {
                const games = JSON.parse(data.games);
                games.forEach(g => {
                    if (g.responsible) {
                        const key = `${data.date}_${data.time}`;
                        if (!userToTime[key]) userToTime[key] = [];
                        if (userToTime[key].includes(g.responsible)) {
                            conflicts.push(`Person ID ${g.responsible} ist mehrfach gebucht am ${data.date} um ${data.time} für ${g.name}`);
                        } else {
                            userToTime[key].push(g.responsible);
                        }
                    }
                });
            } catch(e) {}
        }
        
        if (conflicts.length > 0) {
            const { Dialog } = await import('../ui/Dialog.js');
            const ok = await Dialog.confirm({
                title: 'Konflikte erkannt',
                message: `Es gibt zeitliche Überschneidungen:\n\n${conflicts.join('\\n')}\n\nTrotzdem speichern?`,
                confirmText: 'Speichern erzwingen',
                confirmStyle: 'warning'
            });
            if (!ok) {
                throw new Error('Speichern durch Benutzer abgebrochen (Konflikt).');
            }
        }
    }

    static async logAudit(action, tableName, details) {
        try {
            const { GlobalStateManager } = await import('../core/GlobalStateManager.js');
            const user = GlobalStateManager.getInstance().getCurrentUser();
            const payload = {
                action,
                table_name: tableName,
                user_name: user,
                details: typeof details === 'string' ? details : JSON.stringify(details),
                created_at: new Date().toISOString()
            };
            const res = await SupabaseClient.post('audit_logs', [payload]);
            if (!res.ok) console.warn('[AuditService] Audit_logs table likely missing.');
        } catch(e) {
            console.warn('[AuditService] Skipping audit log:', e.message);
        }
    }

    /**
     * Delete rows from the DB that are no longer present in the current dataset.
     */
    static async _deleteRemovedRows(supaTable, category, deletedIds, tableId) {
        if (!deletedIds || deletedIds.length === 0) return;
        
        let deleteQuery = `?id=in.(${deletedIds.map(id => `"${id}"`).join(',')})`;

        if (supaTable === 'activities' && category) {
            deleteQuery += `&category=eq.${category}`;
        } else if (supaTable === 'sport_venues' && category) {
            deleteQuery += `&sport_type=eq.${category}`;
        }

        await SupabaseClient.delete(supaTable, deleteQuery);
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
                rolle: this._capitalizeFirst(row.role || row.rolle || 'User'),
                responsibility_1: row.responsibility_1 ? row.responsibility_1.toLowerCase() : null,
                responsibility_2: row.responsibility_2 ? row.responsibility_2.toLowerCase() : null,
                spez_zustaendigkeit: row['Spez. Zuständigkeit'] || row.spez_zustaendigkeit || '',
                created_by: row.id ? undefined : (row.createdBy || null),
                created_at: row.id ? undefined : (row.createdAt || new Date().toISOString())
            };

        case 'activities':
            return {
                id: row.id,
                name: row.name || '',
                category,
                short_description: row.short_description || '',
                rules: row.rules || '',
                duration_minutes: this._parseIntOrNull(row.duration_minutes),
                preparation_minutes: this._parseIntOrNull(row.preparation_minutes),
                location: row.location || null,
                location_notes: row.location_notes || '',
                min_players: this._parseIntOrNull(row.min_players),
                max_players: this._parseIntOrNull(row.max_players),
                cost: row.cost || '',
                link: row.link || '',
                team_tasks: row.team_tasks || '',
                responsible_id: row.responsible || row.responsible_id || null,
                status: row.status || 'To Do',
                created_by: row.id ? undefined : (row.createdBy || null),
                created_at: row.id ? undefined : (row.createdAt || new Date().toISOString())
            };

        case 'inventory':
            // Auto-capitalize condition to match Postgres enum (Neu, Gut, Gebraucht, Defekt)
            let condition = row.condition;
            if (typeof condition === 'string' && condition.length > 0) {
                condition = condition.charAt(0).toUpperCase() + condition.slice(1).toLowerCase();
            }
            return {
                id: row.id,
                name: row.name || '',
                quantity: row.quantity ? parseInt(row.quantity, 10) || 0 : 0,
                storage_location: row.storage_location || '',
                condition: condition || 'Gut',
                last_checked: row.last_checked || null,
                notes: row.notes || '',
                image_url: row.image_url || null,
                created_by: row.createdBy || null,
                created_at: row.createdAt || new Date().toISOString()
            };

        case 'sport_venues':
            return {
                id: row.id,
                sport_type: row.category || null,
                name: row.name || '',
                address: row.address?.id || null,
                phone: row.phone || '',
                venue_type: row.type || row.venue_type || null,
                indoor_outdoor: row.indoor_outdoor || null,
                cost: row.cost || '',
                notes: row.notes || '',
                created_by: row.createdBy || null,
                created_at: row.createdAt || new Date().toISOString()
            };

        case 'events':
            return {
                id: row.id,
                name: row.name || '',
                date: row.date || null,
                time: row.time || '18:30',
                location: row.location?.id || null,
                reihenfolge: row.reihenfolge || '',
                status: row.status || 'To Do',
                responsible_id: row.responsible || row.responsible_id || null,
                notes: row.notes || '',
                created_by: row.id ? undefined : (row.createdBy || null),
                created_at: row.id ? undefined : (row.createdAt || new Date().toISOString())
            };

        case 'ort':
            return {
                id: row.id,
                title: row.title || '',
                street: row.street || '',
                address_extra: row.address_extra || '',
                zip_code: row.zip_code || '',
                city: row.city || '',
                link: row.link || '',
                notes: row.notes || '',
                created_by: row.createdBy || null,
                created_at: row.createdAt || new Date().toISOString()
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
                Status: row.status ? this._capitalizeFirst(row.status) : 'Aktiv',
                role: row.rolle || 'User',
                responsibility_1: row.responsibility_1 ? this._capitalizeFirst(row.responsibility_1) : '',
                responsibility_2: row.responsibility_2 ? this._capitalizeFirst(row.responsibility_2) : '',
                'Spez. Zuständigkeit': row.spez_zustaendigkeit || '',
                Team: (row.person_teams || []).map(pt => pt.teams?.name).filter(Boolean).join(', '),
                createdBy: row.created_by || 'Unbekannt',
                createdAt: row.created_at || null,
                last_updated: row.updated_at || null,
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
                status: row.status || 'To Do',
                createdBy: row.created_by || 'Unbekannt',
                createdAt: row.created_at || null,
                last_updated: row.updated_at || null,
            };

        case 'inventory':
            return {
                id: row.id,
                name: row.name || '',
                quantity: row.quantity ?? '',
                storage_location: row.storage_location || '',
                condition: row.condition ? this._capitalizeFirst(row.condition) : 'Gut',
                last_checked: row.last_checked || '',
                notes: row.notes || '',
                image_url: row.image_url || null,
                createdBy: row.created_by || 'Unbekannt',
                createdAt: row.created_at || null,
                last_updated: row.updated_at || null,
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
                createdBy: row.created_by || 'Unbekannt',
                createdAt: row.created_at || null,
                last_updated: row.updated_at || null,
            };

        case 'events':
            return {
                id: row.id,
                name: row.name || '',
                date: row.date || '',
                time: row.time || '',
                location: row.location || '',
                reihenfolge: row.reihenfolge || '',
                status: row.status || 'To Do',
                responsible: row.responsible_id || '',
                notes: row.notes || '',
                createdBy: row.created_by || 'Unbekannt',
                createdAt: row.created_at || null,
                last_updated: row.updated_at || null,
            };

        case 'ort':
            return {
                id: row.id,
                title: row.title || '',
                street: row.street || '',
                address_extra: row.address_extra || '',
                zip_code: row.zip_code || '',
                city: row.city || '',
                link: row.link || '',
                notes: row.notes || '',
                createdBy: row.created_by || 'Unbekannt',
                createdAt: row.created_at || null,
                last_updated: row.updated_at || null,
            };

        default:
            return row;
        }
    }

    // ── People-specific helpers ───────────────────────────────

    static async loadPeople() {
        return this.loadRows('tbl_people');
    }

    static async savePeople(rows) {
        return this.saveTable('tbl_people', null, rows);
    }

    // ── Junction Sync Helpers ────────────────────────────────

    static async _syncPersonTeams(personId, teamString) {
        await SupabaseClient.delete('person_teams', `?person_id=eq.${personId}`);

        if (!teamString || teamString === '—') return;

        const teamNames = teamString.split(',').map(s => s.trim()).filter(Boolean);
        if (teamNames.length === 0) return;

        const teamsRes = await SupabaseClient.get(
            'teams',
            `?name=in.(${teamNames.map(n => `"${n}"`).join(',')})`
        );
        if (!teamsRes.ok) return;
        const teams = await teamsRes.json();

        const junctionRows = teams.map(t => ({
            person_id: personId,
            team_id: t.id
        }));

        if (junctionRows.length > 0) {
            const res = await SupabaseClient.post('person_teams', junctionRows);
            if (!res.ok) console.error('[DataService] Sync PersonTeams failed:', await res.text());
        }
    }

    static async _syncActivityInventory(activityId, inventoryString) {
        await SupabaseClient.delete('activity_required_items', `?activity_id=eq.${activityId}`);

        const items = InventoryService.parseInventoryString(inventoryString);
        if (items.length === 0) return;

        const names = items.map(i => i.name);
        const invRes = await SupabaseClient.get(
            'inventory',
            `?name=in.(${names.map(n => `"${n}"`).join(',')})`
        );
        if (!invRes.ok) {
            console.error('[DataService] Sync Inventory fetch failed:', await invRes.text());
            return;
        }
        const inventory = await invRes.json();

        const junctionRows = items.map(item => {
            const match = inventory.find(inv => inv.name.toLowerCase() === item.name.toLowerCase());
            if (!match) return null;
            return {
                activity_id: activityId,
                inventory_id: match.id,
                quantity_needed: item.quantity ? parseInt(item.quantity, 10) || 0 : 0,
            };
        }).filter(Boolean);

        if (junctionRows.length > 0) {
            const res = await SupabaseClient.post('activity_required_items', junctionRows);
            if (!res.ok) console.error('[DataService] Sync ActivityInventory failed:', await res.text());
        }
    }

    static async createActivity(name, category = 'sonstige') {
        const tableId = `tbl_activities_${category}`;
        const payload = {
            name,
            category,
            status: 'To Do',
            created_at: new Date().toISOString()
        };
        const res = await SupabaseClient.post('activities', payload, { 'Prefer': 'return=representation' });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Failed to create activity: ${txt}`);
        }
        const rows = await res.json();
        return rows[0];
    }

    // ── Utility ───────────────────────────────────────────────

    static _capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    static _parseIntOrNull(value) {
        if (!value) return null;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
    }

    static async createTeam(name) {
        const payload = {
            name: name,
            color: ColourFactory.getRandomPremiumColor()
        };
        const res = await SupabaseClient.post('teams', [payload], { 'Prefer': 'return=representation' });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Failed to create team: ${txt}`);
        }
        const rows = await res.json();
        return rows[0];
    }

    static async _checkConcurrentEdits(tableId, rows) {
        const { supaTable, category } = this._resolveTable(tableId);

        const ids = rows.map(r => r.id || (r.toJSON ? r.toJSON().id : null)).filter(Boolean);
        if (ids.length === 0) return;

        let query = `?select=id,updated_at&id=in.(${ids.map(id => `"${id}"`).join(',')})`;
        if (supaTable === 'activities' && category) {
            query += `&category=eq.${category}`;
        } else if (supaTable === 'sport_venues' && category) {
            query += `&sport_type=eq.${category}`;
        }

        const res = await SupabaseClient.get(supaTable, query);
        if (!res.ok) {
            const error = await res.json();
            // If column doesn't exist, just skip checking to avoid blocking the user
            if (error.code === '42703') {
                console.warn(`[DataService] Column updated_at missing on ${supaTable}. Skipping concurrent check.`);
                return;
            }
            console.warn('[DataService] Could not check for concurrent edits:', error);
            return;
        }

        const currentRows = await res.json();
        const currentMap = new Map(currentRows.map(r => [r.id, r.updated_at]));

        const conflicts = [];
        for (const row of rows) {
            const plain = row.toJSON ? row.toJSON() : row;
            const currentUpdated = currentMap.get(plain.id);
            const localUpdated = plain.last_updated;
            if (currentUpdated && localUpdated && new Date(currentUpdated) > new Date(localUpdated)) {
                conflicts.push(plain.id);
            }
        }

        if (conflicts.length > 0) {
            const { Dialog } = await import('../ui/Dialog.js');
            const choice = await Dialog.showConflictDialog(conflicts.length);
            if (choice === 'reload') {
                throw new Error('Reload requested due to concurrent edits.');
            } else if (choice === 'cancel') {
                throw new Error('Save cancelled due to concurrent edits.');
            }
            // If 'overwrite', continue
        }
    }
}
