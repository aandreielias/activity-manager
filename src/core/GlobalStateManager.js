/**
 * GlobalStateManager - Manages global application state (unsaved changes, etc.)
 */
export class GlobalStateManager {
    static #instance = null;

    constructor() {
        if (GlobalStateManager.#instance) {
            return GlobalStateManager.#instance;
        }

        this.unsavedTables = new Set();
        this.inventory = [];
        this.favorites = new Set(); // Row IDs
        this.favoritesFilterActive = false;
        this.callbacks = {
            onUnsavedChange: new Set()
        };

        GlobalStateManager.#instance = this;
    }

    setInitialFavorites(favoriteIds) {
        this.favorites = new Set(favoriteIds);
    }

    async toggleFavorite(rowId) {
        if (this.favorites.has(rowId)) {
            this.favorites.delete(rowId);
        } else {
            this.favorites.add(rowId);
        }

        // Save immediately to server
        try {
            await fetch('/api/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: this.getCurrentUser(), 
                    favoriteIds: Array.from(this.favorites) 
                })
            });
        } catch (e) {
            console.error('Failed to sync favorites:', e);
        }
    }

    isFavorite(rowId) {
        return this.favorites.has(rowId);
    }

    setFavoritesFilterActive(active) {
        this.favoritesFilterActive = active;
    }

    isFavoritesFilterActive() {
        return this.favoritesFilterActive;
    }

    static getInstance() {
        if (!GlobalStateManager.#instance) {
            GlobalStateManager.#instance = new GlobalStateManager();
        }
        return GlobalStateManager.#instance;
    }

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

    hasUnsavedChanges() {
        return this.unsavedTables.size > 0;
    }

    getUnsavedTableIds() {
        return Array.from(this.unsavedTables);
    }

    onUnsavedChangeCallback(callback) {
        this.callbacks.onUnsavedChange.add(callback);
        // Return an unregister function just in case
        return () => this.callbacks.onUnsavedChange.delete(callback);
    }

    _notifyUnsavedChange() {
        const hasUnsaved = this.hasUnsavedChanges();
        this.callbacks.onUnsavedChange.forEach(cb => cb(hasUnsaved));
    }

    setCurrentUser(user, role, permissions = null) {
        this.currentUser = user;
        this.userRole = role;
        this.permissions = permissions || { type: role === 'Admin' ? 'all' : (role === 'Chef' ? 'all' : 'except_people') };
    }

    getCurrentUser() {
        return this.currentUser || 'user_1';
    }

    getUserRole() {
        return this.userRole || 'user';
    }

    canView(tableId) {
        const perms = this.permissions;
        if (perms && perms.type === 'all') return true;

        const role = this.getUserRole();
        // Admins can view everything unless they have explicit restricted permissions (for testing/specific roles)
        if (role === 'Admin' && (!perms || perms.type === 'all')) return true;
        
        if (!perms) return true; // Default view all

        if (perms.type === 'readonly' || perms.type === 'specific') {
            if (!Array.isArray(perms.tables)) return false; 
            return perms.tables.includes(tableId);
        }

        if (perms.type === 'except_people') {
            return tableId !== 'people_table' && tableId !== 'tbl_people';
        }
        if (perms.type === 'except_people_inventory') {
            return tableId !== 'people_table' && tableId !== 'tbl_people' && tableId !== 'tbl_inventory';
        }
        if (perms.type === 'except_inventory') {
            return tableId !== 'tbl_inventory';
        }

        return true;
    }

    canEdit(tableId) {
        const perms = this.permissions;
        
        // Admin role bypasses unless a specific restriction like 'readonly' or 'specific' is active
        const role = this.getUserRole();
        if (role === 'Admin' && (!perms || perms.type === 'all')) return true;

        if (!perms) return false;
        if (perms.type === 'all') return true;
        if (perms.type === 'readonly') return false;
        
        if (perms.type === 'specific') {
            return Array.isArray(perms.tables) && perms.tables.includes(tableId);
        }

        if (perms.type === 'except_people') {
            return tableId !== 'people_table' && tableId !== 'tbl_people';
        }
        if (perms.type === 'except_people_inventory') {
            return tableId !== 'people_table' && tableId !== 'tbl_people' && tableId !== 'tbl_inventory';
        }
        if (perms.type === 'except_inventory') {
            return tableId !== 'tbl_inventory';
        }

        return false;
    }

    setPermissions(permissions) {
        this.permissions = permissions;
    }

    getPermissions() {
        return this.permissions;
    }

    setInventory(data) {
        this.inventory = data;
    }

    getInventory() {
        return this.inventory;
    }
}
