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
        'Superadmin': { '*': 2 },
        'Admin': {
            '*': 2,
            'btn_audit_logs': 1,
            'col_people.password': 0
        },
        'Supervisor': {
            'btn_calendar': 0,
            'btn_stats': 0,
            'btn_audit_logs': 0
        },
        'User': {
            'btn_calendar': 0,
            'btn_stats': 0,
            'btn_audit_logs': 0
        },
        'Inaktiv': {
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
        const { role, teams = [], perms } = context;

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
            if (categoryLevel !== undefined) return categoryLevel;
        }

        // --- STAGE 3: ROLE-BASED CONTEXT (LEAST PRIVILEGE) ---
        // Block restricted admin tools for non-admins early
        if (['btn_stats', 'btn_audit_logs'].includes(objectId)) return this.LEVELS.NONE;

        const isTeamScoped = this._isTeamScoped(objectId);
        
        // A) TEAM ISOLATION: If in a team, only that team's specific context is allowed
        if (teams.length > 0) {
            if (isTeamScoped) {
                const targetTeam = teamContext || this._extractTeamFromId(objectId);
                if (teams.includes(targetTeam)) {
                    return role === 'Supervisor' ? this.LEVELS.WRITE : this.LEVELS.READ;
                }
            }
            // All other tables/buttons (including Events) default to NONE unless in Role Defaults
        } 
        // B) UNASSIGNED FLEX: Only Activities are granted by default
        else if (role === 'User' || role === 'Supervisor') {
            const isActivity = category === 'spiele' || category === 'sportarten';
            if (isActivity || isTeamScoped) return this.LEVELS.WRITE;
        }

        // --- STAGE 4: ROLE DEFAULTS (THE SAFETY NET) ---
        const roleConfig = this.ROLE_DEFAULTS[role] || this.ROLE_DEFAULTS['User'];
        return roleConfig[objectId] !== undefined ? roleConfig[objectId] : (roleConfig['*'] || this.LEVELS.NONE);
    }

    static _isAdmin(role) {
        return ['SuperAdmin', 'Admin', 'Superadmin'].includes(role);
    }

    static canRead(context, objectId, teamContext = null) {
        return this.getEffectiveLevel(context, objectId, teamContext) >= this.LEVELS.READ;
    }

    static canWrite(context, objectId, teamContext = null) {
        return this.getEffectiveLevel(context, objectId, teamContext) >= this.LEVELS.WRITE;
    }

    static _isTeamScoped(objectId) {
        if (!objectId) return false;
        let id = objectId.startsWith('col_') ? objectId.replace('col_', '').split('.')[0] : objectId;
        
        if (!id.startsWith('tbl_')) return false;
        const parts = id.split('_');
        return parts.length >= 3;
    }

    static _extractTeamFromId(objectId) {
        if (!this._isTeamScoped(objectId)) return null;
        let id = objectId.startsWith('col_') ? objectId.replace('col_', '').split('.')[0] : objectId;
        const parts = id.split('_');
        return parts.slice(2).join('_');
    }

    static _getCategoryForId(objectId) {
        if (!objectId) return null;
        let id = objectId.toLowerCase();
        
        // Handle column-to-table mapping
        if (id.startsWith('col_')) {
            id = id.replace('col_', '').split('.')[0];
        }

        if (!id.startsWith('tbl_')) {
            if (id.startsWith('btn_')) return 'system';
            return null;
        }

        const parts = id.split('_');
        if (parts.length < 2) return null;
        
        const type = parts[1];
        
        if (['activities', 'sport'].includes(type) || id.includes('activities_') || id.includes('sport_')) {
            if (type === 'sport' || parts[2] === 'sport' || id.includes('_sport_')) return 'sportarten';
            return 'spiele';
        }

        if (['people', 'inventory', 'events', 'ort', 'calendar'].includes(type)) {
            return 'organisation';
        }

        return null;
    }
}
