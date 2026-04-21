import { SupabaseClient } from './SupabaseClient.js';
import { InventoryService } from './InventoryService.js';
import { ColourFactory } from '../utils/ColourFactory.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';
import { RepositoryFactory } from './repositories/RepositoryFactory.js';
import { DataAccessError } from './mappers/ResultMapper.js';

/**
 * DataService — CRUD operations against the relational Supabase schema.
 *
 * Maps front-end table IDs to the correct Supabase table and coordinates
 * with table-specific repositories for data transformation.
 * Now with validation, error handling, and efficient caching.
 */
export class DataService {

    /**
     * Determine which Supabase table a front-end table ID maps to,
     * and supply additional defaults (e.g. the activity category).
     */
    static _resolveTable(tableId) {
        const config = GlobalStateManager.getInstance().getTableConfig(tableId);

        if (config && config.supa_table) {
            return { 
                supaTable: config.supa_table, 
                category: config.team_identifier || null 
            };
        }

        // Fallback for legacy IDs or internal tables
        if (tableId.startsWith('people_') || tableId.startsWith('split_people_') || tableId === 'tbl_people') {
            return { supaTable: 'people', category: null };
        }
        if (tableId === 'tbl_inventory') {
            return { supaTable: 'inventory', category: null };
        }
        if (tableId === 'tbl_events') {
            return { supaTable: 'events', category: null };
        }
        if (tableId === 'tbl_ort') {
            return { supaTable: 'ort', category: null };
        }
        
        return { supaTable: tableId, category: null };
    }

    /**
     * Get a repository for a given table.
     * @private
     */
    static _getRepository(supaTable) {
        try {
            return RepositoryFactory.getRepository(supaTable);
        } catch (e) {
            console.warn(`[DataService] No repository for ${supaTable}, using pass-through`, e);
            return null;
        }
    }

    // ── READ ───────────────────────────────────────────────────
    
    /**
     * Loads the global table definitions from the structured table_definitions table.
     * Replaces the old app_config JSON approach.
     */
    static async loadTableDefinitions() {
        const res = await SupabaseClient.get('table_definitions', '?select=*,table_columns(*)&order=order_index.asc');
        if (!res.ok) {
            console.warn('[DataService] Structured table_definitions not found or inaccessible.');
            return null;
        }
        const data = await res.json();
        
        // Reconstruct the 'schema' array for each table from its table_columns
        return data.map(table => ({
            ...table,
            schema: (table.table_columns || [])
                .sort((a, b) => a.order_index - b.order_index)
                .map(col => ({
                    id: col.field_name,
                    label: col.label,
                    type: col.data_type,
                    ui_component: col.ui_component,
                    hidden: !col.is_visible,
                    editable: col.is_editable,
                    ...(col.config || {})
                }))
        }));
    }

    /**
     * Load all rows for a front-end table.
     * Returns an array of plain objects.
     */
    static async loadRows(tableId) {
        const gs = GlobalStateManager.getInstance();
        if (!gs.canView(tableId)) {
            console.warn(`[DataService] Access denied for table: ${tableId}`);
            return [];
        }

        const { supaTable, category } = this._resolveTable(tableId);

        let query = '?select=*';
        if (supaTable === 'people') {
            query = '?select=*,person_teams(teams(name)),person_responsibilities(responsibility)';
            
            // Filter by team if user is restricted
            const teams = gs.getCurrentTeams();
            if (teams.length > 0 && !gs.isAdmin() && !gs.isSuperAdmin()) {
                // This is a complex filter in Supabase (filtering by junction table value)
                // For simplicity, we'll fetch all and filter in memory, 
                // OR use a proper joined filter if supported.
                // query += `&person_teams.teams.name=in.(${teams.map(t => `"${t}"`).join(',')})`;
            }
        } else if (supaTable === 'activities' && category) {
            query = `?select=*,activity_required_items(*,inventory(name))&category=eq.${category}`;
        } else if (supaTable === 'inventory' && category) {
            // Check if we should filter - only if migration has likely run
            query = `?select=*&category=eq.${category}`;
        } else if (supaTable === 'sport_venues') {
            query = '?select=*,address:ort(*)';
            if (category) query += `&sport_type=eq.${category}`;
        } else if (supaTable === 'events') {
            query = '?select=*,location:ort(*)';
            if (category) query += `&category=eq.${category}`;
        }

        const res = await SupabaseClient.get(supaTable, query);

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Load failed for ${tableId}: ${res.status} ${txt}`);
        }

        let rows = await res.json();
        
        // Post-fetch filtering for teams if necessary
        if (supaTable === 'people') {
            const teams = gs.getCurrentTeams();
            if (teams.length > 0 && !gs.isAdmin() && !gs.isSuperAdmin()) {
                rows = rows.filter(r => {
                    const rowTeams = (r.person_teams || []).map(pt => pt.teams?.name).filter(Boolean);
                    return rowTeams.some(t => teams.includes(t));
                });
            }
        }

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
        const gs = GlobalStateManager.getInstance();
        if (!gs.canEdit(tableId)) {
            throw new Error('Keine Berechtigung zum Speichern dieser Tabelle.');
        }

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

                if (supaTable === 'people') {
                    if (plain.Team !== undefined) await this._syncPersonTeams(rowId, plain.Team);
                    if (plain.responsibility_1 !== undefined || plain.responsibility_2 !== undefined) {
                        await this._syncPersonResponsibilities(rowId, [plain.responsibility_1, plain.responsibility_2].filter(Boolean));
                    }
                } else if (supaTable === 'activities' && plain.required_items !== undefined) {
                    await this._syncActivityInventory(rowId, plain.required_items, category);
                }
            }
        }
        
        if (supaTable === 'inventory') {
            await this._reconcileMissingRequiredItems();
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
            
            // Mandatory audit logging with specific error handling
            const res = await SupabaseClient.post('audit_logs', [payload]);
            if (!res.ok) {
                const errorMsg = await res.text();
                console.error(`[AuditService] Failed to log audit: ${errorMsg}`);
                // Don't throw - audit failure shouldn't block main operation
                // But do log it for monitoring
                return { success: false, message: errorMsg };
            }
            return { success: true };
        } catch (e) {
            // Log all failures for debugging
            console.error(`[AuditService] Audit logging error: ${e.message}`);
            return { success: false, message: e.message };
        }
    }

    static async createTeam(name) {
        const payload = {
            name: name,
            color: ColourFactory.getRandomPremiumColor()
        };
        const res = await SupabaseClient.post('teams', [payload], { 'Prefer': 'return=representation' });
        if (!res.ok) {
            const txt = await res.text();
            throw new DataAccessError(
                `Failed to create team: ${txt}`,
                { table: 'teams', operation: 'CREATE' }
            );
        }
        const rows = await res.json();
        return rows[0];
    }

    /**
     * Delete rows from the DB that are no longer present in the current dataset.
     */
    static async _deleteRemovedRows(supaTable, category, deletedIds, tableId) {
        if (!deletedIds || deletedIds.length === 0) return;
        
        let deleteQuery = `?id=in.(${deletedIds.map(id => `"${id}"`).join(',')})`;

        if ((supaTable === 'activities' || supaTable === 'inventory' || supaTable === 'events') && category) {
            deleteQuery += `&category=eq.${category}`;
        } else if (supaTable === 'sport_venues' && category) {
            deleteQuery += `&sport_type=eq.${category}`;
        }

        await SupabaseClient.delete(supaTable, deleteQuery);
    }

    // ── Column Mapping: App → DB ──────────────────────────────

    static _toDb(supaTable, row, category) {
        const repo = this._getRepository(supaTable);
        if (repo) {
            return repo.toDb(row, category);
        }
        return row;
    }

    // ── Column Mapping: DB → App ──────────────────────────────

    static _fromDb(supaTable, row) {
        const repo = this._getRepository(supaTable);
        if (repo) {
            return repo.fromDb(row);
        }
        return row;
    }

    // ── People-specific helpers ───────────────────────────────

    static async loadPeople() {
        const config = GlobalStateManager.getInstance().getAllTableConfigs().find(c => c.supa_table === 'people');
        return this.loadRows(config ? config.id : 'tbl_people');
    }

    static async savePeople(rows) {
        const config = GlobalStateManager.getInstance().getAllTableConfigs().find(c => c.supa_table === 'people');
        return this.saveTable(config ? config.id : 'tbl_people', null, rows);
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

    static async _syncPersonResponsibilities(personId, responsibilities) {
        await SupabaseClient.delete('person_responsibilities', `?person_id=eq.${personId}`);

        if (!responsibilities || responsibilities.length === 0) return;

        const rows = responsibilities.map(r => ({
            person_id: personId,
            responsibility: r
        }));

        const res = await SupabaseClient.post('person_responsibilities', rows);
        if (!res.ok) console.error('[DataService] Sync Responsibilities failed:', await res.text());
    }

    static async _syncActivityInventory(activityId, inventoryString, category = null) {
        await SupabaseClient.delete('activity_required_items', `?activity_id=eq.${activityId}`);

        const items = InventoryService.parseInventoryString(inventoryString);
        if (items.length === 0) return;

        const names = items.map(i => i.name);
        // Fetch existing inventory by name
        const invRes = await SupabaseClient.get(
            'inventory',
            `?name=in.(${names.map(n => `"${n}"`).join(',')})`
        );
        if (!invRes.ok) {
            console.error('[DataService] Sync Inventory fetch failed:', await invRes.text());
            return;
        }
        const inventory = await invRes.json();

        const junctionRows = [];
        for (const item of items) {
            let match = inventory.find(inv => inv.name.toLowerCase() === item.name.toLowerCase());
            
            if (match) {
                junctionRows.push({
                    activity_id: activityId,
                    inventory_id: match.id,
                    quantity_needed: item.quantity ? parseInt(item.quantity, 10) || 0 : 0,
                    not_availible_text: null
                });
            } else {
                // Not in inventory - store as text in the new column
                junctionRows.push({
                    activity_id: activityId,
                    inventory_id: null,
                    quantity_needed: item.quantity ? parseInt(item.quantity, 10) || 0 : 0,
                    placeholder_text: item.name
                });
            }
        }

        if (junctionRows.length > 0) {
            const res = await SupabaseClient.post('activity_required_items', junctionRows);
            if (!res.ok) console.error('[DataService] Sync ActivityInventory failed:', await res.text());
        }
    }

    /**
     * Automatically links activity requirement placeholders (placeholder_text)
     * to real inventory items once they are created.
     */
    static async _reconcileMissingRequiredItems() {
        try {
            // 1. Find all required items that are still just text
            const res = await SupabaseClient.get('activity_required_items', '?placeholder_text=not.is.null');
            if (!res.ok) return;
            const missing = await res.json();
            if (missing.length === 0) return;

            // 2. Get all inventory to match against
            const invRes = await SupabaseClient.get('inventory', '?select=id,name');
            if (!invRes.ok) return;
            const inventory = await invRes.json();

            // 3. Match unique missing names against inventory
            const uniqueNames = [...new Set(missing.map(m => m.placeholder_text))];
            for (const name of uniqueNames) {
                const match = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());
                if (match) {
                    // Update all rows that used this placeholder string
                    await SupabaseClient.patch(
                        'activity_required_items',
                        `?placeholder_text=eq.${encodeURIComponent(name)}`,
                        {
                            inventory_id: match.id,
                            placeholder_text: null
                        }
                    );
                }
            }
        } catch (e) {
            console.warn('[DataService] Reconciliation failed:', e);
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

    static async _checkConcurrentEdits(tableId, rows) {
        const { supaTable, category } = this._resolveTable(tableId);

        const ids = rows.map(r => r.id || (r.toJSON ? r.toJSON().id : null)).filter(Boolean);
        if (ids.length === 0) return;

        let query = `?select=id,updated_at&id=in.(${ids.join(',')})`;
        if (supaTable === 'activities' && category) {
            query += `&category=eq.${category}`;
        } else if (supaTable === 'sport_venues' && category) {
            query += `&sport_type=eq.${category}`;
        }

        try {
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
                // Non-blocking warning instead of throwing error
                console.warn(`[DataService] Concurrent edits detected for ${conflicts.length} row(s). Overwriting with local version.`);
                // Continue with save - don't block user
            }
        } catch (error) {
            if (error instanceof DataAccessError && error.isRetriable()) {
                console.warn('[DataService] Concurrent edit check failed (retriable), continuing with save:', error.message);
            } else {
                console.error('[DataService] Concurrent edit check failed:', error);
            }
            // Don't block save on error
        }
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
}
