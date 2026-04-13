/**
 * PermissionService — Centralized hub for application permissions and rights.
 * Defines the core logic for what users can see and do.
 */
export class PermissionService {
    static TYPES = {
        ALL: 'all',
        EXCEPT_PEOPLE: 'except_people',
        EXCEPT_INVENTORY: 'except_inventory',
        SPECIFIC: 'specific',
        READONLY: 'readonly',
        NONE: 'none'
    };

    static MGMT_ACCESS = {
        NONE: 'none',
        STATS_ONLY: 'stats_only',
        STATS_PERMS: 'stats_perms'
    };

    /**
     * Determines if a user (from their global state context) can view a table.
     */
    static canViewTable(tableId, context) {
        const { role, permissions, teams, tableConfig } = context;
        const normalizedRole = (role || '').toLowerCase();
        const category = tableConfig?.category || context.category;

        // ── Workspace / Team Rule (Replaces Hardcoded activities rule) ─────────────────────
        const requiresTeam = tableConfig?.requiresTeam || ( (category === 'spiele' || category === 'sportarten') ? 'aktivitäten' : null );
        if (requiresTeam) {
            const hasTeam = (teams || []).some(t => t.toLowerCase() === requiresTeam.toLowerCase());
            if (!hasTeam && normalizedRole !== 'superadmin') {
                return false;
            }
        }

        if (normalizedRole === 'superadmin') return true;
        
        // If the user's role is "Inaktiv", they see nothing
        if (normalizedRole === 'inaktiv') return false;

        if (!permissions || !permissions.type) {
            return normalizedRole === 'admin' || normalizedRole === 'supervisor'; 
        }

        const isSensitive = tableConfig?.isSensitive || (tableId === 'tbl_people' || tableId === 'people_table' || tableId === 'tbl_inventory');

        switch (permissions.type) {
        case this.TYPES.ALL:
            return true;
        case this.TYPES.EXCEPT_PEOPLE:
            return !isSensitive || (tableId !== 'tbl_people' && tableId !== 'people_table');
        case this.TYPES.EXCEPT_INVENTORY:
            return !isSensitive || (tableId !== 'tbl_inventory');
        case this.TYPES.SPECIFIC:
        case this.TYPES.READONLY:
            const views = Array.isArray(permissions.viewTables) ? permissions.viewTables : (Array.isArray(permissions.tables) ? permissions.tables : []);
            if (views.includes(tableId)) return true;
            const edits = Array.isArray(permissions.editTables) ? permissions.editTables : (Array.isArray(permissions.tables) ? permissions.tables : []);
            return edits.includes(tableId);
        case this.TYPES.NONE:
            return false;
        default:
            return true;
        }
    }

    /**
     * Determines if a user can edit a specific table.
     */
    static canEditTable(tableId, context) {
        const { role, permissions, teams, tableConfig } = context;
        const r = (role || '').toLowerCase();
        const category = tableConfig?.category || context.category;

        // ── Workspace / Team Rule ─────────────────────
        const requiresTeam = tableConfig?.requiresTeam || ( (category === 'spiele' || category === 'sportarten') ? 'aktivitäten' : null );
        if (requiresTeam) {
            const hasTeam = (teams || []).some(t => t.toLowerCase() === requiresTeam.toLowerCase());
            if (!hasTeam && r !== 'superadmin') {
                return false;
            }
        }

        if (r === 'superadmin') return true;
        if (r === 'inaktiv') return false;

        // PRIORITIZE team-specific role for granular editing rights
        const effectiveRole = (context.teamRole || r || 'user').toLowerCase();

        // Everyone (Users) can view, but only Supervisor+ can edit Events
        const minRoleForEdit = tableConfig?.minRoleForEdit || (tableId === 'tbl_events' ? 'supervisor' : 'user');
        if (minRoleForEdit === 'supervisor' && effectiveRole === 'user') return false;

        if (!permissions || !permissions.type) {
            if (r === 'admin') return true;
            // Fallback for sensitive tables
            const isSensitive = tableConfig?.isSensitive || (tableId === 'tbl_people' || tableId === 'people_table');
            return !isSensitive;
        }

        if (permissions.type === this.TYPES.READONLY) return false;

        const isSensitive = tableConfig?.isSensitive || (tableId === 'tbl_people' || tableId === 'people_table' || tableId === 'tbl_inventory');

        switch (permissions.type) {
        case this.TYPES.ALL:
            return true;
        case this.TYPES.EXCEPT_PEOPLE:
            return !isSensitive || (tableId !== 'tbl_people' && tableId !== 'people_table');
        case this.TYPES.EXCEPT_INVENTORY:
            return !isSensitive || (tableId !== 'tbl_inventory');
        case this.TYPES.SPECIFIC:
            if (Array.isArray(permissions.editTables)) return permissions.editTables.includes(tableId);
            return Array.isArray(permissions.tables) && permissions.tables.includes(tableId);
        case this.TYPES.NONE:
            return false;
        default:
            return true;
        }
    }

    /**
     * Determines if a user can edit roles within the people table.
     */
    static canEditRoles(context) {
        if ((context.role || '').toLowerCase() === 'superadmin') return true;
        return context.permissions?.canEditRoles === true;
    }

    /**
     * Determines if a user can view administrative statistics.
     */
    static canSeeStats(context) {
        if ((context.role || '').toLowerCase() === 'superadmin') return true;
        return context.permissions?.canManageUsers ||
               context.permissions?.managementAccess === this.MGMT_ACCESS.STATS_ONLY ||
               context.permissions?.managementAccess === this.MGMT_ACCESS.STATS_PERMS;
    }

    /**
     * Determines if a user can manage other users' permissions.
     */
    static canManagePermissions(context) {
        if ((context.role || '').toLowerCase() === 'superadmin') return true;
        return context.permissions?.managementAccess === this.MGMT_ACCESS.STATS_PERMS;
    }

    /**
     * Determines if a user can use the "Edit Mode" feature.
     */
    static canUseEditMode(context) {
        if ((context.role || '').toLowerCase() === 'superadmin') return true;
        return context.permissions?.canUseEditMode === true;
    }

    /**
     * Determines if the "Edit Mode" applies to a specific table for the user.
     */
    static canUseEditModeForTable(tableId, context) {
        if (!this.canUseEditMode(context)) return false;
        return this.canEditTable(tableId, context);
    }

    /**
     * Determines if a user can view audit logs.
     */
    static canViewLogs(context) {
        if ((context.role || '').toLowerCase() === 'superadmin') return true;
        return context.permissions?.canViewLogs === true;
    }

    /**
     * Returns the default permission object for a specific role.
     */
    static getPermissionsForRole(role) {
        const r = (role || 'User').toLowerCase();
        if (r === 'superadmin') {
            return {
                type: this.TYPES.ALL,
                managementAccess: this.MGMT_ACCESS.STATS_PERMS,
                canEditRoles: true,
                canUseEditMode: true,
                canViewLogs: true
            };
        }
        if (r === 'admin') {
            return {
                type: this.TYPES.ALL,
                managementAccess: this.MGMT_ACCESS.STATS_PERMS,
                canEditRoles: false,
                canUseEditMode: false,
                canViewLogs: true
            };
        }
        if (r === 'supervisor') {
            return {
                type: this.TYPES.ALL,
                managementAccess: this.MGMT_ACCESS.STATS_ONLY
            };
        }
        if (r === 'inaktiv') {
            return {
                type: this.TYPES.NONE,
                managementAccess: this.MGMT_ACCESS.NONE
            };
        }
        return this.getDefaultPermissions();
    }

    /**
     * Returns a default permission object for a new user.
     */
    static getDefaultPermissions() {
        return {
            type: this.TYPES.EXCEPT_PEOPLE,
            viewTables: [],
            editTables: [],
            managementAccess: this.MGMT_ACCESS.NONE,
            canUseEditMode: false,
            canViewLogs: false
        };
    }
}
