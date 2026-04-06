import '../styles/CalendarView.css';
import { contextMenu } from './ContextMenu.js';
import { Dialog } from './Dialog.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';

export class CalendarView {
    constructor({ eventsTable }) {
        this.eventsTable = eventsTable;
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
                        this._updateUI(); // Refresh calendar to show/hide heart if we added one (though we haven't yet)
                    },
                    onEdit: canEdit ? () => {
                        // Open editing for the name field by default
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
        const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
        const lastDateOfPrevMonth = new Date(year, month, 0).getDate();
        
        // Adjust 0 (Sunday) to be 6 (Monday start)
        const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
        
        let html = '';
        
        // Prev month days
        for (let i = offset; i > 0; i--) {
            html += `<div class="calendar-day other-month">
                <span class="calendar-day-num">${lastDateOfPrevMonth - i + 1}</span>
            </div>`;
        }
        
        const events = this.eventsTable?.rows || [];
        const today = new Date();

        // Current month days
        for (let i = 1; i <= lastDateOfMonth; i++) {
            const isToday = today.getDate() === i && today.getMonth() === month && today.getFullYear() === year;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            const dayEvents = events.filter(e => e.data.date === dateStr);
            
            html += `<div class="calendar-day ${isToday ? 'today' : ''}">
                <div class="calendar-day-top">
                    <span class="calendar-day-num">${i}</span>
                    <button class="calendar-add-btn" data-date="${dateStr}" title="Event zu diesem Tag hinzufügen">+</button>
                </div>
                <div class="calendar-events-list">
                    ${dayEvents.map(e => {
                        const games = (e.data.games || '').split(',').map(g => g.trim()).filter(g => g);
                        const isFav = GlobalStateManager.getInstance().isFavorite(e.id);
                        const locationName = e.data.location?.title || (typeof e.data.location === 'string' ? e.data.location : '');
                        return `
                            <div class="calendar-event-wrapper" data-event-id="${e.id}" draggable="true">
                                <button class="calendar-event-main" title="${e.data.name}${locationName ? ' @ ' + locationName : ''}">
                                    <span class="calendar-event-name">${isFav ? '❤️ ' : ''}${e.data.name}</span>
                                    ${locationName ? `<span class="calendar-event-location">${locationName}</span>` : ''}
                                </button>
                                <div class="calendar-event-games">
                                    ${games.map(g => `
                                        <button class="calendar-event-game-btn" title="Spiel ${g} anzeigen">
                                            ${g}
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>`;
        }
        
        // Next month filling
        const totalCells = html.split('<div class="calendar-day').length - 1;
        const remaining = 42 - totalCells;
        for (let i = 1; i <= remaining; i++) {
            html += `<div class="calendar-day other-month">
                <span class="calendar-day-num">${i}</span>
            </div>`;
        }
        
        return html;
    }

    changeMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this._updateUI();
    }
}
