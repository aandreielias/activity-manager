import '../styles/CalendarView.css';
import { contextMenu } from './ContextMenu.js';
import { CalendarExport } from '../utils/CalendarExport.js';
import { Dialog } from './Dialog.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';

export class CalendarView {
    constructor({ eventsTable, allTables }) {
        this.eventsTable = eventsTable;
        this.allTables = allTables;
        this.currentDate = new Date();
        this.element = null;
        this.months = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
        this.days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'calendar-view-container';
        this._updateUI();
        return this.element;
    }

    _updateUI() {
        if (!this.element) return;
        this.element.innerHTML = `
            <div class="calendar-header">
                <button class="calendar-nav-btn prev-month" aria-label="Vorheriger Monat">❮</button>
                <h2>${this.months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}</h2>
                <button class="calendar-nav-btn next-month" aria-label="Nächster Monat">❯</button>
            </div>
            <div class="calendar-grid">
                ${this.days.map(d => `<div class="calendar-day-header">${d}</div>`).join('')}
                ${this._generateDaysHTML()}
            </div>
        `;

        this.element.querySelector('.prev-month').addEventListener('click', () => this.changeMonth(-1));
        this.element.querySelector('.next-month').addEventListener('click', () => this.changeMonth(1));

        // Handle event clicks
        this.element.querySelectorAll('.calendar-event-main').forEach(el => {
            el.onclick = (e) => {
                e.stopPropagation();
                const eventId = el.closest('.calendar-event-wrapper').dataset.eventId;
                this.onEventClick?.(eventId);
            };
        });

        // Context Menu
        this.element.querySelectorAll('.calendar-event-wrapper').forEach(wrapper => {
            wrapper.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const eventId = wrapper.dataset.eventId;
                const row = this.eventsTable.rows.find(r => r.id === eventId);
                if (!row) return;

                const globalState = GlobalStateManager.getInstance();
                const canEdit = globalState.canEdit(this.eventsTable.id);

                contextMenu.show(e.clientX, e.clientY, {
                    isFavorite: globalState.isFavorite(row.id),
                    onToggleFavorite: () => {
                        row.toggleFavorite();
                        this._updateUI();
                    },
                    onExportToCalendar: () => CalendarExport.exportEvent(row.data, this.allTables),
                    onEdit: canEdit ? () => {
                        row.fields.name?.startEditing();
                    } : null,
                    onDelete: canEdit ? () => {
                        this.eventsTable.removeRow(row.id);
                        this._updateUI();
                    } : null,
                    onShowInfo: () => {
                        const dateStr = row.createdAt ? new Date(row.createdAt).toLocaleString('de-DE') : 'Unbekannt';
                        Dialog.alert({
                            title: 'Eintragsinformationen',
                            message: `Erstellt von: ${row.createdBy}\nErstellt am: ${dateStr}`
                        });
                    }
                });
            };
        });

        // Drag & Drop
        this.element.querySelectorAll('.calendar-event-wrapper').forEach(el => {
            el.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', el.dataset.eventId);
                el.classList.add('dragging');
            };
            el.ondragend = () => {
                el.classList.remove('dragging');
            };
        });

        this.element.querySelectorAll('.calendar-day:not(.other-month)').forEach(day => {
            day.ondragover = (e) => {
                e.preventDefault();
                day.classList.add('drag-over');
            };
            day.ondragleave = () => {
                day.classList.remove('drag-over');
            };
            day.ondrop = async (e) => {
                e.preventDefault();
                day.classList.remove('drag-over');

                const eventId = e.dataTransfer.getData('text/plain');
                const newDate = day.querySelector('.calendar-add-btn')?.dataset.date;

                if (eventId && newDate) {
                    const row = this.eventsTable.rows.find(r => r.id === eventId);
                    if (row && row.data.date !== newDate) {
                        row.fields.date?.saveEdit(newDate);
                        this._updateUI();
                    }
                }
            };
        });

        // Handle game tag clicks
        this.element.querySelectorAll('.calendar-event-game-btn').forEach(el => {
            el.onclick = (e) => {
                e.stopPropagation();
                const gameName = el.textContent.trim();
                this.onGameClick?.(gameName);
            };
        });

        // Handle add event clicks
        this.element.querySelectorAll('.calendar-add-btn').forEach(el => {
            el.onclick = (e) => {
                e.stopPropagation();
                const dateStr = el.dataset.date;
                this.onAddEvent?.(dateStr);
            };
        });
    }

    _generateDaysHTML() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
        const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

        const startDate = new Date(year, month, 1);
        startDate.setDate(startDate.getDate() - offset);

        let html = '';
        const events = this.eventsTable?.rows || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 42; i++) {
            const currentCellDate = new Date(startDate);
            currentCellDate.setDate(startDate.getDate() + i);

            const isOtherMonth = currentCellDate.getMonth() !== month;
            const isToday = currentCellDate.getTime() === today.getTime();
            const dateStr = `${currentCellDate.getFullYear()}-${String(currentCellDate.getMonth() + 1).padStart(2, '0')}-${String(currentCellDate.getDate()).padStart(2, '0')}`;
            const isPast = currentCellDate < today;

            const isMonday = i % 7 === 0;
            let kwHtml = '';
            if (isMonday) {
                const kw = this._getISOWeek(currentCellDate);
                kwHtml = `<span class="calendar-kw">KW ${kw}</span>`;
            }

            if (isOtherMonth) {
                html += `<div class="calendar-day other-month">
                    <div class="calendar-day-top">
                        <div class="calendar-day-info">
                            <span class="calendar-day-num">${currentCellDate.getDate()}</span>
                            ${kwHtml}
                        </div>
                    </div>
                </div>`;
            } else {
                const dayEvents = events.filter(e => e.data.date === dateStr);
                html += `<div class="calendar-day ${isToday ? 'today' : ''}">
                    <div class="calendar-day-top">
                        <div class="calendar-day-info">
                            <span class="calendar-day-num">${currentCellDate.getDate()}</span>
                            ${kwHtml}
                        </div>
                        <button class="calendar-add-btn" data-date="${dateStr}" title="Event zu diesem Tag hinzufügen">+</button>
                    </div>
                    <div class="calendar-events-list">
                        ${dayEvents.map(e => {
        let games = [];
        try {
            const parsed = JSON.parse(e.data.games || '[]');
            games = Array.isArray(parsed) ? parsed.map(g => (typeof g === 'string' ? g : g.name)) : [];
        } catch (err) {
            games = (e.data.games || '').split(',').map(g => g.trim()).filter(g => g);
        }

        const isFav = GlobalStateManager.getInstance().isFavorite(e.id);
        const locationName = e.data.location?.title || (typeof e.data.location === 'string' ? e.data.location : '');

        const statusClass = (e.data.status || '').toLowerCase().replace(/\s+/g, '-');
        const pastClass = isPast ? 'is-past' : '';

        return `
                                <div class="calendar-event-wrapper" data-event-id="${e.id}" draggable="true">
                                    <button class="calendar-event-main ${statusClass ? 'status-' + statusClass : ''} ${pastClass}" title="${e.data.name}${locationName ? ' @ ' + locationName : ''}">
                                        <span class="calendar-event-name">${isFav ? '❤️ ' : ''}${e.data.name}</span>
                                        ${locationName ? `<span class="calendar-event-location">${locationName}</span>` : ''}
                                    </button>
                                    <div class="calendar-event-games">
                                        ${games.map(g => {
        const gameStatus = this._getGameStatus(g);
        const gameStatusClass = gameStatus ? 'status-' + gameStatus.toLowerCase().replace(/\s+/g, '-') : '';
        return `
                                                <button class="calendar-event-game-btn ${gameStatusClass}" title="Spiel ${g} anzeigen (Status: ${gameStatus || '?'})">
                                                    ${g}
                                                </button>
                                            `;
    }).join('')}
                                    </div>
                                </div>
                            `;
    }).join('')}
                    </div>
                </div>`;
            }
        }

        return html;
    }

    _getISOWeek(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    _getGameStatus(gameName) {
        if (!this.allTables) return null;
        for (const [id, tableInfo] of Object.entries(this.allTables)) {
            if (tableInfo.config.category !== 'spiele') continue;
            const row = tableInfo.instance.rows.find(r => r.data.name === gameName);
            if (row) {
                return row.data.status || 'To Do';
            }
        }
        return null;
    }

    changeMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this._updateUI();
    }
}
