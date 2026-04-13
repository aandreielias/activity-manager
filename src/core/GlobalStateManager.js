import { PermissionService } from '../services/PermissionService.js';
import { SupabaseClient } from '../services/SupabaseClient.js';
import { ColourFactory } from '../utils/ColourFactory.js';

/**
 * GlobalStateManager - Standardized state management.
 * Follows the Singleton pattern to ensure a consistent application state.
 */
export class GlobalStateManager {
    static #instance = null;

    #currentUser = null;
    #currentRole = null;
    #currentUserId = null;
    #currentTeams = []; // Array of team names the current user belongs to
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
    #selectedRows = new Map(); // tableId -> Set([rowIds])
    #onSelectionChange = null;

    #tableConfigs = [];
    #availableTeams = []; // Global list of all available teams in the system
    #globalFilters = {
        main: {}, // tableId -> { active, groupBy, filters }
        split: {} // tableId -> { active, groupBy, filters }
    };

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

    setCurrentUser(username, role, permissions = null, teams = []) {
        this.#currentUser = username;
        this.#currentRole = role;
        this.#currentTeams = Array.isArray(teams) ? teams : (typeof teams === 'string' ? teams.split(',').map(t => t.trim()) : []);
        this.#permissions = permissions || PermissionService.getDefaultPermissions();
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
    getPermissions() { return this.#permissions; }

    getRoleForTeam(teamName) {
        if (!teamName || !this.#permissions || !this.#permissions.teamRoles) return 'User';
        return this.#permissions.teamRoles[teamName] || 'User';
    }

    isSuperAdmin() { return (this.#currentRole || '').toLowerCase() === 'superadmin'; }
    isAdmin() { return (this.#currentRole || '').toLowerCase() === 'admin'; }

    canView(tableId) {
        const config = this.getTableConfig(tableId);
        const context = { 
            role: this.#currentRole, 
            permissions: this.#permissions, 
            teams: this.#currentTeams, 
            category: config?.category 
        };
        return PermissionService.canViewTable(tableId, context);
    }

    canEdit(tableId) {
        const config = this.getTableConfig(tableId);
        const teamRole = config?.requiresTeam ? this.getRoleForTeam(config.requiresTeam) : null;
        const context = { 
            role: this.#currentRole, 
            permissions: this.#permissions, 
            teams: this.#currentTeams,
            teamRole: teamRole,
            tableConfig: config
        };
        return PermissionService.canEditTable(tableId, context);
    }

    canEditColumn(tableId, colId) {
        if (this.isSuperAdmin()) return true;
        if (colId === 'createdBy' || colId === 'createdAt') return false;
        if ((tableId === 'tbl_people' || tableId === 'people_table') && colId === 'role') {
            const context = { role: this.#currentRole, permissions: this.#permissions, teams: this.#currentTeams };
            if (!PermissionService.canEditRoles(context)) return false;
        }
        return this.canEdit(tableId);
    }

    canSeeStats() {
        const context = { role: this.#currentRole, permissions: this.#permissions, teams: this.#currentTeams };
        return PermissionService.canSeeStats(context);
    }

    canManagePermissions() {
        const context = { role: this.#currentRole, permissions: this.#permissions, teams: this.#currentTeams };
        return PermissionService.canManagePermissions(context);
    }

    canUseEditMode() {
        const context = { role: this.#currentRole, permissions: this.#permissions, teams: this.#currentTeams };
        return PermissionService.canUseEditMode(context);
    }

    canViewLogs() {
        const context = { role: this.#currentRole, permissions: this.#permissions, teams: this.#currentTeams };
        return PermissionService.canViewLogs(context);
    }

    canUseEditModeForTable(tableId) {
        const config = this.getTableConfig(tableId);
        const context = { 
            role: this.#currentRole, 
            permissions: this.#permissions, 
            teams: this.#currentTeams, 
            category: config?.category 
        };
        return PermissionService.canUseEditModeForTable(tableId, context);
    }

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

    async addEnumOption(enumName, newValue) {
        if (!this.isEditModeActive()) return;
        try {
            const res = await SupabaseClient.post('rpc/add_enum_value', { t_name: enumName, new_value: newValue });
            if (res.ok) await this.loadGlobalEnums();
        } catch (e) { console.error('[GlobalStateManager] Add enum option failed:', e); throw e; }
    }

    #onFlashMessage = null;
    showFlashMessage(message, type = 'success') {
        if (this.#onFlashMessage) this.#onFlashMessage(message, type);
        else alert(`${type.toUpperCase()}: ${message}`);
    }
    onFlashMessageCallback(cb) { this.#onFlashMessage = cb; }

    async addColumn(tableId, colData) {
        if (!this.isEditModeActive()) return;
        const { name, type, newEnum } = colData;
        try {
            const { DataService } = await import('../services/DataService.js');
            const { supaTable } = DataService._resolveTable(tableId);
            if (newEnum) {
                await SupabaseClient.post('rpc/create_enum_type', { t_name: newEnum.name, options: newEnum.options });
            }
            let pgType = type;
            if (pgType === 'number') pgType = 'numeric';
            if (pgType === 'int') pgType = 'integer';
            const res = await SupabaseClient.post('rpc/add_table_column', { t_name: supaTable, c_name: name, c_type: pgType });
            if (!res.ok) throw new Error('Spalte konnte nicht hinzugefügt werden');
            const cfg = this.getTableConfig(tableId);
            if (cfg) {
                const newCol = { id: name, label: name, type: type === 'number' ? 'number' : (type === 'int' ? 'number' : type) };
                const auditIdx = cfg.schema.findIndex(c => c.id === 'createdBy' || c.id === 'createdAt');
                if (auditIdx !== -1) cfg.schema.splice(auditIdx, 0, newCol);
                else cfg.schema.push(newCol);
                await this.saveTableConfigs();
            }
            this.showFlashMessage(`Spalte '${name}' hinzugefügt!`, 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) { this.showFlashMessage(e.message, 'error'); throw e; }
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
    clearAllUnsaved() { this.#unsavedTableIds.clear(); this.#notifyUnsavedChange(); }
    getUnsavedTableIds() { return [...this.#unsavedTableIds]; }
    onUnsavedChangeCallback(cb) { this.#onUnsavedChange = cb; }

    #notifyUnsavedChange() {
        if (this.#onUnsavedChange) this.#onUnsavedChange(this.#unsavedTableIds.size > 0);
    }

    setInventory(data) { this.#inventory = data; }
    getInventory() { return this.#inventory; }

    setEditModeActive(active) {
        this.#editModeActive = active;
        document.body.classList.toggle('edit-mode-active', active);
        localStorage.setItem('edit_mode_active', active);
    }
    isEditModeActive() { return this.#editModeActive; }

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
