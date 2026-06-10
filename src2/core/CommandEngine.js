import { eventBus } from "../events/EventBus";

export class CommandEngine {
    constructor() {
        this.teams = [];
        this.staticCommands = [
            {
                name: 'reload',
                description: 'App neu laden',
                action: () => window.location.reload()
            }
        ];
    }

    setTeams(teams) {
        this.teams = teams;
    }

    get commands() {
        const eventCommands = eventBus.getAvailableEvents().map(e => ({
            name: `emit ${e.channel} ${e.event}`,
            description: `[EventBus] Sendet Event an: ${e.channel}`,
            match: (query) => query.startsWith(`emit ${e.channel.toLowerCase()} ${e.event.toLowerCase()}`),
            action: (query) => {
                const parts = query.substring(5).trim().split(' ');
                const payloadStr = parts.slice(2).join(' ');

                let payload = {};
                if (payloadStr) {

                    try {
                        payload = JSON.parse(payloadStr);
                    } catch (err) {
                        payload = payloadStr;
                    }
                }
                eventBus.emit(e.channel, e.event, payload);
            }
        }));

        const navCommands = [];
        const baseUrl = import.meta.env.BASE_URL;

        for (const team of this.teams) {

            navCommands.push({
                name: `open ${team.name}`,
                description: `Öffnet das Team: ${team.name}`,
                action: () => {
                    window.history.pushState({}, '', `${baseUrl}${encodeURIComponent(team.name)}`);
                    eventBus.emit('UI', 'URL_CHANGED');
                }
            });
            for (const group of team.groups || []) {

                navCommands.push({
                    name: `open ${group.name}`,
                    description: `Öffnet die Gruppe: ${group.name} (in Team ${team.name})`,
                    action: () => {
                        window.history.pushState({}, '', `${baseUrl}${encodeURIComponent(team.name)}/${encodeURIComponent(group.name)}`);
                        eventBus.emit('UI', 'URL_CHANGED');
                    }
                });
                for (const table of group.tables || []) {

                    const tableName = table.titel || table.name;
                    navCommands.push({
                        name: `open ${tableName}`,
                        description: `Öffnet die Tabelle: ${tableName} (in Gruppe ${group.name})`,
                        action: () => {
                            window.history.pushState({}, '', `${baseUrl}${encodeURIComponent(team.name)}/${encodeURIComponent(group.name)}/${encodeURIComponent(tableName)}`);
                            eventBus.emit('UI', 'URL_CHANGED');
                        }
                    });
                }
            }
        }

        return [...this.staticCommands, ...eventCommands, ...navCommands];
    }

    getSuggestions(query) {
        const lowerQuery = query.toLowerCase();

        return this.commands.filter(cmd => {

            if (cmd.match && cmd.match(lowerQuery)) return true;

            return cmd.name.toLowerCase().includes(lowerQuery) ||
                cmd.description.toLowerCase().includes(lowerQuery);
        });
    }
}

export const commandEngine = new CommandEngine();
