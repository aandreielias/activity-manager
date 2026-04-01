import { SUPABASE_CONFIG } from '../config.js';
import { UserStatsService } from './UserStatsService.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';

/**
 * AuthService — Authentication against the relational `users` table.
 */
export class AuthService {

    static _headers(extra = {}) {
        return {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_CONFIG.ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
            ...extra,
        };
    }

    static _url(query = '') {
        return `${SUPABASE_CONFIG.URL}/rest/v1/users${query}`;
    }

    /**
     * Authenticate or register a user.
     * - If the user does not exist in the `users` table, create a new row.
     * - If the user exists, validate the password.
     */
    static async authenticate(username, password) {
        try {
            // Look up user by username
            const res = await fetch(this._url(`?username=eq.${encodeURIComponent(username)}&select=*`), {
                headers: this._headers(),
            });

            if (!res.ok) throw new Error('Verbindung zu Supabase fehlgeschlagen');
            const rows = await res.json();

            if (rows.length === 0) {
                // Register new user
                const insertRes = await fetch(this._url(), {
                    method: 'POST',
                    headers: this._headers({ 'Prefer': 'return=representation' }),
                    body: JSON.stringify({
                        username,
                        password_hash: password, // In production, hash this!
                        role: 'user',
                    }),
                });

                if (!insertRes.ok) {
                    const txt = await insertRes.text();
                    throw new Error(`Registrierung fehlgeschlagen: ${txt}`);
                }

                const newUser = (await insertRes.json())[0];
                await UserStatsService.recordLogin(newUser.id, username);
                return { success: true, username, userId: newUser.id, role: 'user' };
            }

            const user = rows[0];

            // Validate password
            if (user.password_hash !== password) {
                throw new Error('Ungültiges Passwort');
            }

            await UserStatsService.recordLogin(user.id, username);
            return { success: true, username, userId: user.id, role: user.role || 'user' };

        } catch (error) {
            console.error('[AuthService] Login failed:', error);
            throw error;
        }
    }

    /**
     * Get user record by username.
     */
    static async getUserByUsername(username) {
        const res = await fetch(this._url(`?username=eq.${encodeURIComponent(username)}&select=*`), {
            headers: this._headers(),
        });
        if (!res.ok) return null;
        const rows = await res.json();
        return rows[0] || null;
    }

    /**
     * Change password for a user.
     */
    static async changePassword(username, newPassword) {
        try {
            const res = await fetch(this._url(`?username=eq.${encodeURIComponent(username)}`), {
                method: 'PATCH',
                headers: this._headers(),
                body: JSON.stringify({
                    password_hash: newPassword,
                    password_last_changed: new Date().toISOString(),
                }),
            });

            if (!res.ok) throw new Error('Passwort-Änderung fehlgeschlagen');

            // Also record in stats
            const user = await this.getUserByUsername(username);
            if (user) {
                await UserStatsService.recordPasswordChange(user.id);
            }

            return { success: true };
        } catch (error) {
            console.error('[AuthService] Password change failed:', error);
            throw error;
        }
    }

    /**
     * Save/Update permissions for a specific user.
     * Uses localStorage for now (same as before).
     */
    static savePermissions(targetUsername, permissions) {
        const permissionsMap = JSON.parse(localStorage.getItem('app_permissions_map') || '{}');
        permissionsMap[targetUsername] = permissions;
        localStorage.setItem('app_permissions_map', JSON.stringify(permissionsMap));

        if (GlobalStateManager.getInstance().getCurrentUser() === targetUsername) {
            GlobalStateManager.getInstance().setPermissions(permissions);
        }
    }
}
