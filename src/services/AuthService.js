import { SUPABASE_CONFIG } from '../config.js';
import { UserStatsService } from './UserStatsService.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';

/**
 * AuthService - Handles user authentication, registration, permissions, and roles.
 * Provides a clean interface for UI components to interact with the auth system.
 */
export class AuthService {
    /**
     * Authenticate or register a user.
     * Starts by fetching current auth map from Supabase, then validating locally.
     */
    static async authenticate(username, password) {
        try {
            const authMap = await this._getAuthMap();
            
            // Register user if not exists (simplified app logic)
            if (!authMap[username]) {
                authMap[username] = password;
                await this._updateAuthMap(authMap);
            } else if (authMap[username] !== password) {
                throw new Error('Ungültiges Passwort');
            }

            // Sync user stats
            await UserStatsService.recordLogin(username);
            
            return { success: true, username, role: username === 'root' ? 'admin' : 'user' };
        } catch (error) {
            console.error('[AuthService] Login failed:', error);
            throw error;
        }
    }

    /**
     * Change password for the current user.
     */
    static async changePassword(username, newPassword) {
        try {
            const authMap = await this._getAuthMap();
            authMap[username] = newPassword;
            await this._updateAuthMap(authMap);
            await UserStatsService.recordPasswordChange(username);
            return { success: true };
        } catch (error) {
            console.error('[AuthService] Password change failed:', error);
            throw error;
        }
    }

    /**
     * Save/Update permissions for a specific user.
     * Persists to both localStorage (for immediate use) and Supabase (eventually).
     */
    static savePermissions(targetUsername, permissions) {
        const permissionsMap = JSON.parse(localStorage.getItem('app_permissions_map') || '{}');
        permissionsMap[targetUsername] = permissions;
        localStorage.setItem('app_permissions_map', JSON.stringify(permissionsMap));
        
        // For current user, update live state
        if (GlobalStateManager.getInstance().getCurrentUser() === targetUsername) {
            GlobalStateManager.getInstance().setPermissions(permissions);
        }
    }

    /**
     * Sync permissions to/from Supabase (To be implemented fully if needed).
     * Currently primarily uses localStorage for permissions to avoid excess DB calls.
     */
    static async syncPermissions() {
        // Placeholder for future Supabase sync
    }

    // ── Internal Helpers ───────────────────────────────────────

    static async _getAuthMap() {
        const res = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data?id=eq.app_auth&select=rows`, {
            headers: { 'apikey': SUPABASE_CONFIG.ANON_KEY, 'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}` }
        });
        if (!res.ok) return {};
        const data = await res.json();
        return data?.[0]?.rows || {};
    }

    static async _updateAuthMap(authMap) {
        await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_CONFIG.ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ id: 'app_auth', rows: authMap })
        });
    }
}
