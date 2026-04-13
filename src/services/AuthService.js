import { SupabaseClient } from './SupabaseClient.js';
import { UserStatsService } from './UserStatsService.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';

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
        const res = await SupabaseClient.get('users', `?username=eq.${encodeURIComponent(username)}&select=*`);
        if (!res.ok) throw new Error('Verbindung zu Supabase fehlgeschlagen');

        const rows = await res.json();

        if (rows.length === 0) {
            // Register new user
            const insertRes = await SupabaseClient.post('users', {
                username,
                password_hash: password,
                role: 'User',
                permissions: null
            }, { 'Prefer': 'return=representation' });

            if (!insertRes.ok) {
                const txt = await insertRes.text();
                throw new Error(`Registrierung fehlgeschlagen: ${txt}`);
            }

            const newUser = (await insertRes.json())[0];
            await UserStatsService.recordLogin(newUser.id);
            return { success: true, username, userId: newUser.id, role: 'User', permissions: null, personId: newUser.person_id };
        }

        const user = rows[0];

        if (user.password_hash !== password) {
            throw new Error('Ungültiges Passwort');
        }

        await UserStatsService.recordLogin(user.id);
        return { 
            success: true, 
            username, 
            userId: user.id, 
            role: user.role || 'User',
            permissions: user.permissions || null,
            personId: user.person_id
        };
    }

    /**
     * Get user record by username.
     */
    static async getUserByUsername(username) {
        const res = await SupabaseClient.get('users', `?username=eq.${encodeURIComponent(username)}&select=*`);
        if (!res.ok) return null;
        const rows = await res.json();
        return rows[0] || null;
    }

    /**
     * Change password for a user.
     */
    static async changePassword(username, newPassword) {
        const res = await SupabaseClient.patch(
            'users',
            `?username=eq.${encodeURIComponent(username)}`,
            { password_hash: newPassword, password_last_changed: new Date().toISOString() }
        );

        if (!res.ok) throw new Error('Passwort-Änderung fehlgeschlagen');
        return { success: true };
    }

    /**
     * Save/Update permissions for a specific user.
     * Persists to Supabase for global synchronization.
     */
    static async savePermissions(targetUsername, permissions) {
        // 1. Local fallback (optional, for immediate feedback if needed)
        const permissionsMap = JSON.parse(localStorage.getItem('app_permissions_map') || '{}');
        permissionsMap[targetUsername] = permissions;
        localStorage.setItem('app_permissions_map', JSON.stringify(permissionsMap));

        // 2. Persist to Supabase
        try {
            const res = await SupabaseClient.patch(
                'users',
                `?username=eq.${encodeURIComponent(targetUsername)}`,
                { permissions: permissions }
            );

            if (!res.ok) {
                console.warn('[AuthService] Supabase patch for permissions failed. Column might be missing or network error.');
            }
        } catch (e) {
            console.error('[AuthService] Global permission save failed:', e);
        }

        const globalState = GlobalStateManager.getInstance();
        if (globalState.getCurrentUser() === targetUsername) {
            globalState.setPermissions(permissions);
        }
    }
}
