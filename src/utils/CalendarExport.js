/**
 * CalendarExport - Utility for generating and downloading .ics files
 */
export class CalendarExport {
    static exportEvent(eventData, allTables = {}) {
        const { name, date, time, location, notes, games, responsible } = eventData;
        
        const peopleTable = allTables['tbl_people']?.instance;
        const people = peopleTable?.rows.map(r => r.data) || [];

        // 1. Parse date and time
        const [startTime, endTime] = (time || '18:30 - 21:00').split(' - ');
        
        const formatICSDate = (d, t) => {
            if (!d) return '';
            const cleanDate = d.replace(/-/g, '');
            const cleanTime = (t || '00:00').replace(/:/g, '').substring(0, 4);
            return `${cleanDate}T${cleanTime}00`;
        };

        const startStr = formatICSDate(date, startTime);
        const endStr = formatICSDate(date, endTime);

        // 2. Prepare metadata
        const summary = name || 'Activity Manager Event';
        
        // Location processing: Full Address (Straße Addresszusatz, PLZ Ort)
        let loc = '';
        if (typeof location === 'object' && location !== null) {
            const parts = [];
            const streetLine = [location.street || '', location.address_extra || ''].filter(Boolean).join(' ');
            if (streetLine) parts.push(streetLine);
            const cityLine = [location.zip_code || '', location.city || ''].filter(Boolean).join(' ');
            if (cityLine) parts.push(cityLine);
            loc = parts.join(', ');
            if (!loc && location.title) loc = location.title;
        } else if (typeof location === 'string') {
            loc = location;
        }
        
        let desc = notes || '';

        // Add Event Responsibility
        if (responsible) {
            const respPerson = people.find(p => p.id === responsible);
            if (respPerson) {
                const fullName = `${respPerson.vorname} ${respPerson.nachname || ''}`.trim();
                desc += (desc ? '\n' : '') + `Verantwortlicher: ${fullName}`;
            }
        }

        if (games) {
            let gameEntries = [];
            try {
                // Determine if 'games' is a string or already an array
                const parsed = (typeof games === 'string') ? JSON.parse(games) : games;
                if (Array.isArray(parsed)) {
                    // Item format from EventGamesField: { name, responsible (id) }
                    gameEntries = parsed;
                }
            } catch (e) {
                if (typeof games === 'string') {
                    gameEntries = games.split(',').map(g => ({ name: g.trim() }));
                }
            }

            if (gameEntries.length > 0) {
                const gameDetails = gameEntries.map(entry => {
                    const gn = entry.name || entry.title || 'Unbekanntes Spiel';
                    let respId = entry.responsible;
                    
                    // If no specific person is assigned to this game *in this event*, 
                    // try to find the default responsible from the master tables
                    if (!respId) {
                        for (const tableEntry of Object.values(allTables)) {
                            const table = tableEntry.instance;
                            if (tableEntry.config?.category === 'spiele' && table?.rows) {
                                const foundRow = table.rows.find(r => r.data?.name === gn || r.data?.title === gn);
                                if (foundRow && foundRow.data?.responsible) {
                                    respId = foundRow.data.responsible;
                                    break;
                                }
                            }
                        }
                    }

                    if (respId) {
                        const p = people.find(x => x.id === respId);
                        if (p) {
                            return `${gn} (${p.vorname} ${p.nachname?.charAt(0) || ''}.)`;
                        }
                    }
                    return gn;
                });
                desc += (desc ? '\n\n' : '') + `Spiele: ${gameDetails.join(', ')}`;
            }
        }

        // 3. Build ICS content
        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Activity Manager//DE',
            'BEGIN:VEVENT',
            `UID:${crypto.randomUUID()}`,
            `DTSTAMP:${new Date().toISOString().replace(/[-:.]/g, '').substring(0, 15)}Z`,
            `DTSTART:${startStr}`,
            `DTEND:${endStr}`,
            `SUMMARY:${summary}`,
            `LOCATION:${loc}`,
            `DESCRIPTION:${desc.replace(/\n/g, '\\n')}`,
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        // 4. Trigger download
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${summary.replace(/\s+/g, '_')}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
