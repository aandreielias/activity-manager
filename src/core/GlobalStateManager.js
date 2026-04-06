import { PermissionService } from '../services/PermissionService.js';
import { SupabaseClient } from '../services/SupabaseClient.js';

/**
 * GlobalStateManager - Standardized state management.
 * Follows the Singleton pattern to ensure a consistent application state.
 */
export class GlobalStateManager {
    static #instance = null;

    #currentUser = null;
    #currentRole = null;
    #currentUserId = null;
    #permissions = null;
    #favorites = [];
    #inventory = [];
    #unsavedTableIds = new Set();
    #onUnsavedChange = null;
    #favoritesFilterActive = false;

    constructor() {
        if (GlobalStateManager.#instance) return GlobalStateManager.#instance;
        GlobalStateManager.#instance = this;
    }

    static getInstance() {
        if (!GlobalStateManager.#instance) {
            GlobalStateManager.#instance = new GlobalStateManager();
        }
        return GlobalStateManager.#instance;
    }

    // ── Authentication & Permissions ───────────────────────────

    setCurrentUser(username, role, permissions = null) {
        this.#currentUser = username;
        this.#currentRole = role;
        this.#permissions = permissions || PermissionService.getDefaultPermissions();
    }

    setCurrentUserId(id) { this.#currentUserId = id; }
    getCurrentUserId() { return this.#currentUserId; }
    getCurrentUser() { return this.#currentUser; }
    getCurrentRole() { return this.#currentRole; }

    isSuperAdmin() { return (this.#currentRole || '').toLowerCase() === 'superadmin'; }
    isAdmin() { return (this.#currentRole || '').toLowerCase() === 'admin'; }

    /**
     * Determines if the current user can view a specific table.
     */
    canView(tableId) {
        const context = { role: this.#currentRole, permissions: this.#permissions };
        return PermissionService.canViewTable(tableId, context);
    }

    /**
     * Determines if the current user can edit a specific table.
     */
    canEdit(tableId) {
        const context = { role: this.#currentRole, permissions: this.#permissions };
        return PermissionService.canEditTable(tableId, context);
    }

    /**
     * More granular column-level editing rights.
     */
    canEditColumn(tableId, colId) {
        if (this.isSuperAdmin()) return true;
        
        // Prevent editing of metadata columns
        if (colId === 'createdBy' || colId === 'createdAt') {
            return false;
        }

        // Check for specific role modification permission
        if ((tableId === 'tbl_people' || tableId === 'people_table') && colId === 'role') {
            const context = { role: this.#currentRole, permissions: this.#permissions };
            if (!PermissionService.canEditRoles(context)) return false;
        }

        return this.canEdit(tableId);
    }

    /**
     * Right to manage users/see stats.
     */
    canSeeStats() {
        const context = { role: this.#currentRole, permissions: this.#permissions };
        return PermissionService.canSeeStats(context);
    }

    /**
     * Right to manage permissions.
     */
    canManagePermissions() {
        const context = { role: this.#currentRole, permissions: this.#permissions };
        return PermissionService.canManagePermissions(context);
    }

    /**
     * Right to use the Edit Mode.
     */
    canUseEditMode() {
        const context = { role: this.#currentRole, permissions: this.#permissions };
        return PermissionService.canUseEditMode(context);
    }

    /**
     * Verifies if Edit Mode is applicable to a specific table for the current user.
     */
    canUseEditModeForTable(tableId) {
        const context = { role: this.#currentRole, permissions: this.#permissions };
        return PermissionService.canUseEditModeForTable(tableId, context);
    }

    updatePermissionsFromStorage() {
        const authUser = localStorage.getItem('auth_user');
        if (!authUser) return;
        const permissionsMap = JSON.parse(localStorage.getItem('app_permissions_map') || '{}');
        this.#permissions = permissionsMap[authUser] || PermissionService.getDefaultPermissions();
    }

    // ── Favorites Management ───────────────────────────────────

    async loadFavorites() {
        if (!this.#currentUserId) return;
        try {
            const res = await SupabaseClient.get('user_favorites', `?user_id=eq.${this.#currentUserId}`);
            if (res.ok) {
                const rows = await res.json();
                this.#favorites = rows.map(f => f.row_id);
            }
        } catch (e) {
            console.error('[GlobalStateManager] Load favorites failed:', e);
        }
    }

    async toggleFavorite(rowId) {
        if (!this.#currentUserId) return;
        const index = this.#favorites.indexOf(rowId);
        try {
            if (index === -1) {
                this.#favorites.push(rowId);
                await SupabaseClient.post('user_favorites', {
                    user_id: this.#currentUserId,
                    row_id: rowId
                });
            } else {
                this.#favorites.splice(index, 1);
                await SupabaseClient.delete('user_favorites', `?user_id=eq.${this.#currentUserId}&row_id=eq.${rowId}`);
            }
        } catch (e) {
            console.error('[GlobalStateManager] Toggle favorite failed:', e);
        }
    }

    isFavorite(rowId) { return this.#favorites.includes(rowId); }

    setFavoritesFilterActive(active) { this.#favoritesFilterActive = active; }
    isFavoritesFilterActive() { return this.#favoritesFilterActive; }

    // ── Unsaved Changes Tracking ──────────────────────────────

    markTableAsUnsaved(tableId) {
        this.#unsavedTableIds.add(tableId);
        this.#notifyUnsavedChange();
    }

    markTableAsSaved(tableId) {
        this.#unsavedTableIds.delete(tableId);
        this.#notifyUnsavedChange();
    }

    clearAllUnsaved() {
        this.#unsavedTableIds.clear();
        this.#notifyUnsavedChange();
    }

    getUnsavedTableIds() { return [...this.#unsavedTableIds]; }

    onUnsavedChangeCallback(cb) { this.#onUnsavedChange = cb; }

    #notifyUnsavedChange() {
        if (this.#onUnsavedChange) {
            this.#onUnsavedChange(this.#unsavedTableIds.size > 0);
        }
    }

    // ── Inventory State ────────────────────────────────────────

    setInventory(data) { this.#inventory = data; }
    getInventory() { return this.#inventory; }

    // ── Edit Mode ─────────────────────────────────────────────

    #editModeActive = false;
    setEditModeActive(active) { this.#editModeActive = active; }
    isEditModeActive() { return this.#editModeActive; }
}
