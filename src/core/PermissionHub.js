import { ROLES, CATEGORIES, TABLE_NAMES, TABLE_PREFIXES } from './Constants.js';

/**
 * PermissionHub - Centralized authority for checking user permissions.
 * Implements granular access control (Level 0, 1, 2).
 */
export class PermissionHub {
    static LEVELS = {
        NONE: 0,
        READ: 1,
        WRITE: 2
    };

    /**
     * Define default permissions for each role.
     */
    static ROLE_DEFAULTS = {
        [ROLES.SUPERADMIN]: { '*': 2 },
        [ROLES.ADMIN]: {
            '*': 2,
            [`${TABLE_PREFIXES.BUTTON}audit_logs`]: 1,
            [`${TABLE_PREFIXES.COLUMN}${TABLE_NAMES.PEOPLE}.password`]: 0
        },
        [ROLES.SUPERVISOR]: {
            [`${TABLE_PREFIXES.BUTTON}calendar`]: 0,
            [`${TABLE_PREFIXES.BUTTON}stats`]: 0,
            [`${TABLE_PREFIXES.BUTTON}audit_logs`]: 0
        },
        [ROLES.USER]: {
            [`${TABLE_PREFIXES.BUTTON}calendar`]: 0,
            [`${TABLE_PREFIXES.BUTTON}stats`]: 0,
            [`${TABLE_PREFIXES.BUTTON}audit_logs`]: 0
        },
        [ROLES.INAKTIV]: {
            '*': 0
        }
    };

    /**
     * Resolve the final permission level for an object.
     * @param {Object} context - User context (role, teams, permissions)
     * @param {string} objectId - Identifier
     * @param {string} teamContext - Optional team context
     */
    static getEffectiveLevel(context, objectId, teamContext = null) {
        const { teams = [], perms } = context;
        let role = context.role || ROLES.USER;

        // Normalize role casing to match ROLE_DEFAULTS keys
        if (role.toLowerCase() === ROLES.SUPERADMIN.toLowerCase()) role = ROLES.SUPERADMIN;
        else if (role.toLowerCase() === ROLES.ADMIN.toLowerCase()) role = ROLES.ADMIN;
        else if (role.toLowerCase() === ROLES.SUPERVISOR.toLowerCase()) role = ROLES.SUPERVISOR;
        else if (role.toLowerCase() === ROLES.USER.toLowerCase()) role = ROLES.USER;

        // --- STAGE 1: GLOBAL HARD-BLOCKS ---
        if ((objectId.includes('.role') || objectId.includes('.rolle')) && !this._isAdmin(role)) {
            return this.LEVELS.NONE;
        }
        if (this._isAdmin(role)) return this.LEVELS.WRITE;

        // --- STAGE 2: EXPLICIT OVERWRITES (WINS OVER DEFAULTS) ---
        const specificLevel = perms?.overwrites?.[objectId];
        if (specificLevel !== undefined) return specificLevel;

        const category = this._getCategoryForId(objectId);
        if (category) {
            const categoryLevel = perms?.overwrites?.[`cat_${category}`];
            // Only use category level if it's an explicit setting (NOT -2/Manuell and NOT -1/Standard)
            if (categoryLevel !== undefined && categoryLevel !== -1 && categoryLevel !== -2) {
                return categoryLevel;
            }
        }

        // --- STAGE 3: ROLE-BASED CONTEXT (LEAST PRIVILEGE) ---
        // Block restricted admin tools for non-admins early
        if ([`${TABLE_PREFIXES.BUTTON}stats`, `${TABLE_PREFIXES.BUTTON}audit_logs`].includes(objectId)) return this.LEVELS.NONE;

        const isTeamScoped = this._isTeamScoped(objectId);
        const isGlobalActivity = category === CATEGORIES.SPIELE || category === CATEGORIES.SPORTARTEN;
        
        // A) TEAM ISOLATION: If in a team, only that team's specific context is allowed
        // BUT: Global activities are always allowed at least for reading
        if (teams.length > 0) {
            if (isTeamScoped) {
                const targetTeam = teamContext || this._extractTeamFromId(objectId);
                if (teams.includes(targetTeam)) {
                    return role === ROLES.SUPERVISOR ? this.LEVELS.WRITE : this.LEVELS.READ;
                }
            }
            if (isGlobalActivity) return this.LEVELS.READ;
            // All other tables/buttons (including Events) default to NONE unless in Role Defaults
        } 
        // B) UNASSIGNED FLEX: Only Activities are granted by default
        else if (role === ROLES.USER || role === ROLES.SUPERVISOR) {
            const isActivity = category === CATEGORIES.SPIELE || category === CATEGORIES.SPORTARTEN;
            if (isActivity || isTeamScoped) return this.LEVELS.WRITE;
        }

        // --- STAGE 4: ROLE DEFAULTS (THE SAFETY NET) ---
        const roleConfig = this.ROLE_DEFAULTS[role] || this.ROLE_DEFAULTS[ROLES.USER];
        return roleConfig[objectId] !== undefined ? roleConfig[objectId] : (roleConfig['*'] || this.LEVELS.NONE);
    }

    static _isAdmin(role) {
        if (!role) return false;
        const r = role.toLowerCase();
        return r === ROLES.SUPERADMIN.toLowerCase() || r === ROLES.ADMIN.toLowerCase();
    }

    static canRead(context, objectId, teamContext = null) {
        return this.getEffectiveLevel(context, objectId, teamContext) >= this.LEVELS.READ;
    }

    static canWrite(context, objectId, teamContext = null) {
        return this.getEffectiveLevel(context, objectId, teamContext) >= this.LEVELS.WRITE;
    }

    static _isTeamScoped(objectId) {
        if (!objectId) return false;
        let id = objectId.startsWith(TABLE_PREFIXES.COLUMN) ? objectId.replace(TABLE_PREFIXES.COLUMN, '').split('.')[0] : objectId;
        
        if (!id.startsWith(TABLE_PREFIXES.TABLE)) return false;
        
        // A team-scoped ID looks like: tbl_[supa_table]_[team]
        // Example: tbl_ak_aktivitaeten_deko
        for (const tableName of Object.values(TABLE_NAMES)) {
            if (id.startsWith(`${TABLE_PREFIXES.TABLE}${tableName}_`)) {
                return true;
            }
        }
        return false;
    }

    static _extractTeamFromId(objectId) {
        if (!this._isTeamScoped(objectId)) return null;
        let id = objectId.startsWith(TABLE_PREFIXES.COLUMN) ? objectId.replace(TABLE_PREFIXES.COLUMN, '').split('.')[0] : objectId;
        
        for (const tableName of Object.values(TABLE_NAMES)) {
            const prefix = `${TABLE_PREFIXES.TABLE}${tableName}_`;
            if (id.startsWith(prefix)) {
                return id.replace(prefix, '');
            }
        }
        return null;
    }

    static _getCategoryForId(objectId) {
        if (!objectId) return null;
        let id = objectId.toLowerCase();
        
        // Handle column-to-table mapping
        if (id.startsWith(TABLE_PREFIXES.COLUMN)) {
            id = id.replace(TABLE_PREFIXES.COLUMN, '').split('.')[0];
        }

        if (!id.startsWith(TABLE_PREFIXES.TABLE)) {
            if (id.startsWith(TABLE_PREFIXES.BUTTON)) return CATEGORIES.SYSTEM;
            return null;
        }

        // Logical check: matches Supabase table name OR common logical name
        const isActivity = id.includes(TABLE_NAMES.ACTIVITIES) || 
                          id.includes(TABLE_NAMES.SPORT_VENUES) ||
                          id.includes('spiele') || 
                          id.includes('sport');

        if (isActivity) {
            if (id.includes(TABLE_NAMES.SPORT_VENUES) || id.includes('sportarten') || id.includes('sport')) return CATEGORIES.SPORTARTEN;
            return CATEGORIES.SPIELE;
        }

        if (id.includes(TABLE_NAMES.PEOPLE) || id.includes(TABLE_NAMES.INVENTORY) || id.includes(TABLE_NAMES.EVENTS) || id.includes('calendar')) {
            return CATEGORIES.ORGANISATION;
        }

        return null;
    }
}
