import { SupabaseClient } from './SupabaseClient.js';
import { UserStatsService } from './UserStatsService.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';
import { TABLE_NAMES, ROLES } from '../core/Constants.js';

/**
 * AuthService — Authentication against the relational `users` table.
 */
export class AuthService {

    /**
     * Authenticate or register a user.
     * - If the user does not exist in the `users` table, create a new row.
     * - If the user exists, validate the password.
     */
    static async authenticate(username, password) {
        const res = await SupabaseClient.get(TABLE_NAMES.USERS, `?nu_nutzername=eq.${encodeURIComponent(username)}&select=*,${TABLE_NAMES.USER_PERMISSIONS}(*),${TABLE_NAMES.PEOPLE}(pe_rolle,pe_id)`);
        if (!res.ok) throw new Error('Verbindung zu Supabase fehlgeschlagen');

        const rows = await res.json();

        if (rows.length === 0) {
            // Register new user
            const insertRes = await SupabaseClient.post(TABLE_NAMES.USERS, {
                nu_nutzername: username,
                nu_passwort_hash: password
            }, { 'Prefer': 'return=representation' });

            if (!insertRes.ok) {
                const txt = await insertRes.text();
                throw new Error(`Registrierung fehlgeschlagen: ${txt}`);
            }

            const newUser = (await insertRes.json())[0];
            await UserStatsService.recordLogin(newUser.nu_id);
            return { success: true, username, userId: newUser.nu_id, role: ROLES.USER, permissions: { overwrites: {} }, personId: newUser.nu_pe_id, teams: [] };
        }

        const user = rows[0];
        
        // If the user was pre-created by an admin but has no password yet
        if (!user.nu_passwort_hash || user.nu_passwort_hash === '__UNSET__') {
            const updateRes = await SupabaseClient.patch(
                TABLE_NAMES.USERS,
                `?nu_id=eq.${user.nu_id}`,
                { nu_passwort_hash: password }
            );
            if (!updateRes.ok) throw new Error('Initiales Passwort konnte nicht gesetzt werden');
            user.nu_passwort_hash = password;
        }

        if (user.nu_passwort_hash !== password) {
            throw new Error('Ungültiges Passwort');
        }

        const teams = await this._fetchUserTeams(user.nu_pe_id);
        
        // Map normalized permissions to nested object for app compatibility
        const permissions = { overwrites: {} };
        (user[TABLE_NAMES.USER_PERMISSIONS] || []).forEach(p => {
            permissions.overwrites[p.nb_berechtigung_key] = parseInt(p.nb_zugriffslevel, 10) || 0;
        });

        await UserStatsService.recordLogin(user.nu_id);
        return { 
            success: true, 
            username, 
            userId: user.nu_id, 
            role: user[TABLE_NAMES.PEOPLE]?.pe_rolle || ROLES.USER,
            permissions: permissions || null,
            personId: user.nu_pe_id,
            teams
        };
    }

    /**
     * Fetch team names for a given person.
     */
    static async _fetchUserTeams(personId) {
        if (!personId) return [];
        const res = await SupabaseClient.get(TABLE_NAMES.PERSON_TEAMS, `?pt_pe_id=eq.${personId}&select=${TABLE_NAMES.TEAMS}(tm_name)`);
        if (!res.ok) return [];
        const rows = await res.json();
        return rows.map(r => r[TABLE_NAMES.TEAMS]?.tm_name).filter(Boolean);
    }

    /**
     * Get user record by username.
     */
    static async getUserByUsername(username) {
        const res = await SupabaseClient.get(TABLE_NAMES.USERS, `?nu_nutzername=eq.${encodeURIComponent(username)}&select=*,${TABLE_NAMES.USER_PERMISSIONS}(*)`);
        if (!res.ok) return null;
        const rows = await res.json();
        if (rows.length === 0) return null;
        
        const user = rows[0];
        const permissions = { overwrites: {} };
        (user[TABLE_NAMES.USER_PERMISSIONS] || []).forEach(p => {
            permissions.overwrites[p.nb_berechtigung_key] = parseInt(p.nb_zugriffslevel, 10) || 0;
        });
        user.permissions = permissions;
        return user;
    }

    /**
     * Get user record by person_id.
     */
    static async getUserByPersonId(personId) {
        if (!personId) return null;
        const res = await SupabaseClient.get(TABLE_NAMES.USERS, `?nu_pe_id=eq.${personId}&select=*,${TABLE_NAMES.USER_PERMISSIONS}(*)`);
        if (!res.ok) return null;
        const rows = await res.json();
        if (rows.length === 0) return null;

        const user = rows[0];
        const permissions = { overwrites: {} };
        (user[TABLE_NAMES.USER_PERMISSIONS] || []).forEach(p => {
            permissions.overwrites[p.nb_berechtigung_key] = parseInt(p.nb_zugriffslevel, 10) || 0;
        });
        user.permissions = permissions;
        return user;
    }

    /**
     * Change password for a user.
     */
    static async changePassword(username, newPassword) {
        const res = await SupabaseClient.patch(
            TABLE_NAMES.USERS,
            `?nu_nutzername=eq.${encodeURIComponent(username)}`,
            { nu_passwort_hash: newPassword, nu_passwort_geaendert_am: new Date().toISOString() }
        );

        if (!res.ok) throw new Error('Passwort-Änderung fehlgeschlagen');
        return { success: true };
    }

    /**
     * Save/Update permissions for a specific user.
     * If the user does not exist, create a stub record.
     */
    static async savePermissions(targetUsername, permissions, personId = null) {
        // 1. Try to find user by person_id (most reliable link)
        let userRes = null;
        if (personId) {
            userRes = await SupabaseClient.get(TABLE_NAMES.USERS, `?nu_pe_id=eq.${personId}&select=nu_id,nu_nutzername`);
        }

        // 2. Fallback to username check if no person_id match found
        if (!userRes || !userRes.ok || (await userRes.clone().json()).length === 0) {
            userRes = await SupabaseClient.get(TABLE_NAMES.USERS, `?nu_nutzername=ilike.${encodeURIComponent(targetUsername)}&select=nu_id,nu_nutzername`);
        }

        const users = userRes.ok ? await userRes.json() : [];
        let userId;

        if (users.length > 0) {
            userId = users[0].nu_id;
        } else {
            // Create new record
            const res = await SupabaseClient.post(TABLE_NAMES.USERS, {
                nu_nutzername: targetUsername,
                nu_passwort_hash: '__UNSET__',
                nu_pe_id: personId
            }, { 'Prefer': 'return=representation' });
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(`Konnte Nutzer-Datensatz nicht anlegen: ${txt}`);
            }
            userId = (await res.json())[0].nu_id;
        }

        // 3. Sync permissions
        await SupabaseClient.delete(TABLE_NAMES.USER_PERMISSIONS, `?nb_nu_id=eq.${userId}`);
        
        // Invalidate users cache since it embeds permissions
        SupabaseClient.clearCache(); // Aggressive but safe for permission changes
        
        if (permissions && permissions.overwrites) {
            const permissionRows = Object.entries(permissions.overwrites)
                .filter(([_, level]) => level !== undefined && level !== -1 && level !== 'none')
                .map(([key, level]) => ({
                    nb_nu_id: userId,
                    nb_berechtigung_key: key,
                    nb_zugriffslevel: String(level)
                }));
            
            if (permissionRows.length > 0) {
                const res = await SupabaseClient.post(TABLE_NAMES.USER_PERMISSIONS, permissionRows);
                if (!res.ok) console.error('[AuthService] Failed to sync permissions:', await res.text());
            }
        }

        return { success: true };
    }
}
