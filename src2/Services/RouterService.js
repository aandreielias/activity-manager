import { eventBus } from "../events/EventBus";

export class RouterService {
    constructor(dataTables, teams) {
        this.dataTables = dataTables;
        this.teams = teams;

        window.addEventListener('popState', () => this.handleUrlChange());
        eventBus.on('UI', 'URL_CHANGED', () => this.handleUrlChange());

        this.handleUrlChange();
    }

    handleUrlChange() {
        const baseUrl = import.meta.env.BASE_URL;
        let path = window.location.pathname;

        if (path.startsWith(baseUrl)) {
            path = path.substring(baseUrl.length);
        } else if (path === baseUrl.substring(0, baseUrl.length - 1)) {
            path = '';
        } else {
            path = path.substring(1);
        }

        if (!path) return;

        const [targetPath, rowIdEncoded] = path.split('@');
        const rowId = rowIdEncoded ? decodeURIComponent(rowIdEncoded) : undefined;

        const fieldName = window.location.hash ? decodeURIComponent(window.location.hash.substring(1)) : null;

        const targetPathDecoded = targetPath.split('/').map(s => decodeURIComponent(s)).filter(s => s.trim() !== '');

        let tablesToRender = [];
        let targetTableId = null;


        if (rowId) {
            const tableName = targetPathDecoded[targetPathDecoded.length - 1];
            const table = this.dataTables.find(t => t.name === tableName || t.titel === tableName);
            if (table) {
                tablesToRender = [table];
                targetTableId = table.id || table.name;
            }
        }

        else if (targetPathDecoded.length >= 3) {
            const tableName = targetPathDecoded[2];
            const table = this.dataTables.find(t => t.name === tableName || t.titel === tableName);
            if (table) {
                tablesToRender = [table];
                targetTableId = table.id || table.name;
            }
        }

        else if (targetPathDecoded.length === 2) {
            const [teamName, groupName] = targetPathDecoded;
            const team = this.teams.find(t => t.name === teamName);
            const group = team?.groups?.find(g => g.name === groupName);
            if (group) {
                tablesToRender = group.tables || [];
            }
        }

        else if (targetPathDecoded.length === 1) {
            const targetName = targetPathDecoded[0];
            const team = this.teams.find(t => t.name === targetName);

            if (team) {
                tablesToRender = team.groups?.flatMap(g => g.tables || []) || [];
            } else {
                for (const t of this.teams) {
                    const group = t.groups?.find(g => g.name === targetName);
                    if (group) {
                        tablesToRender = group.tables || [];
                        break;
                    }
                }

                if (tablesToRender.length === 0) {
                    const table = this.dataTables.find(t => t.name === targetName || t.titel === targetName);
                    if (table) {
                        tablesToRender = [table];
                        targetTableId = table.id || table.name;
                    }
                }
            }
        }



        if (tablesToRender.length > 0) {
            eventBus.emit('UI', 'NAV_GROUP_SELECTED', tablesToRender);
            if (rowId && targetTableId) {

                const searchText = window.history.state?.searchText || null;

                setTimeout(() => {
                    eventBus.emit('UI', 'NAVIGATE_TO_ROW', {
                        tableId: targetTableId,
                        rowId: rowId,
                        fieldName: fieldName,
                        searchText: searchText
                    });
                }, 100);
            }
        }
    }
}