import { SupabaseClient } from './SupabaseClient.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';
import { RepositoryFactory } from './repositories/RepositoryFactory.js';
import { TABLE_NAMES, TABLE_PREFIXES } from '../core/Constants.js';

/**
 * DataService - Standardized Data Access Layer.
 * Completely metadata-driven. Resolves logical UI IDs to physical DB tables.
 */
export class DataService {

    /**
     * Resolves metadata for a given logical table ID.
     * @private
     */
    static _resolve(tableId) {
        const config = GlobalStateManager.getInstance().getTableConfig(tableId);
        
        if (config) {
            return {
                supaTable: config.t_physische_tabelle || tableId,
                category: config.t_kategorie_filter || null,
                config
            };
        }

        // Fallback: If no metadata exists, try to guess from prefix
        if (tableId.startsWith(TABLE_PREFIXES.TABLE)) {
            const stripped = tableId.substring(TABLE_PREFIXES.TABLE.length);
            // Check if 'pe_personen' or 'ak_aktivitaeten' was passed with tbl_ prefix
            if (Object.values(TABLE_NAMES).includes(stripped)) {
                return { supaTable: stripped, category: null };
            }
            // Check if a constant key was used (e.g. tbl_people -> pe_personen)
            const key = stripped.toUpperCase();
            if (TABLE_NAMES[key]) {
                return { supaTable: TABLE_NAMES[key], category: null };
            }
        }

        return { supaTable: tableId, category: null };
    }

    /**
     * Extracts the 2-letter prefix from a table name (e.g., 'ak' from 'ak_aktivitaeten').
     */
    static getPrefix(tableName) {
        if (!tableName || !tableName.includes('_')) return '';
        return tableName.split('_')[0];
    }

    // ── READ ───────────────────────────────────────────────────

    /**
     * Loads table definitions and field schemas.
     */
    static async loadTableDefinitions() {
        const query = `?select=*,${TABLE_NAMES.TABLE_FIELDS}(*)&order=t_reihenfolge.asc`;
        const res = await SupabaseClient.get(TABLE_NAMES.TABLES, query);
        
        if (!res.ok) throw new Error(`Metadata load failed: ${res.status}`);
        
        const data = await res.json();
        return data.map(table => ({
            ...table,
            id: table.t_id,
            title: table.t_titel,
            schema: (table[TABLE_NAMES.TABLE_FIELDS] || [])
                .sort((a, b) => a.tf_reihenfolge - b.tf_reihenfolge)
                .map(col => ({
                    id: col.tf_feldname,
                    label: col.tf_label,
                    type: col.tf_datentyp,
                    ui_component: col.tf_ui_komponente,
                    hidden: !col.tf_ist_sichtbar,
                    editable: col.tf_ist_editierbar,
                    ...(col.tf_konfiguration || {})
                }))
        }));
    }

    /**
     * Load rows for a logical table ID.
     */
    static async loadRows(tableId) {
        const gs = GlobalStateManager.getInstance();
        const { supaTable, category } = this._resolve(tableId);
        const prefix = this.getPrefix(supaTable);

        // Standard dynamic select with relations
        let select = '*';
        if (supaTable === TABLE_NAMES.PEOPLE) {
            select = `*,${TABLE_NAMES.PERSON_TEAMS}(pt_tm_id, ${TABLE_NAMES.TEAMS}(tm_name))`;
        } else if (supaTable === TABLE_NAMES.ACTIVITIES) {
            select = `*,${TABLE_NAMES.ACTIVITY_REQUIRED_ITEMS}(*,${TABLE_NAMES.INVENTORY}(in_name)),${TABLE_NAMES.STANDORTE}(*)`;
        } else if (supaTable === TABLE_NAMES.EVENTS) {
            select = `*,${TABLE_NAMES.STANDORTE}(*),${TABLE_NAMES.EVENT_POINTS}(*)`;
        } else if (supaTable === TABLE_NAMES.SPORT_VENUES) {
            select = `*,${TABLE_NAMES.STANDORTE}(*)`;
        }

        let query = `?select=${select}`;
        
        // Apply category filter if defined in metadata
        if (category && prefix) {
            const filterCol = this._getCategoryColumn(supaTable);
            if (filterCol) query += `&${filterCol}=eq.${category}`;
        }

        const res = await SupabaseClient.get(supaTable, query);
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Load failed for ${supaTable}: ${err}`);
        }

        const rows = await res.json();
        
        // Apply Row Mapper (Repo)
        const repo = RepositoryFactory.getRepository(supaTable);
        return rows.map(r => repo ? repo.fromDb(r) : r);
    }

    // ── WRITE ──────────────────────────────────────────────────

    /**
     * Standardized save operation.
     */
    static async saveTable(tableId, _filename, rows, deletedIds = []) {
        const { supaTable, category } = this._resolve(tableId);
        const repo = RepositoryFactory.getRepository(supaTable);
        const prefix = this.getPrefix(supaTable);

        // 1. Map to DB format
        const dbRows = rows.map(row => {
            const plain = row.toJSON ? row.toJSON() : row;
            return repo ? repo.toDb(plain, category) : plain;
        });

        // 2. Handle Deletions
        if (deletedIds?.length > 0) {
            const pk = `${prefix}_id`;
            await SupabaseClient.delete(supaTable, `?${pk}=in.(${deletedIds.map(id => `"${id}"`).join(',')})`);
        }

        // 3. Handle Upsert
        if (dbRows.length > 0) {
            const res = await SupabaseClient.post(supaTable, dbRows, { 'Prefer': 'resolution=merge-duplicates' });
            if (!res.ok) throw new Error(`Save failed: ${await res.text()}`);

            // 4. Sync Junctions (People/Activities)
            await this._syncJunctions(supaTable, rows, dbRows, category);
        }

        await this.logAudit('SAVE', supaTable, { count: dbRows.length, category });
        return { success: true };
    }

    // ── HELPERS ───────────────────────────────────────────────

    static _getCategoryColumn(supaTable) {
        const prefix = this.getPrefix(supaTable);
        switch (supaTable) {
            case TABLE_NAMES.ACTIVITIES: return `${prefix}_kategorie`;
            case TABLE_NAMES.INVENTORY: return `${prefix}_kategorie`;
            case TABLE_NAMES.SPORT_VENUES: return `${prefix}_typ`;
            case TABLE_NAMES.EVENTS: return `${prefix}_kategorie`;
            default: return null;
        }
    }

    static async _syncJunctions(supaTable, rows, dbRows, category) {
        for (let i = 0; i < rows.length; i++) {
            const plain = rows[i].toJSON ? rows[i].toJSON() : rows[i];
            const id = dbRows[i].id || plain.id;

            if (supaTable === TABLE_NAMES.PEOPLE) {
                if (plain.Team !== undefined) await this._syncPersonTeams(id, plain.Team);
            } else if (supaTable === TABLE_NAMES.ACTIVITIES && plain.required_items !== undefined) {
                await this._syncActivityInventory(id, plain.required_items);
            } else if (supaTable === TABLE_NAMES.EVENTS && plain.reihenfolge !== undefined) {
                await this._syncEventPoints(id, plain.reihenfolge);
            }
        }
    }

    static async logAudit(action, tableName, details) {
        try {
            const gs = GlobalStateManager.getInstance();
            const payload = {
                al_aktion: action,
                al_tabelle: tableName,
                al_nutzer: gs.getCurrentUser() || 'System',
                al_details: JSON.stringify(details),
                al_erstellt_am: new Date().toISOString()
            };
            await SupabaseClient.post(TABLE_NAMES.AUDIT_LOGS, [payload]);
        } catch(e) {
            console.warn('[DataService] Audit logging failed:', e);
        }
    }

    static async _syncPersonTeams(personId, teamData) {
        await SupabaseClient.delete(TABLE_NAMES.PERSON_TEAMS, `?pt_pe_id=eq.${personId}`);
        if (!teamData || teamData === '—') return;
        
        const names = Array.isArray(teamData) 
            ? teamData.map(s => s.trim()).filter(Boolean)
            : teamData.split(',').map(s => s.trim()).filter(Boolean);
            
        if (names.length === 0) return;
        
        const teamsRes = await SupabaseClient.get(TABLE_NAMES.TEAMS, `?tm_name=in.(${names.map(n => `"${n}"`).join(',')})`);
        if (!teamsRes.ok) return;
        const teams = await teamsRes.json();
        const rows = teams.map(t => ({ pt_pe_id: personId, pt_tm_id: t.tm_id }));
        if (rows.length > 0) await SupabaseClient.post(TABLE_NAMES.PERSON_TEAMS, rows);
    }

    static async _syncActivityInventory(activityId, inventoryData) {
        await SupabaseClient.delete(TABLE_NAMES.ACTIVITY_REQUIRED_ITEMS, `?ab_ak_id=eq.${activityId}`);
        if (!inventoryData || inventoryData === '—') return;
        
        // Parse the inventory string (e.g. "Sessel (2), Tisch")
        const { InventoryService } = await import('./InventoryService.js');
        const items = InventoryService.parseInventoryString(inventoryData);
        
        if (items.length === 0) return;

        // Fetch actual inventory IDs to link
        const names = items.map(i => i.name);
        const invRes = await SupabaseClient.get(TABLE_NAMES.INVENTORY, `?in_name=in.(${names.map(n => `"${n}"`).join(',')})`);
        
        const inventoryRows = invRes.ok ? await invRes.json() : [];
        const dbRows = items.map(item => {
            const invRow = inventoryRows.find(ir => (ir.in_name || '').toLowerCase() === item.name.toLowerCase());
            return {
                ab_ak_id: activityId,
                ab_in_id: invRow ? invRow.in_id : null,
                ab_platzhalter: invRow ? null : item.name,
                ab_menge_noetig: parseInt(item.quantity, 10) || null
            };
        });

        if (dbRows.length > 0) {
            const res = await SupabaseClient.post(TABLE_NAMES.ACTIVITY_REQUIRED_ITEMS, dbRows);
            if (!res.ok) console.error('[DataService] Sync junction failed:', await res.text());
        }
    }

    static async _syncEventPoints(eventId, reihenfolgeData) {
        await SupabaseClient.delete(TABLE_NAMES.EVENT_POINTS, `?ep_ev_id=eq.${eventId}`);
        if (!reihenfolgeData || reihenfolgeData === '—' || reihenfolgeData === '[]') return;
        
        let items = [];
        try {
            items = typeof reihenfolgeData === 'string' ? JSON.parse(reihenfolgeData) : reihenfolgeData;
        } catch (e) { return; }
        
        if (!Array.isArray(items) || items.length === 0) return;
        
        const gs = GlobalStateManager.getInstance();
        const tables = gs.getTables();
        
        const dbRows = items.map((item, idx) => {
            // Try to find activity ID for ep_ak_id
            let akId = null;
            let spId = null;
            
            if (tables) {
                for (const [tid, info] of Object.entries(tables)) {
                    const row = info.instance?.rows.find(r => r.data.name === item.name);
                    if (row) {
                        if (tid.startsWith('tbl_activities') || tid === 'tbl_spiele') akId = row.id;
                        if (tid.startsWith('tbl_sport')) spId = row.id;
                        break;
                    }
                }
            }

            return {
                ep_ev_id: eventId,
                ep_reihenfolge: idx + 1,
                ep_titel: item.name,
                ep_pe_id: item.responsible || null,
                ep_ak_id: akId,
                ep_sp_id: spId,
                ep_erstellt_am: new Date().toISOString()
            };
        });
        
        if (dbRows.length > 0) {
            const res = await SupabaseClient.post(TABLE_NAMES.EVENT_POINTS, dbRows);
            if (!res.ok) console.error('[DataService] Sync event points failed:', await res.text());
        }
    }
}
