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
            'tbl_people': 1,
            'tbl_inventory': 1,
            'tbl_activities': 1,
            'tbl_events': 1,
            'tbl_ort': 1,
            'btn_calendar': 1,
            'btn_stats': 1,
            'btn_audit_logs': 0
        },
        'User': {
            'tbl_people': 1,
            'tbl_inventory': 1,
            'tbl_activities': 1,
            'tbl_events': 1,
            'tbl_ort': 1,
            'btn_calendar': 1,
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
        const { role, teams = [], perms = {} } = context;

        // 0. Inaktiv short-circuit
        if (role === 'Inaktiv') return this.LEVELS.NONE;

        // 1. Superadmin bypass
        if (role === 'Superadmin') return this.LEVELS.WRITE;

        // 2. Individual Object Overwrites
        if (perms && perms.overwrites && perms.overwrites[objectId] !== undefined) {
            return perms.overwrites[objectId];
        }

        // 3. Workspace (Category) Overwrites
        const category = this._getCategoryForId(objectId);
        if (category && perms && perms.overwrites && perms.overwrites[`cat_${category}`] !== undefined) {
            return perms.overwrites[`cat_${category}`];
        }

        // 4. Team-Scoped Auto-Upgrade (Default for Supervisors to their own teams)
        if (teamContext || this._isTeamScoped(objectId)) {
            const TARGET_TEAM = teamContext || this._extractTeamFromId(objectId);
            
            if (teams.length > 0) {
                // User has teams -> restricted to those teams
                if (!teams.includes(TARGET_TEAM)) return this.LEVELS.NONE;
                
                // SUPERVISOR AUTO-UPGRADE for their assigned team
                if (role === 'Supervisor') return this.LEVELS.WRITE;
            }
        }

        // 4. Role Defaults
        const rolePerms = this.ROLE_DEFAULTS[role] || this.ROLE_DEFAULTS['User'];
        let level = rolePerms[objectId] !== undefined ? rolePerms[objectId] : (rolePerms['*'] || this.LEVELS.NONE);

        // 5. Auditor Mode Enforcement (No teams = No Write access)
        if (teams.length === 0 && role !== 'Superadmin' && role !== 'Admin') {
            if (level > this.LEVELS.READ) level = this.LEVELS.READ;
        }

        return level;
    }

    static canRead(context, objectId, teamContext = null) {
        return this.getEffectiveLevel(context, objectId, teamContext) >= this.LEVELS.READ;
    }

    static canWrite(context, objectId, teamContext = null) {
        return this.getEffectiveLevel(context, objectId, teamContext) >= this.LEVELS.WRITE;
    }

    static _isTeamScoped(objectId) {
        if (!objectId.startsWith('tbl_')) return false;
        // A team-scoped ID follows the pattern tbl_[Type]_[TeamName]
        // where Type is one of (activities, sport, inventory, people, events, ort)
        const parts = objectId.split('_');
        return parts.length >= 3;
    }

    static _extractTeamFromId(objectId) {
        if (!this._isTeamScoped(objectId)) return null;
        const parts = objectId.split('_');
        // The team name is the last segment (or joined segments if team name contains underscores)
        return parts.slice(2).join('_');
    }

    static _getCategoryForId(objectId) {
        if (!objectId) return null;
        const lowerId = objectId.toLowerCase();
        
        if (!lowerId.startsWith('tbl_')) {
            // Check for explicit system buttons
            if (lowerId.startsWith('btn_')) return 'system';
            return null;
        }

        const parts = lowerId.split('_');
        if (parts.length < 2) return null;
        
        const type = parts[1]; // e.g., 'activities', 'sport', 'people', 'inventory', 'ort', 'events'
        
        if (['activities', 'sport'].includes(type) || lowerId.includes('activities_') || lowerId.includes('sport_')) {
            if (type === 'sport' || parts[2] === 'sport' || lowerId.includes('_sport_')) return 'sportarten';
            return 'spiele';
        }

        if (['people', 'inventory', 'events', 'ort'].includes(type)) {
            return 'organisation';
        }

        return null;
    }
}
