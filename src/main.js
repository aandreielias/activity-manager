import './styles/main.css';
import { Header } from './ui/Header.js';
import { TableView } from './ui/TableView.js';

const app = document.getElementById('app');

const header = new Header({

    appName: 'Activity Manager',
    onThemeToggle: (isDark) => console.log('theme:', isDark ? 'dark' : 'light'),
});
app.appendChild(header.render());


const main = document.createElement('main');
main.style.cssText = 'padding: 28px; display: flex; flex-direction: column; gap: 20px;';
app.appendChild(main);

const activitiesTable = new TableView({

    tableId: 'tbl_activities',
    title: 'Activities',
    columns: [
        { id: 'title',      label: 'Title' },
        { id: 'sport_type', label: 'Sport' },
        { id: 'place',      label: 'Place' },
        { id: 'date',       label: 'Date' },
        { id: 'status',     label: 'Status' },
    ],
    rows: [
        { id: 'r1', title: 'Friday Volleyball', sport_type: 'Volleyball', place: 'Parish Hall', date: '2025-04-04', status: 'Planned' },
        { id: 'r2', title: 'Sunday Soccer',     sport_type: 'Soccer',     place: 'City Park',   date: '2025-04-06', status: 'Done' },
    ],
});

main.appendChild(activitiesTable.render());