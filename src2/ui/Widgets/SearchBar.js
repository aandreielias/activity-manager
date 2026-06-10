import { eventBus } from '../../events/EventBus.js';
import { FieldBuilder } from '../Builders/Table/FieldBuilder.js';
import { commandEngine } from '../../core/CommandEngine.js';

export class SearchBar {
    constructor(tablesProvider) {
        this.tablesProvider = tablesProvider;
        this.container = document.createElement('div');
        this.container.classList.add('search-bar-wrapper');
    }

    build() {
        this.container.innerHTML = '';

        const inputGroup = document.createElement('div');
        inputGroup.classList.add('search-input-group');

        const searchInput = document.createElement('input');
        searchInput.classList.add('search-input');
        searchInput.type = 'text';
        searchInput.placeholder = '';

        const searchBtn = document.createElement('button');
        searchBtn.classList.add('search-btn');
        searchBtn.innerHTML = 'Suche';

        inputGroup.appendChild(searchInput);
        inputGroup.appendChild(searchBtn);
        this.container.appendChild(inputGroup);

        this.dropdown = document.createElement('div');
        this.dropdown.classList.add('search-dropdown');
        this.container.appendChild(this.dropdown);

        const executeSearch = () => {

            const text = searchInput.value.trim();

            if (!text) {
                this.dropdown.style.display = 'none';
                return;
            }

            if (text.startsWith('--')) {
                const cmdQuery = text.substring(2).trim();

                if (cmdQuery.length > 0) {
                    const suggestions = commandEngine.getSuggestions(cmdQuery);
                    this._renderCommandSuggestions(suggestions, cmdQuery);
                } else {
                    this.dropdown.style.display = 'none';
                }
                return;
            }

            const tables = typeof this.tablesProvider === 'function' ? this.tablesProvider() : this.tablesProvider;

            eventBus.emit('FILTER', 'GLOBAL_SEARCH', {
                tables: tables,
                text: text,
                callback: (results) => this._renderResults(results, text)
            });
        };

        let timeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(executeSearch, 300);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const text = searchInput.value.trim();

                if (text.startsWith('--')) {
                    const cmdQuery = text.substring(2).trim();
                    if (cmdQuery.length > 0) {
                        const suggestions = commandEngine.getSuggestions(cmdQuery);
                        if (suggestions.length > 0) {

                            suggestions[0].action(cmdQuery);
                            this.dropdown.style.display = 'none';
                            searchInput.value = '';
                        }
                    }
                }
            }
        });

        searchBtn.addEventListener('click', executeSearch);

        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.dropdown.style.display = 'none';
            }
        });

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault();

                searchInput.focus();
                searchInput.select();
            }
        });

        return this.container;
    }

    _renderCommandSuggestions(suggestions, query) {
        this.dropdown.innerHTML = '';
        if (suggestions.length === 0) {

            const emptyState = document.createElement('div');
            emptyState.classList.add('search-empty');
            emptyState.textContent = 'Unbekannter Befehl: ' + query;

            this.dropdown.appendChild(emptyState);

        } else {
            suggestions.forEach(cmd => {
                const headerHtml = `<span style="font-weight: 800; font-size: 13px; color: var(--color-primary);">Command</span> <span style="font-weight: 500;">• ${cmd.name}</span>`;

                const descTd = document.createElement('td');
                descTd.textContent = cmd.description;

                const item = this._createMiniTableItem(headerHtml, descTd, () => {
                    cmd.action(query);
                    this.dropdown.style.display = 'none';
                    const searchInput = this.container.querySelector('.search-input');
                    if (searchInput) searchInput.value = '';
                });

                this.dropdown.appendChild(item);
            });
        }
        this.dropdown.style.display = 'block';
    }


    _renderResults(results, searchText = '') {
        this.dropdown.innerHTML = '';

        if (results.length === 0) {
            const emptyState = document.createElement('div');

            emptyState.classList.add('search-empty');
            emptyState.textContent = 'No matching records found.';

            this.dropdown.appendChild(emptyState);
        } else {

            const tables = typeof this.tablesProvider === 'function' ? this.tablesProvider() : this.tablesProvider;

            results.forEach(res => {
                const item = document.createElement('div');
                item.classList.add('search-item');

                const titleRow = document.createElement('div');
                titleRow.classList.add('search-item-title');
                titleRow.textContent = `${res.tableName} • ID: ${res.rowId} • Feld: ${res.fieldLabel}`;

                const detailRow = document.createElement('div');
                detailRow.classList.add('search-item-detail');

                const tableDef = tables.find(t => t.id === res.tableId || t.name === res.tableName);
                const fieldMeta = tableDef?.fields?.find(f => f.name === res.fieldName);

                if (fieldMeta && res.row) {
                    const headerHtml = `<span style="font-weight: 800; font-size: 13px; color: var(--text-primary);">${res.tableName}</span> <span style="font-weight: 500;">• ID: ${res.rowId} • Feld: ${res.fieldLabel}</span>`;

                    const fieldTd = new FieldBuilder(fieldMeta, res.row).build();

                    if (searchText && fieldTd.textContent) {

                        const cellText = fieldTd.textContent;
                        const matchIndex = cellText.toLowerCase().indexOf(searchText.toLowerCase());

                        if (matchIndex !== -1) {
                            const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                            const before = cellText.substring(0, matchIndex);
                            const match = cellText.substring(matchIndex, matchIndex + searchText.length);
                            const after = cellText.substring(matchIndex + searchText.length);

                            fieldTd.innerHTML = `${escapeHtml(before)}<mark style="background: #fef08a; color: #1a202c; padding: 0 2px; border-radius: 2px;">${escapeHtml(match)}</mark>${escapeHtml(after)}`;
                        }
                    }

                    const item = this._createMiniTableItem(headerHtml, fieldTd, (e) => {

                        if (e.target.closest('.table-field') || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
                        this.dropdown.style.display = 'none';

                        const targetName = tableDef ? (tableDef.titel || tableDef.name) : res.tableName;
                        const newUrl = `${import.meta.env.BASE_URL}${encodeURIComponent(targetName)}${res.rowId ? '@' + encodeURIComponent(res.rowId) : ''}${res.fieldName ? '#' + encodeURIComponent(res.fieldName) : ''}`;

                        window.history.pushState({ searchText }, '', newUrl);
                        eventBus.emit('UI', 'URL_CHANGED');
                        const searchInput = this.container.querySelector('.search-input');

                        if (searchInput) searchInput.value = '';
                    });

                    this.dropdown.appendChild(item);
                } else {

                    const titleRow = document.createElement('div');

                    titleRow.classList.add('search-item-title');
                    titleRow.innerHTML = `<strong style="font-weight: 800;">${res.tableName}</strong> • ID: ${res.rowId} • Feld: ${res.fieldLabel}`;

                    const detailRow = document.createElement('div');

                    detailRow.classList.add('search-item-detail');
                    detailRow.textContent = `Kein editierbares Feld gefunden`;

                    item.appendChild(titleRow);
                    item.appendChild(detailRow);

                }

                item.addEventListener('click', (e) => {
                    if (e.target.closest('.table-field') || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                        return;
                    }

                    this.dropdown.style.display = 'none';

                    const targetName = tableDef ? (tableDef.titel || tableDef.name) : res.tableName;
                    const rowPart = res.rowId ? `@${encodeURIComponent(res.rowId)}` : '';
                    const fieldPart = res.fieldName ? `#${encodeURIComponent(res.fieldName)}` : '';

                    const baseUrl = import.meta.env.BASE_URL;
                    const newUrl = `${baseUrl}${encodeURIComponent(targetName)}${rowPart}${fieldPart}`;

                    window.history.pushState({ searchText: searchText }, '', newUrl);
                    eventBus.emit('UI', 'URL_CHANGED');

                    const searchInput = this.container.querySelector('.search-input');
                    if (searchInput) searchInput.value = '';
                });
                this.dropdown.appendChild(item);
            });
        }

        this.dropdown.style.display = 'block';
    }

    _createMiniTableItem(headerHtml, contentTd, onClick) {
        const item = document.createElement('div');
        item.classList.add('search-item');
        item.style.cursor = 'pointer';

        const miniTable = document.createElement('table');
        miniTable.classList.add('ui-table');
        miniTable.style.border = 'var(--border-default)';
        miniTable.style.borderRadius = 'var(--radius-md)';
        miniTable.style.overflow = 'hidden';
        miniTable.style.boxShadow = 'var(--shadow-sm)';
        miniTable.style.margin = '4px 0';

        const thead = document.createElement('thead');
        const headerTr = document.createElement('tr');
        const th = document.createElement('th');

        th.style.textTransform = 'none';
        th.style.letterSpacing = 'normal';
        th.style.borderRight = 'none';
        th.innerHTML = headerHtml;

        headerTr.appendChild(th);
        thead.appendChild(headerTr);

        const tbody = document.createElement('tbody');
        const bodyTr = document.createElement('tr');

        bodyTr.style.borderBottom = 'none';
        contentTd.classList.add('ui-table-cell', 'table-field');
        contentTd.style.borderRight = 'none';

        bodyTr.appendChild(contentTd);
        tbody.appendChild(bodyTr);

        miniTable.appendChild(thead);
        miniTable.appendChild(tbody);

        item.appendChild(miniTable);
        item.addEventListener('click', onClick);

        return item;
    }
}
