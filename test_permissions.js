import { PermissionService } from './src/services/PermissionService.js';

const roles = ['Superadmin', 'Admin', 'Supervisor', 'User', 'Inaktiv'];
const tables = ['tbl_people', 'tbl_inventory', 'tbl_activities_sport', 'tbl_events'];

console.log('--- PermissionService Test Audit ---');
console.log('Role'.padEnd(15), 'Table'.padEnd(20), 'Can View'.padEnd(10), 'Can Edit');
console.log('-'.repeat(60));

roles.forEach(role => {
    const context = {
        role: role,
        permissions: PermissionService.getPermissionsForRole(role)
    };

    tables.forEach(tableId => {
        const canView = PermissionService.canViewTable(tableId, context);
        const canEdit = PermissionService.canEditTable(tableId, context);
        
        console.log(
            role.padEnd(15), 
            tableId.padEnd(20), 
            (canView ? '✅' : '❌').padEnd(10), 
            (canEdit ? '✅' : '❌')
        );
    });
    console.log('-'.repeat(60));
});

console.log('\n--- Special Feature Checks ---');
roles.forEach(role => {
    const context = {
        role: role,
        permissions: PermissionService.getPermissionsForRole(role)
    };
    
    const canSeeStats = PermissionService.canSeeStats(context);
    const canManagePerms = PermissionService.canManagePermissions(context);
    const canEditRoles = PermissionService.canEditRoles(context);
    const canUseEditMode = PermissionService.canUseEditMode(context);
    
    console.log(`[${role}] Stats: ${canSeeStats ? '✅' : '❌'}, Manage Perms: ${canManagePerms ? '✅' : '❌'}, Edit Roles: ${canEditRoles ? '✅' : '❌'}, Edit Mode: ${canUseEditMode ? '✅' : '❌'}`);
});
