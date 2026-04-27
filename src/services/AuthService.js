import { SupabaseClient } from './SupabaseClient.js';
import { UserStatsService } from './UserStatsService.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';
import { TABLE_NAMES } from '../core/Constants.js';

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
        const res = await SupabaseClient.get(TABLE_NAMES.USERS, `?nu_nutzername=eq.${encodeURIComponent(username)}&select=*,${TABLE_NAMES.PEOPLE}(pe_id)`);
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
            return { success: true, username, userId: newUser.nu_id, personId: newUser.nu_pe_id, teams: [] };
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
        
        await UserStatsService.recordLogin(user.nu_id);
        return { 
            success: true, 
            username, 
            userId: user.nu_id, 
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
        const res = await SupabaseClient.get(TABLE_NAMES.USERS, `?nu_nutzername=eq.${encodeURIComponent(username)}`);
        if (!res.ok) return null;
        const rows = await res.json();
        if (rows.length === 0) return null;
        
        return rows[0];
    }

    /**
     * Get user record by person_id.
     */
    static async getUserByPersonId(personId) {
        if (!personId) return null;
        const res = await SupabaseClient.get(TABLE_NAMES.USERS, `?nu_pe_id=eq.${personId}`);
        if (!res.ok) return null;
        const rows = await res.json();
        if (rows.length === 0) return null;

        return rows[0];
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


}
