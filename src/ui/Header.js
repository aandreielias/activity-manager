import '../styles/Header.css';
import { GlobalStateManager } from '../core/GlobalStateManager.js';
import { AuditLogsDialog } from './AuditLogsDialog.js';

/**
 * Header - Main application header with navigation and theme toggle (Cleaned).
 * All Edit Mode and administrative creation tools have been removed.
 */
export class Header {
    constructor({ appName = 'Activity Manager', onThemeToggle, onTableSwitch, tableConfigs = [], tables = {} }) {
        this.appName = appName;
        this.onThemeToggle = onThemeToggle;
        this.onTableSwitch = onTableSwitch;
        this.onCalendarToggle = null;
        this.tableConfigs = tableConfigs;
        this.tables = tables;
        this.currentTable = tableConfigs[0]?.id || 'games';
        this.element = null;
        this.personsSplitOpen = false;
        this.inventorySplitOpen = false;
        this.calendarSplitOpen = false;
        this.onFavoritesToggle = null;
        this.onLogoDoubleClick = null;
        this.onCalendarFull = null;
        this.favoritesActive = false;
        this.currentResults = [];
        this.selectedIndex = -1;
        this.version = this._getVersion();

        GlobalStateManager.getInstance().onFlashMessageCallback((msg, type) => this.showFlash(msg, type));
    }

    _getVersion() {
        return '2.6.1';
    }

    render() {
        this.element = document.createElement('header');
        this.element.className = 'app-header';
        this.element.innerHTML = this._getHeaderHTML();

        this._attachEventListeners();
        this._updateThemeUI();

        return this.element;
    }

    _updateThemeUI() {
        if (!this.element) return;
        const isDark = document.documentElement.dataset.theme === 'dark';
        const icon = this.element.querySelector('.theme-icon');
        if (icon) {
            icon.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        }
        const btn = this.element.querySelector('.theme-toggle');
        if (btn) {
            btn.title = isDark ? 'Lichtmodus umschalten' : 'Dunkelmodus umschalten';
        }
    }

    _getHeaderHTML() {
        const globalState = GlobalStateManager.getInstance();
        const viewableConfigs = this.tableConfigs.filter(t => globalState.canView(t.id));

        const spieleTables = viewableConfigs.filter(t => t.category === 'spiele');
        const sportTables = viewableConfigs.filter(t => t.category === 'sportarten');
        const organisationTables = viewableConfigs.filter(t => t.category === 'organisation' && !t.id.includes('people'));
        const otherTables = viewableConfigs.filter(t => !['spiele', 'sportarten', 'organisation'].includes(t.category));

        return `
            <div class="header-left">
                <span class="header-logo">⬡</span>
                <div class="logo-stack">
                    <span class="header-title">${this.appName}</span>
                    <span class="header-version">v${this.version}</span>
                </div>
            </div>
            <nav class="header-nav">
                ${this._renderCategoryButton(spieleTables, 'spiele', 'Spiele')}
                ${this._renderCategoryButton(sportTables, 'sportarten', 'Sportarten')}
                ${this._renderCategoryButton(organisationTables, 'organisation', 'Organisation')}
                
                ${this._renderPersonenButton()}

                ${otherTables.map((config, idx) =>
            `<button class="nav-btn ${idx === 0 && spieleTables.length === 0 ? 'active' : ''}" data-table="${config.id}">${config.title}</button>`
        ).join('')}
            </nav>
            <div class="header-center">
                <div class="header-search-container">
                    <input type="text" class="header-search-input" placeholder="Suchen..." aria-label="Global search">
                    <div class="search-results-dropdown"></div>
                </div>
                <div class="flash-banner" style="display: none;"></div>
                <div class="unsaved-banner" style="display: none;">
                    <span class="unsaved-msg">Ungespeicherte Änderungen vorhanden</span>
                    <button class="save-btn-header">Speichern</button>
                    <button class="discard-btn-header">Verwerfen</button>
                    <div class="save-loading-bar"></div>
                </div>
            </div>
            <div class="header-right">
                ${globalState.canSeeStats() ? `
                <button class="nav-btn user-info-btn" title="System-Stats">
                    Stats
                </button>` : ''}
                <button class="nav-btn calendar-toggle-btn" title="Kalender öffnen">
                    Kalender
                </button>
                <div class="dropdown-container user-dropdown-container">
                    <button class="header-user user-menu-btn">
                        ${globalState.getCurrentUser()} <span class="dropdown-arrow" style="margin-left: 6px;">▼</span>
                    </button>
                    <div class="dropdown-menu user-dropdown-menu">
                        <button class="dropdown-item favorites-toggle-btn">Favoriten</button>
                        <button class="dropdown-item change-password-btn">Passwort ändern</button>
                        <button class="dropdown-item logout-btn">Abmelden</button>
                    </div>
                </div>
                <button class="theme-toggle" aria-label="Design umschalten" title="Dunkelmodus umschalten">
                    <span class="theme-icon">Dark Mode</span>
                </button>
            </div>
        `;
    }

    _renderPersonenButton() {
        const gs = GlobalStateManager.getInstance();
        const userTeams = gs.getCurrentTeams();
        const allTeams = gs.getAvailableTeams();

        // If user is restricted to specific teams, only show those in dropdown
        const viewableTeams = (userTeams.length > 0 && !gs.isAdmin() && !gs.isSuperAdmin())
            ? allTeams.filter(t => userTeams.includes(t.name))
            : allTeams;

        return `
            <div class="dropdown-container split-btn-group">
                <button class="nav-btn split-main-btn persons-toggle-btn" title="Personen-Seitenleiste umschalten">
                    Personen
                </button>
                <div class="split-divider"></div>
                <button class="nav-btn split-arrow-btn dropdown-btn" aria-label="Team-Auswahl öffnen">
                    <span class="dropdown-arrow">▼</span>
                </button>
                <div class="dropdown-menu">
                    ${viewableTeams.map(t => `<button class="dropdown-item" data-team="${t.name}">Team ${t.name}</button>`).join('')}
                </div>
            </div>
        `;
    }

    _renderCategoryButton(categoryTables, categoryId, categoryLabel) {
        if (categoryTables.length === 0) return '';

        if (categoryTables.length === 1) {
            const table = categoryTables[0];
            return `<button class="nav-btn ${this.currentTable === table.id ? 'active' : ''}" data-table="${table.id}">${table.title}</button>`;
        }

        return `
            <div class="dropdown-container split-btn-group">
                <button class="nav-btn split-main-btn" data-table="all-${categoryId}">
                    ${categoryLabel}
                </button>
                <div class="split-divider"></div>
                <button class="nav-btn split-arrow-btn dropdown-btn" aria-label="${categoryLabel} Menü öffnen">
                    <span class="dropdown-arrow">▼</span>
                </button>
                <div class="dropdown-menu">
                    ${categoryTables.map(t => `<button class="dropdown-item" data-table="${t.id}">${t.title}</button>`).join('')}
                </div>
            </div>
        `;
    }

    _attachEventListeners() {
        if (!this.element) return;

        this.element.addEventListener('click', async (e) => {
            const btn = e.target.closest('.nav-btn, .dropdown-item');
            if (btn && btn.dataset.table) {
                const tableId = btn.dataset.table;
                this.switchTo(tableId);
                this.onTableSwitch?.(tableId);
                this._closeAllDropdowns();
            }

            if (btn && btn.dataset.team) {
                const team = btn.dataset.team;
                e.stopPropagation();

                // Clear any existing timer to detect double click
                if (this._teamClickTimer) {
                    clearTimeout(this._teamClickTimer);
                    this._teamClickTimer = null;
                    // DOUBLE CLICK: Switch Main View
                    this.onPersonTeamMainSwitch?.(team);
                    this._closeAllDropdowns();
                } else {
                    // SINGLE CLICK: Toggle Sidebar
                    this._teamClickTimer = setTimeout(() => {
                        this.onPersonTeamSplitSwitch?.(team);
                        this._teamClickTimer = null;
                        this._closeAllDropdowns();
                    }, 250); // 250ms threshold
                }
                return;
            }

            if (e.target.closest('.theme-toggle')) {
                const rect = e.target.closest('.theme-toggle').getBoundingClientRect();
                const clickX = e.clientX || rect.left + rect.width / 2;
                const clickY = e.clientY || rect.top + rect.height / 2;
                await this.onThemeToggle?.(clickX, clickY);
                this._updateThemeUI();
            }

            if (e.target.closest('.persons-toggle-btn')) {
                this.onPersonsToggle?.();
            }

            if (e.target.closest('.inventory-toggle-btn')) {
                this.onInventoryToggle?.();
            }

            if (e.target.closest('.user-info-btn')) {
                this.onUserInfo?.();
            }

            if (e.target.closest('.calendar-toggle-btn')) {
                this._closeAllDropdowns();
                this.onCalendarToggle?.();
            }

            if (e.target.closest('.logout-btn')) {
                this.onLogout?.();
            }

            if (e.target.closest('.change-password-btn')) {
                this.onChangePassword?.();
            }

            if (e.target.closest('.favorites-toggle-btn')) {
                this.favoritesActive = !this.favoritesActive;
                e.target.closest('.favorites-toggle-btn').classList.toggle('active', this.favoritesActive);
                this.onFavoritesToggle?.(this.favoritesActive);
            }

            const dropdownBtn = e.target.closest('.dropdown-btn, .user-menu-btn');
            if (dropdownBtn) {
                e.stopPropagation();
                const container = dropdownBtn.closest('.dropdown-container');
                const isShowing = container.classList.contains('show');
                this._closeAllDropdowns();
                if (!isShowing) container.classList.add('show');
            } else if (!e.target.closest('.dropdown-menu')) {
                this._closeAllDropdowns();
            }
        });

        const logo = this.element.querySelector('.header-left');
        if (logo) {
            logo.addEventListener('dblclick', () => {
                this.onLogoDoubleClick?.();
            });
        }

        const personsBtn = this.element.querySelector('.persons-toggle-btn');
        if (personsBtn) {
            personsBtn.addEventListener('dblclick', () => {
                this.onPersonsFullView?.();
            });
        }

        const inventoryBtn = this.element.querySelector('.inventory-toggle-btn');
        if (inventoryBtn) {
            inventoryBtn.addEventListener('dblclick', () => {
                this.onInventoryFullView?.();
            });
        }

        const calendarBtn = this.element.querySelector('.calendar-toggle-btn');
        if (calendarBtn) {
            calendarBtn.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.onCalendarFull?.();
            });
        }

        const saveBtn = this.element.querySelector('.save-btn-header');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.onSaveAll?.();
            });
        }

        const discardBtn = this.element.querySelector('.discard-btn-header');
        if (discardBtn) {
            discardBtn.addEventListener('click', () => {
                this.onDiscardAll?.();
            });
        }

        const searchInput = this.element.querySelector('.header-search-input');
        const resultsDropdown = this.element.querySelector('.search-results-dropdown');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this._handleSearch(e.target.value);
            });

            searchInput.addEventListener('focus', () => {
                if (searchInput.value.trim().length >= 2) {
                    resultsDropdown.classList.add('show');
                }
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (this.currentResults.length > 0) {
                        this.selectedIndex = (this.selectedIndex + 1) % this.currentResults.length;
                        this._updateSelectedResultUI();
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (this.currentResults.length > 0) {
                        this.selectedIndex = (this.selectedIndex - 1 + this.currentResults.length) % this.currentResults.length;
                        this._updateSelectedResultUI();
                    }
                } else if (e.key === 'Enter') {
                    const idx = this.selectedIndex >= 0 ? this.selectedIndex : 0;
                    if (this.currentResults[idx]) {
                        const res = this.currentResults[idx];
                        this.switchTo(res.tableId);
                        this.onTableSwitch?.(res.tableId, res.rowId, res.colId);
                        resultsDropdown.classList.remove('show');
                        searchInput.value = '';
                        searchInput.blur();
                    }
                }
            });
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.header-search-container')) {
                resultsDropdown?.classList.remove('show');
            }
        });

        resultsDropdown?.addEventListener('click', (e) => {
            const item = e.target.closest('.search-result-item');
            if (item && item.dataset.tableId) {
                const tableId = item.dataset.tableId;
                const rowId = item.dataset.rowId;
                const colId = item.dataset.colId;
                this.switchTo(tableId);
                this.onTableSwitch?.(tableId, rowId, colId);
                resultsDropdown.classList.remove('show');
                searchInput.value = '';
            }
        });

        resultsDropdown?.addEventListener('mouseover', (e) => {
            const item = e.target.closest('.search-result-item');
            if (item && item.dataset.index) {
                this.selectedIndex = parseInt(item.dataset.index);
                this._updateSelectedResultUI();
            }
        });
    }

    _handleSearch(query) {
        const resultsDropdown = this.element.querySelector('.search-results-dropdown');
        const trimmedQuery = query.trim().toLowerCase();

        if (trimmedQuery.length < 2) {
            resultsDropdown.classList.remove('show');
            resultsDropdown.innerHTML = '';
            this.currentResults = [];
            this.selectedIndex = -1;
            return;
        }

        const results = [];
        const globalState = GlobalStateManager.getInstance();

        Object.entries(this.tables).forEach(([tableId, data]) => {
            if (!globalState.canView(tableId)) return;

            const { instance, instances, config } = data;
            const targetInstances = instances || [instance];
            const tableTitle = config.title;

            targetInstances.forEach(inst => {
                if (!inst || !inst.rows) return;

                inst.rows.forEach(row => {
                    Object.entries(row.data).forEach(([colId, value]) => {
                        if (value === null || value === undefined) return;

                        const strValue = String(value).toLowerCase();
                        const colDef = inst.schema.find(c => c.id === colId);

                        if (strValue === trimmedQuery) {
                            results.push({
                                tableId, tableTitle, colId,
                                colLabel: colDef ? colDef.label : colId,
                                value: String(value), rowId: row.id,
                                score: 100, type: 'exact'
                            });
                        }
                        else if (strValue.startsWith(trimmedQuery)) {
                            results.push({
                                tableId, tableTitle, colId,
                                colLabel: colDef ? colDef.label : colId,
                                value: String(value), rowId: row.id,
                                score: 75, type: 'start'
                            });
                        }
                        else if (strValue.includes(trimmedQuery)) {
                            results.push({
                                tableId, tableTitle, colId,
                                colLabel: colDef ? colDef.label : colId,
                                value: String(value), rowId: row.id,
                                score: 50, type: 'contains'
                            });
                        }
                        else if (this._fuzzyMatch(trimmedQuery, strValue)) {
                            results.push({
                                tableId, tableTitle, colId,
                                colLabel: colDef ? colDef.label : colId,
                                value: String(value), rowId: row.id,
                                score: 25, type: 'fuzzy'
                            });
                        }
                    });
                });
            });
        });

        const unique = new Map();
        results.sort((a, b) => b.score - a.score);
        results.forEach(r => {
            const key = `${r.tableId}:${r.rowId}`;
            if (!unique.has(key)) unique.set(key, r);
        });

        this.currentResults = Array.from(unique.values()).slice(0, 10);
        this.selectedIndex = this.currentResults.length > 0 ? 0 : -1;
        this._renderSearchResults(this.currentResults, trimmedQuery);
    }

    _fuzzyMatch(needle, haystack) {
        let idx = 0;
        for (let i = 0; i < haystack.length && idx < needle.length; i++) {
            if (haystack[i] === needle[idx]) idx++;
        }
        return idx === needle.length;
    }

    _renderSearchResults(results, query) {
        const resultsDropdown = this.element.querySelector('.search-results-dropdown');
        if (!resultsDropdown) return;

        if (results.length === 0) {
            resultsDropdown.innerHTML = '<div class="no-results" style="padding:12px; color:var(--text-muted);">Keine Ergebnisse gefunden</div>';
        } else {
            resultsDropdown.innerHTML = results.map((res, i) => {
                return `
                    <div class="search-result-item ${i === this.selectedIndex ? 'selected' : ''}" 
                         data-index="${i}"
                         data-table-id="${res.tableId}" 
                         data-row-id="${res.rowId}" 
                         data-col-id="${res.colId}">
                        <div class="result-meta">
                            <span class="result-table-name">${res.tableTitle}</span>
                            <span class="result-col-name">${res.colLabel}</span>
                        </div>
                        <div class="result-content">
                            ${this._highlightSearchTerm(res.value, query)}
                        </div>
                    </div>
                `;
            }).join('');
        }

        resultsDropdown.classList.add('show');
    }

    _updateSelectedResultUI() {
        const resultsDropdown = this.element.querySelector('.search-results-dropdown');
        if (!resultsDropdown) return;

        resultsDropdown.querySelectorAll('.search-result-item').forEach((item, i) => {
            item.classList.toggle('selected', i === this.selectedIndex);
        });
    }

    _highlightSearchTerm(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }

    _closeAllDropdowns() {
        this.element.querySelectorAll('.dropdown-container').forEach(c => c.classList.remove('show'));
    }

    switchTo(table) {
        this.currentTable = table;
        this.element.querySelectorAll('.nav-btn:not(.persons-toggle-btn):not(.inventory-toggle-btn):not(.calendar-toggle-btn)').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.table === table);
        });
    }

    showUnsavedBanner() {
        const banner = this.element.querySelector('.unsaved-banner');
        if (banner) {
            banner.style.display = 'flex';
            this.setLoading(false);
        }
    }

    hideUnsavedBanner() {
        const banner = this.element.querySelector('.unsaved-banner');
        if (banner) {
            banner.style.display = 'none';
            this.setLoading(false);
        }
    }

    setLoading(isLoading) {
        const banner = this.element.querySelector('.unsaved-banner');
        if (!banner) return;
        const msg = banner.querySelector('.unsaved-msg');
        const saveBtn = banner.querySelector('.save-btn-header');
        const discardBtn = banner.querySelector('.discard-btn-header');
        const bar = banner.querySelector('.save-loading-bar');

        if (isLoading) {
            document.body.classList.add('global-loading');
            if (msg) msg.textContent = 'Speichere...';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Speichern...';
            }
            if (discardBtn) discardBtn.disabled = true;
            if (bar) bar.style.display = 'block';
        } else {
            document.body.classList.remove('global-loading');
            if (msg) msg.textContent = 'Ungespeicherte Änderungen vorhanden';
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Speichern';
            }
            if (discardBtn) discardBtn.disabled = false;
            if (bar) bar.style.display = 'none';
        }
    }

    showFlash(message, type = 'success') {
        const banner = this.element.querySelector('.flash-banner');
        if (!banner) return;

        banner.textContent = message;
        banner.className = `flash-banner flash-${type}`;
        banner.style.display = 'block';
        banner.style.opacity = '1';

        setTimeout(() => {
            banner.style.opacity = '0';
            setTimeout(() => {
                banner.style.display = 'none';
            }, 300);
        }, 3000);
    }
}
