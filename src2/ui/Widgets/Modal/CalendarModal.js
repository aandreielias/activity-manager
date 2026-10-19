import { eventBus } from "../../../events/EventBus.js";
import { BaseModal } from "./BaseModal.js";

export class CalendarModal extends BaseModal {
    constructor(dataTables) {
        super("Kalendar");
        this.dataTables = dataTables;
        this.currentDate = new Date();
    }

    open() {
        super.open();
        const windowEl = this.modalElement.querySelector('.modal-window');
        if (windowEl) {
            windowEl.style.width = '90vw';
            windowEl.style.maxWidth = '1000px';
        }
    }

    renderBody(container) {
        this.calendarContainer = document.createElement('div');
        this.calendarContainer.classList.add('calendar-wrapper');
        this.calendarContainer.style.width = '100%';
        this.calendarContainer.style.height = '60vh';
        this.calendarContainer.style.display = 'flex';
        this.calendarContainer.style.flexDirection = 'column';
        container.appendChild(this.calendarContainer);

        this.renderCalendar();
    }

    getEvents() {
        const events = [];
        this.dataTables.forEach(table => {
            const dateFields = table.fields?.filter(f => {
                const type = f.type ? f.type.toLowerCase() : '';
                return type.includes('date') || type.includes('time');
            });

            if (dateFields && dateFields.length > 0) {

                table.rows?.forEach(row => {

                    dateFields.forEach(df => {

                        const dateVal = row.data[df.name];

                        if (dateVal) {
                            const parsedDate = new Date(dateVal);

                            if (!isNaN(parsedDate.getTime())) {
                                events.push({
                                    date: parsedDate,
                                    label: typeof row.getLabel === 'function' ? row.getLabel() : (row.data.name || row.data.titel || row.id),
                                    tableDef: table,
                                    tableName: table.titel || table.name,
                                    rowId: row.id,
                                    fieldName: df.name,
                                    fieldLabel: df.titel || df.name
                                });
                            }
                        }
                    });
                });
            }
        });

        return events;
    }

    renderCalendar() {
        this.calendarContainer.innerHTML = '';

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const allEvents = this.getEvents();

        const headerControls = document.createElement('div');
        headerControls.classList.add('calendar-controls');

        const prevBtn = document.createElement('button');

        prevBtn.textContent = '◀';
        prevBtn.addEventListener('click', () => {
            this.currentDate.setMonth(month - 1);
            this.renderCalendar();
        });

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '▶';

        nextBtn.addEventListener('click', () => {
            this.currentDate.setMonth(month + 1);
            this.renderCalendar();
        });

        const monthLabel = document.createElement('div');

        monthLabel.classList.add('calendar-month-label');
        monthLabel.textContent = this.currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

        headerControls.appendChild(prevBtn);
        headerControls.appendChild(monthLabel);
        headerControls.appendChild(nextBtn);

        this.calendarContainer.appendChild(headerControls);

        const table = document.createElement('table');
        table.classList.add('data-table', 'calendar-table');
        table.style.width = '100%';
        table.style.tableLayout = 'fixed';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        const daysOfWeek = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        daysOfWeek.forEach(day => {
            const th = document.createElement('th');
            th.classList.add('table-header-th', 'calendar-day-header');
            th.textContent = day;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        let startOffset = firstDay.getDay() - 1;
        if (startOffset === -1) startOffset = 6;

        let currentRow = document.createElement('tr');

        for (let i = 0; i < startOffset; i++) {
            const emptyCell = document.createElement('td');
            emptyCell.classList.add('ui-table-cell', 'calendar-cell-empty');
            currentRow.appendChild(emptyCell);
        }

        for (let d = 1; d <= lastDay.getDate(); d++) {
            if (currentRow.children.length === 7) {
                tbody.appendChild(currentRow);
                currentRow = document.createElement('tr');
            }

            const cell = document.createElement('td');
            cell.classList.add('ui-table-cell', 'calendar-cell');

            const dateSpan = document.createElement('div');
            dateSpan.classList.add('calendar-date-number');
            dateSpan.textContent = d;

            const today = new Date();

            if (year === today.getFullYear() && month === today.getMonth() && d === today.getDate()) {
                cell.classList.add('calendar-cell-today');
            }

            cell.appendChild(dateSpan);

            const dayEvents = allEvents.filter(e => e.date.getFullYear() === year && e.date.getMonth() === month && e.date.getDate() === d);
            const eventsContainer = document.createElement('div');

            eventsContainer.classList.add('calendar-events-container');
            dayEvents.forEach(e => {
                const eventBadge = document.createElement('div');
                eventBadge.classList.add('calendar-event-badge');
                eventBadge.textContent = `${e.tableName}: ${e.label}`;
                eventBadge.title = `${e.tableName} - ${e.fieldLabel}: ${e.label}`;

                eventBadge.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    this.navigate(e);
                });
                eventsContainer.appendChild(eventBadge);
            });

            cell.appendChild(eventsContainer);
            currentRow.appendChild(cell);
        }

        while (currentRow.children.length < 7) {
            const emptyCell = document.createElement('td');
            emptyCell.classList.add('ui-table-cell', 'calendar-cell-empty');
            currentRow.appendChild(emptyCell);
        }

        if (currentRow.children.length > 0) {
            tbody.appendChild(currentRow);
        }

        table.appendChild(tbody);

        const scrollWrapper = document.createElement('div');
        scrollWrapper.classList.add('table-scroll-wrapper');
        scrollWrapper.appendChild(table);

        this.calendarContainer.appendChild(scrollWrapper);
    }
    navigate(eventData) {
        this.close();

        const targetName = eventData.tableDef ? (eventData.tableDef.titel || eventData.tableDef.name) : eventData.tableName;
        const newUrl = `${import.meta.env.BASE_URL}${encodeURIComponent(targetName)}${eventData.rowId ? '@' + encodeURIComponent(eventData.rowId) : ''}${eventData.fieldName ? '#' + encodeURIComponent(eventData.fieldName) : ''}`;

        window.history.pushState({}, '', newUrl);
        eventBus.emit('UI', 'URL_CHANGED');
    }

}