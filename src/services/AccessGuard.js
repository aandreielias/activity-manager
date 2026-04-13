import { PermissionService } from './PermissionService.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';

/**
 * AccessGuard - The gatekeeper for all data operations.
 * It verifies permissions before allowing a request to proceed.
 */
export class AccessGuard {
    /**
     * Executes an operation only if permissions are granted.
     * @param {string} operation - 'READ' or 'WRITE'
     * @param {string} tableId - The ID of the table being accessed
     * @param {Function} action - Async function to execute if authorized
     * @returns {Promise<any>} Result of the action
     */
    static async run(operation, tableId, action) {
        const state = GlobalStateManager.getInstance();
        const config = state.getTableConfig(tableId);
        
        const context = {
            username: state.getCurrentUser(),
            role: state.getCurrentRole(),
            permissions: state.getPermissions(),
            teams: state.getCurrentTeams(),
            category: config?.category
        };

        let isAuthorized = false;

        // ── Bootstrap/Login Exemption ─────────────────────────────
        // We allow anonymous READ access to the people table so the login dialog can show names.
        const isPeopleTable = tableId === 'tbl_people' || tableId === 'people_table';
        const isBootConfig = tableId === 'table_definitions' || tableId === 'app_config';
        if (operation === 'READ' && !context.username && (isPeopleTable || isBootConfig)) {
            isAuthorized = true;
        } else if (operation === 'READ') {
            isAuthorized = PermissionService.canViewTable(tableId, context);
        } else if (operation === 'WRITE') {
            isAuthorized = PermissionService.canEditTable(tableId, context);
        }

        if (!isAuthorized) {
            const errorMsg = `Zugriff verweigert: ${operation}-Berechtigung für "${tableId}" fehlt.`;
            console.error(`[AccessGuard] Authorization failed for ${context.username} on ${tableId}`, context);
            throw new Error(errorMsg);
        }

        return await action();
    }
}
