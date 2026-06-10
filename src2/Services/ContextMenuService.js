import { eventBus } from '../events/EventBus.js';

export class ContextMenuService {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'global-context-menu';

        Object.assign(this.container.style, {
            position: 'fixed',
            zIndex: '9999',
            display: 'none',
            boxShadow: 'var(--shadow-xl)',
            borderRadius: 'var(--radius-md)',
            border: 'var(--border-default)',
            backgroundColor: 'var(--bg)'
        });

        document.body.appendChild(this.container);
        this._initListeners();
    }

    _initListeners() {
        eventBus.on('UI', 'SHOW_CONTEXT_MENU', (data) => this.show(data));

        document.addEventListener('click', (e) => {
            if (this.container.style.display === 'block' && !this.container.contains(e.target)) {
                this.hide();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.container.style.display === 'block') {
                this.hide();
            }
        });

        document.addEventListener('scroll', () => {
            if (this.container.style.display === 'block') this.hide();
        }, { capture: true });
    }

    show({ x, y, title, items }) {
        this.container.innerHTML = '';

        const table = document.createElement('table');
        table.classList.add('ui-table');
        table.style.border = 'var(--border-default)';
        table.style.borderRadius = 'var(--radius-md)';
        table.style.overflow = 'hidden';
        table.style.margin = '0';
        table.style.width = 'max-content';
        table.style.minWidth = '180px';


        if (title) {
            const thead = document.createElement('thead');
            const headerTr = document.createElement('tr');
            const th = document.createElement('th');
            th.style.textTransform = 'none';
            th.style.letterSpacing = 'normal';
            th.style.borderRight = 'none';
            th.innerHTML = `<span style="font-weight: 800; font-size: 13px; color: var(--text-primary);">${title}</span>`;

            headerTr.appendChild(th);
            thead.appendChild(headerTr);
            table.appendChild(thead);
        }

        const tbody = document.createElement('tbody');

        items.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.style.transition = 'background-color 0.15s ease';

            if (index === items.length - 1) {
                tr.style.borderBottom = 'none';
            }

            tr.addEventListener('mouseenter', () => tr.style.backgroundColor = 'var(--bg-secondary)');
            tr.addEventListener('mouseleave', () => tr.style.backgroundColor = '');

            const td = document.createElement('td');
            td.classList.add('ui-table-cell');
            td.style.borderRight = 'none';

            const iconHtml = item.icon ? `<span style="margin-right: 10px; font-size: 14px;">${item.icon}</span>` : '';
            const colorStyle = item.color ? `color: ${item.color};` : 'color: var(--text-primary);';

            td.innerHTML = `<div style="display: flex; align-items: center; font-weight: 500; ${colorStyle}">${iconHtml}${item.label}</div>`;

            tr.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide();
                if (item.action) item.action();
            });

            tr.appendChild(td);
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        this.container.appendChild(table);

        this.container.style.display = 'block';
        this.container.style.visibility = 'hidden';

        const rect = this.container.getBoundingClientRect();
        let posX = x;
        let posY = y;

        if (posX + rect.width > window.innerWidth) posX = window.innerWidth - rect.width - 5;
        if (posY + rect.height > window.innerHeight) posY = window.innerHeight - rect.height - 5;

        this.container.style.left = `${posX}px`;
        this.container.style.top = `${posY}px`;
        this.container.style.visibility = 'visible';
    }

    hide() {
        this.container.style.display = 'none';
    }
}
