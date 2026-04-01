import { UserStatsService } from '../services/UserStatsService.js';
import { SUPABASE_CONFIG } from '../config.js';

/**
 * GlobalStateManager - Singleton managing application-wide state.
 * Refactored to separate concerns while maintaining a central point of access.
 */
export class GlobalStateManager {
    static #instance = null;

    constructor() {
        if (GlobalStateManager.#instance) {
            return GlobalStateManager.#instance;
        }

        // State properties
        this.currentUser = 'user_1';
        this.userRole = 'user';
        this.permissions = { type: 'readonly', tables: [] };
        
        this.unsavedTables = new Set();
        this.inventory = [];
        this.favorites = new Set();
        this.favoritesFilterActive = false;
        
        this.callbacks = {
            onUnsavedChange: new Set()
        };

        GlobalStateManager.#instance = this;
    }

    static getInstance() {
        if (!GlobalStateManager.#instance) {
            new GlobalStateManager();
        }
        return GlobalStateManager.#instance;
    }

    // ── Authentication & Permissions ───────────────────────────

    setCurrentUser(user, role, permissions = null) {
        this.currentUser = user;
        this.userRole = role;
        this.permissions = permissions || this._getDefaultPermissions(role);
    }

    _getDefaultPermissions(role) {
        if (role === 'Admin' || role === 'Chef') return { type: 'all' };
        return { type: 'except_people' };
    }

    getCurrentUser() { return this.currentUser; }
    getUserRole() { return this.userRole; }
    getPermissions() { return this.permissions; }

    updatePermissionsFromStorage() {
        const authUser = localStorage.getItem('auth_user');
        if (!authUser) return;
        const permissionsMap = JSON.parse(localStorage.getItem('app_permissions_map') || '{}');
        this.permissions = permissionsMap[authUser] || { type: 'all' };
    }

    canView(tableId) {
        const perms = this.permissions;
        if (this.isSuperAdmin()) return true;
        if (!perms) return true;

        switch (perms.type) {
            case 'all': return true;
            case 'readonly':
            case 'specific':
                return Array.isArray(perms.tables) && perms.tables.includes(tableId);
            case 'except_people':
                return tableId !== 'people_table' && tableId !== 'tbl_people';
            case 'except_people_inventory':
                return !['people_table', 'tbl_people', 'tbl_inventory'].includes(tableId);
            case 'except_inventory':
                return tableId !== 'tbl_inventory';
            default: return true;
        }
    }

    canEdit(tableId) {
        const perms = this.permissions;
        if (this.isSuperAdmin()) return true;
        if (this.userRole === 'Admin' && (!perms || perms.type === 'all')) return true;
        if (!perms || perms.type === 'readonly') return false;

        switch (perms.type) {
            case 'all': return true;
            case 'specific':
                return Array.isArray(perms.tables) && perms.tables.includes(tableId);
            case 'except_people':
                return !['people_table', 'tbl_people'].includes(tableId);
            case 'except_people_inventory':
                return !['people_table', 'tbl_people', 'tbl_inventory'].includes(tableId);
            case 'except_inventory':
                return tableId !== 'tbl_inventory';
            default: return false;
        }
    }

    isSuperAdmin() {
        const user = this.getCurrentUser();
        return ['Elias Andrei', 'Andrei Elias', 'root'].includes(user);
    }

    canManageUsers() {
        if (this.isSuperAdmin()) return true;
        const p = this.permissions;
        return p && (p.managementAccess === 'stats_perms' || p.managementAccess === 'stats_only' || p.canManageUsers === true);
    }

    canSeeStats() {
        if (this.isSuperAdmin()) return true;
        const p = this.permissions;
        return p && (p.managementAccess === 'stats_only' || p.managementAccess === 'stats_perms' || p.canManageUsers === true);
    }

    canSeePermissions() {
        if (this.isSuperAdmin()) return true;
        return this.permissions?.managementAccess === 'stats_perms';
    }

    // ── Favorites Management ───────────────────────────────────

    setInitialFavorites(favoriteIds) {
        this.favorites = new Set(favoriteIds);
    }

    async toggleFavorite(rowId) {
        if (this.favorites.has(rowId)) {
            this.favorites.delete(rowId);
        } else {
            this.favorites.add(rowId);
        }

        try {
            await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_CONFIG.ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({
                    id: `favs_${this.getCurrentUser()}`,
                    rows: Array.from(this.favorites)
                })
            });
            await UserStatsService.recordFavoriteChange(this.getCurrentUser(), this.favorites.size);
        } catch (e) {
            console.error('[GlobalState] Failed to sync favorites:', e);
        }
    }

    isFavorite(rowId) { return this.favorites.has(rowId); }
    setFavoritesFilterActive(active) { this.favoritesFilterActive = active; }
    isFavoritesFilterActive() { return this.favoritesFilterActive; }

    // ── Unsaved Changes State ──────────────────────────────────

    markTableAsUnsaved(tableId) {
        this.unsavedTables.add(tableId);
        this._notifyUnsavedChange();
    }

    markTableAsSaved(tableId) {
        this.unsavedTables.delete(tableId);
        this._notifyUnsavedChange();
    }

    clearAllUnsaved() {
        this.unsavedTables.clear();
        this._notifyUnsavedChange();
    }

    hasUnsavedChanges() { return this.unsavedTables.size > 0; }
    getUnsavedTableIds() { return Array.from(this.unsavedTables); }

    onUnsavedChangeCallback(callback) {
        this.callbacks.onUnsavedChange.add(callback);
        return () => this.callbacks.onUnsavedChange.delete(callback);
    }

    _notifyUnsavedChange() {
        const hasUnsaved = this.hasUnsavedChanges();
        this.callbacks.onUnsavedChange.forEach(cb => cb(hasUnsaved));
    }

    // ── Data Cache ─────────────────────────────────────────────

    setInventory(data) { this.inventory = data; }
    getInventory() { return this.inventory; }
}
