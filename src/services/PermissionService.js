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
        const { role, permissions } = context;
        const normalizedRole = (role || '').toLowerCase();
        if (normalizedRole === 'superadmin') return true;
        if (!permissions || !permissions.type) {
            return normalizedRole === 'admin' || normalizedRole === 'supervisor'; // Safe fallback: only admins/supervisors see all by default
        }

        switch (permissions.type) {
            case this.TYPES.ALL:
                return true;
            case this.TYPES.EXCEPT_PEOPLE:
                return tableId !== 'tbl_people' && tableId !== 'people_table';
            case this.TYPES.EXCEPT_INVENTORY:
                return tableId !== 'tbl_inventory';
            case this.TYPES.SPECIFIC:
            case this.TYPES.READONLY:
                const views = Array.isArray(permissions.viewTables) ? permissions.viewTables : (Array.isArray(permissions.tables) ? permissions.tables : []);
                if (views.includes(tableId)) return true;
                
                // If you can edit, you can see
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
        const { role, permissions } = context;
        const r = (role || '').toLowerCase();
        if (r === 'superadmin') return true;

        // Everyone (Users) can view, but only Supervisor+ can edit Events
        if (tableId === 'tbl_events' && (r === 'user' || !r)) return false;

        if (!permissions || !permissions.type) {
            if (r === 'admin') return true;
            return tableId !== 'tbl_people' && tableId !== 'people_table';
        }

        if (permissions.type === this.TYPES.READONLY) return false;

        switch (permissions.type) {
            case this.TYPES.ALL:
                return true;
            case this.TYPES.EXCEPT_PEOPLE:
                return tableId !== 'tbl_people' && tableId !== 'people_table';
            case this.TYPES.EXCEPT_INVENTORY:
                return tableId !== 'tbl_inventory';
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
     * Returns the default permission object for a specific role.
     */
    static getPermissionsForRole(role) {
        const r = (role || 'User').toLowerCase();
        if (r === 'superadmin') {
            return {
                type: this.TYPES.ALL,
                managementAccess: this.MGMT_ACCESS.STATS_PERMS,
                canEditRoles: true,
                canUseEditMode: true
            };
        }
        if (r === 'admin') {
            return {
                type: this.TYPES.ALL,
                managementAccess: this.MGMT_ACCESS.STATS_PERMS,
                canEditRoles: false,
                canUseEditMode: false // Admins don't get it by default anymore
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
            canUseEditMode: false
        };
    }
}
