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
    #enums = {}; // Stores Postgres enums fetched from Supabase
    #tables = {}; // Stores loaded Table instances
    #unsavedTableIds = new Set();
    #onUnsavedChange = null;
    #favoritesFilterActive = false;
    #editModeActive = localStorage.getItem('edit_mode_active') === 'true';
    #sessionNewGames = new Map(); // Track games created this session to prevent 'Deleted' status

    #tableConfigs = [];

    constructor() {
        if (GlobalStateManager.#instance) return GlobalStateManager.#instance;
        GlobalStateManager.#instance = this;
        document.body.classList.toggle('edit-mode-active', this.#editModeActive);
    }

    setTableConfigs(configs) { this.#tableConfigs = configs; }
    getTableConfig(id) { return this.#tableConfigs.find(c => c.id === id); }
    getAllTableConfigs() { return this.#tableConfigs; }

    setTables(tables) { this.#tables = tables; }
    getTables() { return this.#tables; }

    async saveTableConfigs() {
        if (!this.isEditModeActive()) return;
        try {
            const res = await SupabaseClient.patch('app_config', '?id=eq.tables_config', {
                config: this.#tableConfigs,
                updated_at: new Date().toISOString()
            });
            if (!res.ok) throw new Error('Konfiguration konnte nicht gespeichert werden');
            this.showFlashMessage('Tabellen-Konfiguration global gespeichert!', 'success');
        } catch (e) {
            console.error('[GlobalStateManager] Config save failed:', e);
            this.showFlashMessage(`Speicherfehler: ${e.message}`, 'error');
        }
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

    setCurrentRole(role) { this.#currentRole = role; }

    setPermissions(perms) { this.#permissions = perms; }

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
     * Right to view Audit Logs.
     */
    canViewLogs() {
        const context = { role: this.#currentRole, permissions: this.#permissions };
        return PermissionService.canViewLogs(context);
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

    /**
     * Fetches all Postgres Enum types from Supabase via RPC.
     * This ensures the UI is always in sync with the database schema.
     */
    async loadGlobalEnums() {
        try {
            // Attempt to call the 'get_all_enums' RPC function
            const res = await SupabaseClient.post('rpc/get_all_enums', {});
            if (res.ok) {
                this.#enums = await res.json();
                console.log('[GlobalStateManager] Global Enums loaded:', Object.keys(this.#enums));
            } else {
                console.warn('[GlobalStateManager] Failed to load enums (RPC might not exist). Falling back to JSON defaults.');
            }
        } catch (e) {
            console.error('[GlobalStateManager] Enum fetch failed:', e);
        }
    }

    /**
     * Returns the options for a specific enum type, or null if not found.
     */
    getEnums() { return this.#enums; }

    getEnumOptions(enumName) {
        return this.#enums[enumName] || null;
    }

    /**
     * Attempts to find a matching enum for a given column ID by checking common naming patterns.
     */
    getEnumOptionsForColumn(colId, tableId) {
        const id = colId.toLowerCase();

        // Match specific common mappings
        if (id === 'status') {
            if (tableId === 'tbl_people') return this.getEnumOptions('status_enum');
            return this.getEnumOptions('task_status_enum');
        }
        if (id === 'role' || id === 'rolle') return this.getEnumOptions('rolle_enum');
        if (id === 'location' || id === 'ort') return this.getEnumOptions('location_enum');
        if (id === 'category' || id === 'kategorie') return this.getEnumOptions('activity_category_enum');
        if (id === 'condition' || id === 'zustand') return this.getEnumOptions('condition_enum');
        if (id === 'type' || id === 'typ') return this.getEnumOptions('venue_type_enum') || this.getEnumOptions('sport_type_enum');
        if (id === 'indoor_outdoor') return this.getEnumOptions('indoor_outdoor_enum');

        return null;
    }

    /**
     * Adds a new option to a Postgres Enum type. (Edit Mode ONLY)
     */
    async addEnumOption(enumName, newValue) {
        if (!this.isEditModeActive()) return;
        try {
            const res = await SupabaseClient.post('rpc/add_enum_value', {
                t_name: enumName,
                new_value: newValue
            });
            if (res.ok) {
                // Refresh our local cache
                await this.loadGlobalEnums();
            } else {
                const txt = await res.text();
                throw new Error(txt);
            }
        } catch (e) {
            console.error('[GlobalStateManager] Add enum option failed:', e);
            throw e;
        }
    }

    #onFlashMessage = null;

    showFlashMessage(message, type = 'success') {
        if (this.#onFlashMessage) {
            this.#onFlashMessage(message, type);
        } else {
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }

    onFlashMessageCallback(cb) { this.#onFlashMessage = cb; }

    /**
     * Adds a new column to a physical table.
     */
    async addColumn(tableId, colData) {
        if (!this.isEditModeActive()) return;
        const { name, type, newEnum } = colData;

        try {
            const { DataService } = await import('../services/DataService.js');
            const { supaTable } = DataService._resolveTable(tableId);

            // 1. Create New Enum if requested
            if (newEnum) {
                const resEnum = await SupabaseClient.post('rpc/create_enum_type', {
                    t_name: newEnum.name,
                    options: newEnum.options
                });
                if (!resEnum.ok) {
                    const err = await resEnum.json();
                    throw new Error(`Enum-Fehler: ${err.message}`);
                }
            }

            // 2. Type Mapping (Frontend -> Postgres)
            let pgType = type;
            if (pgType === 'number') pgType = 'numeric';
            if (pgType === 'int') pgType = 'integer';

            const res = await SupabaseClient.post('rpc/add_table_column', {
                t_name: supaTable,
                c_name: name,
                c_type: pgType
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Spalte konnte nicht hinzugefügt werden');
            }

            // Sync Table Config JSON
            const cfg = this.getTableConfig(tableId);
            if (cfg) {
                const newCol = { id: name, label: name, type: type === 'number' ? 'number' : (type === 'int' ? 'number' : type) };
                if (newEnum) newCol.type = 'enum'; // Or custom enum handling

                // Add before audit columns if they exist
                const auditIdx = cfg.schema.findIndex(c => c.id === 'createdBy' || c.id === 'createdAt');
                if (auditIdx !== -1) cfg.schema.splice(auditIdx, 0, newCol);
                else cfg.schema.push(newCol);

                await this.saveTableConfigs();
            }

            this.showFlashMessage(`Spalte '${name}' wurde zu '${supaTable}' hinzugefügt!`, 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            console.error('[GlobalStateManager] Add column failed:', e);
            this.showFlashMessage(e.message, 'error');
            throw e;
        }
    }

    /**
     * Removes a column from a physical table.
     */
    async removeColumn(tableId, colId) {
        if (!this.isEditModeActive()) return;
        try {
            const { DataService } = await import('../services/DataService.js');
            const { supaTable } = DataService._resolveTable(tableId);

            const res = await SupabaseClient.post('rpc/remove_table_column', {
                t_name: supaTable,
                c_name: colId
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Spalte konnte nicht gelöscht werden');
            }

            // Sync Table Config JSON
            const cfg = this.getTableConfig(tableId);
            if (cfg) {
                cfg.schema = cfg.schema.filter(c => c.id !== colId);
                await this.saveTableConfigs();
            }

            this.showFlashMessage(`Spalte '${colId}' wurde aus '${supaTable}' gelöscht.`, 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            console.error('[GlobalStateManager] Remove column failed:', e);
            this.showFlashMessage(e.message, 'error');
            throw e;
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

    setEditModeActive(active) {
        this.#editModeActive = active;
        document.body.classList.toggle('edit-mode-active', active);
        localStorage.setItem('edit_mode_active', active);
    }
    isEditModeActive() { return this.#editModeActive; }

    trackSessionGame(name, categoryLabel) {
        this.#sessionNewGames.set(name, categoryLabel);
    }

    getSessionGameCategory(name) {
        return this.#sessionNewGames.get(name);
    }
}
