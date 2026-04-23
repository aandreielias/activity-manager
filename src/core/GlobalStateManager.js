import { SupabaseClient } from '../services/SupabaseClient.js';
import { ColourFactory } from '../utils/ColourFactory.js';
import { PermissionHub } from './PermissionHub.js';
import { TABLE_NAMES, ROLES, TABLE_PREFIXES, CATEGORIES } from './Constants.js';

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
    #currentTeamIds = []; // Array of team UUIDs the current user belongs to
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
    #teamTableMappings = []; // Groups of tables per team from tt_team_tabellen
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

    setCurrentUser(username, role, permissions = null, teams = [], imageUrl = null, teamIds = []) {
        this.#currentUser = username;
        this.#currentRole = role || ROLES.USER;
        this.#currentTeams = Array.isArray(teams) ? teams : (typeof teams === 'string' ? teams.split(',').map(t => t.trim()) : []);
        this.#currentTeamIds = Array.isArray(teamIds) ? teamIds : [];
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

    /**
     * Determines the initial table to show for the current user.
     * Prioritizes standard tables for the user's teams.
     */
    getInitialTableForUser() {
        if (!this.#currentUser) return null;
        
        // Use person data to get team IDs if available
        // In a real scenario, these would be in this.#currentTeamIds
        // For now, we search mappings for groups that link to the user's teams
        const userTeams = this.#currentTeams.map(t => t.toLowerCase());
        const userTeamIds = this.#currentTeamIds;
        
        // Find matching mapping group
        const matchingGroup = this.#teamTableMappings.find(group => {
            // Priority 1: Match by Team ID
            if (group.tt_tm_id && userTeamIds.includes(group.tt_tm_id)) return true;

            // Priority 2: Fuzzy match team name to group name
            const groupName = (group.tt_name || '').toLowerCase();
            return userTeams.includes(groupName) || userTeams.some(ut => groupName.includes(ut) || ut.includes(groupName));
        });

        if (matchingGroup) {
            if (matchingGroup.standards && matchingGroup.standards.length > 0) {
                // If multiple standards, return the special group view ID
                if (matchingGroup.standards.length > 1) {
                    return `group-${matchingGroup.tt_id}`;
                }
                return matchingGroup.standards[0];
            }
            // Priority 2: First available table in the team
            if (matchingGroup.tables && matchingGroup.tables.length > 0) {
                return matchingGroup.tables[0].t_id;
            }
        }

        return null;
    }

    getRoleForTeam(teamName) {
        return ROLES.USER; // Simplified for now
    }

    isSuperAdmin() { return (this.#currentRole || '').toLowerCase() === ROLES.SUPERADMIN.toLowerCase(); }
    isAdmin() { return (this.#currentRole || '').toLowerCase() === ROLES.ADMIN.toLowerCase(); }

    getPermissionContext() {
        return {
            role: this.#currentRole,
            teams: this.#currentTeams,
            perms: this.#permissions
        };
    }

    canView(objectId) { 
        // Anonymous/Login Bypass: Allow reading people list only for the login screen
        if (!this.#currentUser && objectId === `${TABLE_PREFIXES.TABLE}${TABLE_NAMES.PEOPLE}`) return true;
        
        return PermissionHub.canRead(this.getPermissionContext(), objectId); 
    }
    
    canEdit(objectId) { 
        return PermissionHub.canWrite(this.getPermissionContext(), objectId); 
    }

    canEditColumn(tableId, colId) {
        if (colId === 'createdBy' || colId === 'createdAt') return false;
        return PermissionHub.canWrite(this.getPermissionContext(), `col_${tableId}.${colId}`);
    }

    canSeeStats() { return PermissionHub.canRead(this.getPermissionContext(), `${TABLE_PREFIXES.BUTTON}stats`); }
    canManagePermissions() { 
        return (this.isSuperAdmin() || this.isAdmin()); 
    }
    canUseEditMode() { return false; }
    canViewLogs() { return PermissionHub.canRead(this.getPermissionContext(), `${TABLE_PREFIXES.BUTTON}audit_logs`); }
    canUseEditModeForTable(tableId) { return false; }

    async loadFavorites() {
        if (!this.#currentUserId) return;
        try {
            const res = await SupabaseClient.get(TABLE_NAMES.USER_FAVORITES, `?nf_nu_id=eq.${this.#currentUserId}`);
            if (res.ok) {
                const rows = await res.json();
                this.#favorites = rows.map(f => f.nf_ak_id);
            }
        } catch (e) {
            console.error('[GlobalStateManager] Load favorites failed:', e);
        }
    }

    async loadGlobalEnums() {
        try {
            const res = await SupabaseClient.post('rpc/get_all_enums', {});
            if (res.ok) {
                const rawEnums = await res.json();
                this.#enums = {};
                
                // Ensure all enum values start with a capital letter for compatibility
                for (const [name, values] of Object.entries(rawEnums)) {
                    if (Array.isArray(values)) {
                        this.#enums[name] = [...new Set(values.map(v => 
                            (typeof v === 'string' && v.length > 0) 
                                ? v.charAt(0).toUpperCase() + v.slice(1) 
                                : v
                        ))];
                    } else {
                        this.#enums[name] = values;
                    }
                }
            }
        } catch (e) {
            console.error('[GlobalStateManager] Enum fetch failed:', e);
        }
    }

    getEnums() { return this.#enums; }
    getEnumOptions(enumName) { return this.#enums[enumName] || null; }

    async loadAvailableTeams() {
        try {
            const res = await SupabaseClient.get(TABLE_NAMES.TEAMS, `?select=tm_id,tm_name,tm_farbe&order=tm_name.asc`);
            if (res.ok) {
                const rows = await res.json();
                this.#availableTeams = rows.map(r => ({
                    id: r.tm_id,
                    name: r.tm_name,
                    color: r.tm_farbe || ColourFactory.getBrandBlue()
                }));
                
                await this.loadTeamTableMappings();
            }
        } catch (e) {
            console.error('[GlobalStateManager] Team load failed:', e);
        }
    }

    async loadTeamTableMappings() {
        try {
            const res = await SupabaseClient.get(TABLE_NAMES.TEAM_TABLES);
            if (res.ok) {
                const groups = await res.json();
                
                const tablesRes = await SupabaseClient.get(TABLE_NAMES.TABLES, '?order=t_reihenfolge.asc');
                const standardsRes = await SupabaseClient.get(TABLE_NAMES.TEAM_STANDARDS);

                if (tablesRes.ok && standardsRes.ok) {
                    const allTables = await tablesRes.json();
                    const allStandards = await standardsRes.json();

                    this.#teamTableMappings = groups.map(group => {
                        const groupTables = allTables.filter(t => t.t_tt_id === group.tt_id);
                        const groupStandards = allStandards
                            .filter(s => s.ts_tt_id === group.tt_id)
                            .map(s => s.ts_t_id);

                        return {
                            ...group,
                            tables: groupTables,
                            standards: groupStandards
                        };
                    });
                }
                console.log('[GlobalStateManager] Mappings loaded:', this.#teamTableMappings.length);
            }
        } catch (e) {
            console.error('[GlobalStateManager] Team-Table Mapping load failed:', e);
        }
    }

    /**
     * Returns a list of tables that are available for a specific person based on their team membership.
     * @param {Object} person - The person object
     * @returns {Array} - Array of table objects
     */
    getAvailableTablesForPerson(person) {
        if (!person) return [];
        
        // Use teamIds if available (most reliable), otherwise fallback to names
        const personTeamIds = person.teamIds || [];
        const rawTeam = person.Team || '';
        const personTeamNames = Array.isArray(rawTeam) 
            ? rawTeam.map(t => t.trim().toLowerCase())
            : rawTeam.split(',').map(t => t.trim().toLowerCase());
        
        console.log('[GlobalStateManager] Filtering tables for person teams:', { ids: personTeamIds, names: personTeamNames });
        
        // Find matching groups from our mappings
        const matchingGroups = this.#teamTableMappings.filter(group => {
            // Check by ID (tt_tm_id) - Most reliable
            if (group.tt_tm_id && personTeamIds.includes(group.tt_tm_id)) return true;
            
            // Fallback: Fuzzy Name Match
            const groupName = (group.tt_name || '').toLowerCase().replace(' team', '').trim();
            const groupTitle = (group.tt_titel || '').toLowerCase().replace(' team', '').trim();
            
            return personTeamNames.some(pName => {
                const cleanPName = pName.replace(' team', '').trim();
                return cleanPName === groupName || cleanPName === groupTitle;
            });
        });
        
        console.log('[GlobalStateManager] Found matching groups:', matchingGroups.length);

        const tables = [];
        matchingGroups.forEach(group => {
            if (group.tables) tables.push(...group.tables);
        });
        
        const uniqueTables = Array.from(new Map(tables.map(t => [t.t_id, t])).values());
        console.log('[GlobalStateManager] Available unique tables:', uniqueTables.length);
        return uniqueTables;
    }

    getTeamTableMappings() {
        return this.#teamTableMappings || [];
    }

    getNavigationGroups() {
        return this.#teamTableMappings.map(group => ({
            id: group.tt_id,
            name: group.tt_name,
            icon: group.tt_icon,
            standardTableIds: group.standards || [],
            tables: (group.tables || []).map(t => ({
                id: t.t_id,
                title: t.t_titel
            }))
        }));
    }

    getAvailableTeams() {
        return this.#availableTeams.length > 0 ? this.#availableTeams : [{ name: 'Aktivitäten', color: ColourFactory.getBrandBlue() }];
    }

    getEnumOptionsForColumn(colId, tableId) {
        const id = colId.toLowerCase();
        if (id === 'status' || id === 'ak_status') {
            const isPeople = tableId && (
                tableId.includes(TABLE_NAMES.PEOPLE) || 
                tableId.includes('personen') || 
                tableId.includes('people') ||
                tableId.includes('pe_')
            );
            if (isPeople) return this.getEnumOptions('pe_status_typ');
            return this.getEnumOptions('ev_status_enum');
        }
        if (id === 'role' || id === 'rolle' || id === 'pe_rolle') return this.getEnumOptions('pe_rolle_typ');
        if (id === 'location' || id === 'ort') return this.getEnumOptions('st_ort_typ');
        if (id === 'category' || id === 'kategorie') {
            if (tableId && tableId.includes('activities')) return this.getEnumOptions('ak_kategorie_typ');
            if (tableId && tableId.includes('inventory')) return this.getEnumOptions('in_kategorie_typ');
            return this.getEnumOptions('ak_kategorie_typ');
        }
        if (id === 'condition' || id === 'zustand' || id === 'in_zustand') return this.getEnumOptions('in_zustand_typ');
        if (id === 'type' || id === 'typ') {
            if (tableId && (tableId.includes('sport') || tableId.includes(TABLE_NAMES.SPORT_VENUES))) return this.getEnumOptions('sp_typ_enum');
            if (tableId && tableId.includes('people')) return this.getEnumOptions('pe_rolle_typ');
            return this.getEnumOptions('ak_typ_enum');
        }
        if (id === 'indoor_outdoor' || id === 'umgebung') return this.getEnumOptions('st_umgebung_typ');
        return null;
    }

    /**
     * Dynamically finds enum options associated with specific teams
     * by looking at the schemas of tables belonging to those teams.
     */
    getOptionsForTeams(teamNames, columnId = 'category') {
        if (!teamNames || teamNames.length === 0) return [];
        const targetTeams = Array.isArray(teamNames) ? teamNames.map(t => t.toLowerCase()) : [teamNames.toLowerCase()];
        const optionsByTeam = {};

        this.#tableConfigs.forEach(config => {
            const teamId = (config.team_identifier || config.category || '').toLowerCase();
            if (targetTeams.includes(teamId)) {
                if (!optionsByTeam[teamId]) optionsByTeam[teamId] = new Set();
                
                const col = config.schema.find(c => c.id.toLowerCase() === columnId.toLowerCase());
                if (col && col.options) {
                    col.options.forEach(opt => {
                        const val = (typeof opt === 'object' && opt !== null) ? opt.value : opt;
                        if (val) optionsByTeam[teamId].add(val);
                    });
                }
            }
        });

        // Convert to grouped array format
        return Object.entries(optionsByTeam).map(([team, optionSet]) => ({
            team: team.charAt(0).toUpperCase() + team.slice(1),
            options: [...optionSet].sort()
        }));
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
                await SupabaseClient.post(TABLE_NAMES.USER_FAVORITES, { nf_nu_id: this.#currentUserId, nf_ak_id: rowId });
            } else {
                this.#favorites.splice(index, 1);
                await SupabaseClient.delete(TABLE_NAMES.USER_FAVORITES, `?nf_nu_id=eq.${this.#currentUserId}&nf_ak_id=eq.${rowId}`);
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
