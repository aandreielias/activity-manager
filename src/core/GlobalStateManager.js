import { SupabaseClient } from '../services/SupabaseClient.js';
import { ColourFactory } from '../utils/ColourFactory.js';
import { PermissionHub } from './PermissionHub.js';

/**
 * GlobalStateManager - Standardized state management.
 * Follows the Singleton pattern to ensure a consistent application state.
 */
export class GlobalStateManager {
    static #instance = null;

    #currentUser = null;
    #currentRole = null;
    #currentUserId = null;
    #currentUserImageUrl = null;
    #currentTeams = []; // Array of team names the current user belongs to
    #permissions = null;
    #favorites = [];
    #inventory = [];
    #enums = {}; // Stores Postgres enums fetched from Supabase
    #tables = {}; // Stores loaded Table instances
    #unsavedTableIds = new Set();
    #onUnsavedChange = null;
    #favoritesFilterActive = false;
    #sessionNewGames = new Map(); // Track games created this session to prevent 'Deleted' status
    #selectedRows = new Map(); // tableId -> Set([rowIds])
    #deletedRowIds = new Map(); // tableId -> Set([rowIds])
    #dirtyRowIds = new Map(); // tableId -> Set([rowIds])
    #onSelectionChange = null;

    #tableConfigs = [];
    #availableTeams = []; // Global list of all available teams in the system
    #currentViewId = null; // Currently active main view/category ID
    #globalFilters = {
        main: {}, // tableId -> { active, groupBy, filters }
        split: {} // tableId -> { active, groupBy, filters }
    };

    constructor() {
        if (GlobalStateManager.#instance) return GlobalStateManager.#instance;
        GlobalStateManager.#instance = this;
    }

    setTableConfigs(configs) { this.#tableConfigs = configs; }
    getTableConfig(id) { return this.#tableConfigs.find(c => c.id === id); }
    getAllTableConfigs() { return this.#tableConfigs; }

    setTables(tables) { this.#tables = tables; }
    getTables() { return this.#tables; }

    async saveTableConfigs() {
        // Edit mode is removed, but we might still want to save configs? 
        // For now, let's keep it disabled as per "fully remove edit mode".
        return; 
    }

    static getInstance() {
        if (!GlobalStateManager.#instance) {
            GlobalStateManager.#instance = new GlobalStateManager();
        }
        return GlobalStateManager.#instance;
    }

    setCurrentViewId(id) { this.#currentViewId = id; }
    getCurrentViewId() { return this.#currentViewId; }

    // ── Authentication & Permissions ───────────────────────────

    setCurrentUser(username, role, permissions = null, teams = [], imageUrl = null) {
        this.#currentUser = username;
        this.#currentRole = role || 'User';
        this.#currentTeams = Array.isArray(teams) ? teams : (typeof teams === 'string' ? teams.split(',').map(t => t.trim()) : []);
        this.#permissions = permissions || { overwrites: {} };
        this.#currentUserImageUrl = imageUrl;
    }

    setCurrentRole(role) { this.#currentRole = role; }
    setCurrentTeams(teams) { 
        this.#currentTeams = Array.isArray(teams) ? teams : (typeof teams === 'string' ? teams.split(',').map(t => t.trim()) : []); 
    }
    setPermissions(perms) { this.#permissions = perms; }

    setCurrentUserId(id) { this.#currentUserId = id; }
    getCurrentUserId() { return this.#currentUserId; }
    getCurrentUser() { return this.#currentUser; }
    getCurrentRole() { return this.#currentRole; }
    getCurrentTeams() { return this.#currentTeams; }
    getCurrentUserImageUrl() { return this.#currentUserImageUrl; }
    getPermissions() { return this.#permissions; }

    getRoleForTeam(teamName) {
        return 'User'; // Simplified for now
    }

    isSuperAdmin() { return (this.#currentRole || '').toLowerCase() === 'superadmin'; }
    isAdmin() { return (this.#currentRole || '').toLowerCase() === 'admin'; }

    getPermissionContext() {
        return {
            role: this.#currentRole,
            teams: this.#currentTeams,
            perms: this.#permissions
        };
    }

    canView(objectId) { 
        // Anonymous/Login Bypass: Allow reading people list only for the login screen
        if (!this.#currentUser && objectId === 'tbl_people') return true;
        
        return PermissionHub.canRead(this.getPermissionContext(), objectId); 
    }
    
    canEdit(objectId) { 
        return PermissionHub.canWrite(this.getPermissionContext(), objectId); 
    }

    canEditColumn(tableId, colId) {
        if (colId === 'createdBy' || colId === 'createdAt') return false;
        return PermissionHub.canWrite(this.getPermissionContext(), `col_${tableId}.${colId}`);
    }

    canSeeStats() { return PermissionHub.canRead(this.getPermissionContext(), 'btn_stats'); }
    canManagePermissions() { 
        return (this.isSuperAdmin() || this.isAdmin()); 
    }
    canUseEditMode() { return false; }
    canViewLogs() { return PermissionHub.canRead(this.getPermissionContext(), 'btn_audit_logs'); }
    canUseEditModeForTable(tableId) { return false; }

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

    async loadGlobalEnums() {
        try {
            const res = await SupabaseClient.post('rpc/get_all_enums', {});
            if (res.ok) this.#enums = await res.json();
        } catch (e) {
            console.error('[GlobalStateManager] Enum fetch failed:', e);
        }
    }

    getEnums() { return this.#enums; }
    getEnumOptions(enumName) { return this.#enums[enumName] || null; }

    async loadAvailableTeams() {
        try {
            const res = await SupabaseClient.get('teams', '?select=name,color&order=name.asc');
            if (res.ok) {
                const rows = await res.json();
                this.#availableTeams = rows.map(r => ({
                    name: r.name,
                    color: r.color || ColourFactory.getBrandBlue()
                }));
            }
        } catch (e) {
            console.error('[GlobalStateManager] Team load failed:', e);
        }
    }

    getAvailableTeams() {
        return this.#availableTeams.length > 0 ? this.#availableTeams : [{ name: 'Aktivitäten', color: ColourFactory.getBrandBlue() }];
    }

    getEnumOptionsForColumn(colId, tableId) {
        const id = colId.toLowerCase();
        if (id === 'status') {
            if (tableId && tableId.includes('people')) return this.getEnumOptions('status_enum');
            return this.getEnumOptions('activity_status') || this.getEnumOptions('task_status_enum');
        }
        if (id === 'role' || id === 'rolle') return this.getEnumOptions('app_role') || this.getEnumOptions('rolle_enum');
        if (id === 'location' || id === 'ort') return this.getEnumOptions('location_enum');
        if (id === 'category' || id === 'kategorie') {
            if (tableId && tableId.includes('activities')) return this.getEnumOptions('activity_category_enum');
            return null;
        }
        if (id === 'condition' || id === 'zustand') return this.getEnumOptions('inventory_condition') || this.getEnumOptions('condition_enum');
        if (id === 'type' || id === 'typ') return this.getEnumOptions('venue_type_enum') || this.getEnumOptions('sport_type_enum');
        if (id === 'indoor_outdoor') return this.getEnumOptions('indoor_outdoor_enum');
        return null;
    }

    async addEnumOption(enumName, newValue) {
        // Disabled for now as it was part of edit mode
        return;
    }

    #onFlashMessage = null;
    showFlashMessage(message, type = 'success') {
        if (this.#onFlashMessage) this.#onFlashMessage(message, type);
        else alert(`${type.toUpperCase()}: ${message}`);
    }
    onFlashMessageCallback(cb) { this.#onFlashMessage = cb; }

    async addColumn(tableId, colData) {
        // Disabled for now as it was part of edit mode
        return;
    }

    async toggleFavorite(rowId) {
        if (!this.#currentUserId) return;
        const index = this.#favorites.indexOf(rowId);
        try {
            if (index === -1) {
                this.#favorites.push(rowId);
                await SupabaseClient.post('user_favorites', { user_id: this.#currentUserId, row_id: rowId });
            } else {
                this.#favorites.splice(index, 1);
                await SupabaseClient.delete('user_favorites', `?user_id=eq.${this.#currentUserId}&row_id=eq.${rowId}`);
            }
        } catch (e) { console.error('[GlobalStateManager] Toggle favorite failed:', e); }
    }

    isFavorite(rowId) { return this.#favorites.includes(rowId); }
    setFavoritesFilterActive(active) { this.#favoritesFilterActive = active; }
    isFavoritesFilterActive() { return this.#favoritesFilterActive; }

    markTableAsUnsaved(tableId) { this.#unsavedTableIds.add(tableId); this.#notifyUnsavedChange(); }
    markTableAsSaved(tableId) { this.#unsavedTableIds.delete(tableId); this.#notifyUnsavedChange(); }
    clearAllUnsaved() { this.#unsavedTableIds.clear(); this.#deletedRowIds.clear(); this.#notifyUnsavedChange(); }
    getUnsavedTableIds() { return [...this.#unsavedTableIds]; }
    
    markRowAsDeleted(tableId, rowId) {
        if (!this.#deletedRowIds.has(tableId)) this.#deletedRowIds.set(tableId, new Set());
        this.#deletedRowIds.get(tableId).add(rowId);
    }
    getDeletedRowIds(tableId) {
        return Array.from(this.#deletedRowIds.get(tableId) || []);
    }
    clearDeletedRowIds(tableId) {
        this.#deletedRowIds.delete(tableId);
    }

    markRowAsDirty(tableId, rowId) {
        if (!this.#dirtyRowIds.has(tableId)) this.#dirtyRowIds.set(tableId, new Set());
        this.#dirtyRowIds.get(tableId).add(rowId);
    }
    isRowDirty(tableId, rowId) {
        return this.#dirtyRowIds.get(tableId)?.has(rowId) || false;
    }
    getDirtyRowIds(tableId) {
        return Array.from(this.#dirtyRowIds.get(tableId) || []);
    }
    clearDirtyRowIds(tableId) {
        this.#dirtyRowIds.delete(tableId);
    }

    onUnsavedChangeCallback(cb) { this.#onUnsavedChange = cb; }

    #notifyUnsavedChange() {
        if (this.#onUnsavedChange) this.#onUnsavedChange(this.#unsavedTableIds.size > 0);
    }

    setInventory(data) { this.#inventory = data; }
    getInventory() { return this.#inventory; }

    setEditModeActive(active) { /* Removed */ }
    isEditModeActive() { return false; }

    trackSessionGame(name, categoryLabel) { this.#sessionNewGames.set(name, categoryLabel); }
    getSessionGameCategory(name) { return this.#sessionNewGames.get(name); }

    getGlobalFilterState(side, tableId) {
        if (!this.#globalFilters[side][tableId]) {
            this.#globalFilters[side][tableId] = { active: false, groupBy: null, filters: [{ attrId: null, mode: null, value: [], quantityMode: 'any', quantityValue: '', availability: [] }] };
        }
        return this.#globalFilters[side][tableId];
    }
    setGlobalFilterState(side, tableId, state) { this.#globalFilters[side][tableId] = state; }

    isRowSelected(tableId, rowId) { return this.#selectedRows.get(tableId)?.has(rowId) || false; }
    toggleRowSelection(tableId, rowId, selected) {
        if (!this.#selectedRows.has(tableId)) this.#selectedRows.set(tableId, new Set());
        const set = this.#selectedRows.get(tableId);
        if (selected) set.add(rowId); else set.delete(rowId);
        if (set.size === 0) this.#selectedRows.delete(tableId);
        this.#notifySelectionChange();
    }
    clearSelection() { this.#selectedRows.clear(); this.#notifySelectionChange(); }
    getSelectedRows() { return this.#selectedRows; }
    getTotalSelectedCount() {
        let count = 0;
        for (const set of this.#selectedRows.values()) count += set.size;
        return count;
    }
    onSelectionChangeCallback(cb) { this.#onSelectionChange = cb; }
    #notifySelectionChange() {
        if (this.#onSelectionChange) this.#onSelectionChange(this.getTotalSelectedCount());
    }
}
