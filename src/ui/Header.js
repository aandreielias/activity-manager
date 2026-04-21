import '../styles/Header.css';
import { GlobalStateManager } from '../core/GlobalStateManager.js';
import { AuditLogsDialog } from './AuditLogsDialog.js';
import { SUPABASE_CONFIG } from '../config.js';

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
        this.onChangeAvatar = null;
        this.favoritesActive = false;
        this.currentResults = [];
        this.selectedIndex = -1;
        this.version = this._getVersion();

        GlobalStateManager.getInstance().onFlashMessageCallback((msg, type) => this.showFlash(msg, type));
    }

    _getVersion() {
        return '2.10.0';
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
        return `
            <div class="header-left">
                <span class="header-logo">⬡</span>
                <div class="logo-stack">
                    <span class="header-title">${this.appName}</span>
                    <span class="header-version">v${this.version}</span>
                </div>
            </div>
            <nav class="header-nav">
                ${this._renderCategoryButton('spiele', 'Spiele')}
                ${this._renderCategoryButton('sportarten', 'Sportarten')}
                ${this._renderCategoryButton('organisation', 'Organisation', ['people'])}
                
                ${this._renderPersonenButton()}

                ${this._renderOtherTables()}
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
                ${this._renderSystemStatsButton()}
                ${this._renderCalendarButton()}
                <div class="dropdown-container user-dropdown-container">
                    <button class="header-user user-menu-btn">
                        ${this._renderUserAvatar()}
                        ${GlobalStateManager.getInstance().getCurrentUser()} <span class="dropdown-arrow" style="margin-left: 6px;">▼</span>
                    </button>
                    <div class="dropdown-menu user-dropdown-menu">
                        <button class="dropdown-item favorites-toggle-btn">Favoriten</button>
                        <button class="dropdown-item logout-btn">Abmelden</button>
                        <div class="dropdown-divider"></div>
                        <button class="dropdown-item change-avatar-btn">Personendaten ändern</button>
                        <button class="dropdown-item change-password-btn">Passwort ändern</button>
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
        if (!gs.canView('tbl_people')) return ''; // Self-gated check

        const userTeams = gs.getCurrentTeams();
        const allTeams = gs.getAvailableTeams();

        // If user is restricted to specific teams, only show those in dropdown
        const viewableTeams = (userTeams.length > 0 && !gs.isAdmin() && !gs.isSuperAdmin())
            ? allTeams.filter(t => userTeams.includes(t.name))
            : allTeams;

        // If user is restricted to exactly ONE team (typical for Supervisors), 
        // return a simple direct button instead of a complex split dropdown
        if (viewableTeams.length === 1 && !gs.isAdmin() && !gs.isSuperAdmin()) {
            const team = viewableTeams[0].name;
            return `
                <button class="nav-btn persons-toggle-btn ${this.currentTable === 'tbl_people' ? 'active' : ''}" data-team="${team}" title="Ihre Team-Personen (${team})">
                    Personen
                </button>
            `;
        }

        return `
            <div class="dropdown-container split-btn-group">
                <button class="nav-btn split-main-btn persons-toggle-btn ${this.currentTable === 'tbl_people' ? 'active' : ''}" title="Personen-Seitenleiste umschalten">
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

    _renderCategoryButton(categoryName, label, exclusions = []) {
        const gs = GlobalStateManager.getInstance();

        // Filter internally: Category is responsible for its own access
        const categoryTables = this.tableConfigs.filter(t =>
            t.category === categoryName &&
            !exclusions.some(exc => t.id.includes(exc)) &&
            gs.canView(t.id)
        );

        if (categoryTables.length === 0) return '';

        if (categoryTables.length === 1) {
            const table = categoryTables[0];
            return `<button class="nav-btn ${this.currentTable === table.id ? 'active' : ''}" data-table="${table.id}">${table.title}</button>`;
        }

        return `
            <div class="dropdown-container split-btn-group">
                <button class="nav-btn split-main-btn" data-table="all-${categoryName}">
                    ${label}
                </button>
                <div class="split-divider"></div>
                <button class="nav-btn split-arrow-btn dropdown-btn" aria-label="${label} Menü öffnen">
                    <span class="dropdown-arrow">▼</span>
                </button>
                <div class="dropdown-menu">
                    ${categoryTables.map(t => `<button class="dropdown-item" data-table="${t.id}">${t.title}</button>`).join('')}
                </div>
            </div>
        `;
    }

    _renderSystemStatsButton() {
        const gs = GlobalStateManager.getInstance();
        if (!gs.canSeeStats()) return '';
        return `
            <button class="nav-btn user-info-btn" title="System-Stats">
                Stats
            </button>
        `;
    }

    _renderCalendarButton() {
        const gs = GlobalStateManager.getInstance();
        if (!gs.canView('btn_calendar')) return '';
        return `
            <button class="nav-btn calendar-toggle-btn" title="Kalender öffnen">
                Kalender
            </button>
        `;
    }

    _renderOtherTables() {
        const gs = GlobalStateManager.getInstance();
        const knownCategories = ['spiele', 'sportarten', 'organisation'];
        const otherTables = this.tableConfigs.filter(t =>
            !knownCategories.includes(t.category) &&
            gs.canView(t.id)
        );

        return otherTables.map((config, idx) => {
            const isSpieleEmpty = this.tableConfigs.filter(t => t.category === 'spiele' && gs.canView(t.id)).length === 0;
            return `<button class="nav-btn ${idx === 0 && isSpieleEmpty ? 'active' : ''}" data-table="${config.id}">${config.title}</button>`;
        }).join('');
    }

    _renderUserAvatar() {
        const gs = GlobalStateManager.getInstance();
        const imageUrl = gs.getCurrentUserImageUrl();
        if (!imageUrl) return '';

        const isFull = imageUrl.includes('://') || imageUrl.startsWith('data:');
        const src = isFull ? imageUrl : `${SUPABASE_CONFIG.URL}/storage/v1/object/public/user_picture_bucket/${imageUrl}`;

        return `<img src="${src}" class="user-avatar-mini" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; margin-right: 8px; border: 1px solid var(--border);">`;
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
                const btn = e.target.closest('.persons-toggle-btn');
                if (btn.dataset.team) {
                    this.onPersonTeamMainSwitch?.(btn.dataset.team);
                } else {
                    this.onPersonsToggle?.();
                }
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

            if (e.target.closest('.change-avatar-btn')) {
                this.onChangeAvatar?.();
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
            logo.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this._showGamesMenu(e.clientX, e.clientY);
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

    _showGamesMenu(x, y) {
        document.querySelectorAll('.games-context-menu').forEach(el => el.remove());
        const menu = document.createElement('div');
        menu.className = 'dropdown-menu games-context-menu show';
        menu.style.position = 'fixed';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.zIndex = '100000';
        menu.style.display = 'flex';
        menu.style.flexDirection = 'column';
        menu.style.background = 'var(--bg-secondary)';
        menu.style.border = '1px solid var(--border)';
        menu.style.borderRadius = '8px';
        menu.style.padding = '8px';
        menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';

        const bjBtn = document.createElement('button');
        bjBtn.className = 'dropdown-item';
        bjBtn.style.textAlign = 'left';
        bjBtn.textContent = 'Blackjack';
        bjBtn.onclick = () => { this.onLogoDoubleClick?.(); menu.remove(); };

        const pokerBtn = document.createElement('button');
        pokerBtn.className = 'dropdown-item';
        pokerBtn.style.textAlign = 'left';
        pokerBtn.textContent = 'Texas Holdem';
        pokerBtn.onclick = () => { this.onLogoRightClick?.(); menu.remove(); };

        menu.appendChild(bjBtn);
        menu.appendChild(pokerBtn);
        document.body.appendChild(menu);

        setTimeout(() => {
            const closeMenu = (ev) => {
                if (!menu.contains(ev.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                    document.removeEventListener('contextmenu', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
            document.addEventListener('contextmenu', closeMenu);
        }, 10);
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

                        // COLUMN SECURITY: Don't search restricted columns
                        if (!globalState.canView(`col_${tableId}.${colId}`)) return;

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
        }
    }

    hideUnsavedBanner() {
        const banner = this.element.querySelector('.unsaved-banner');
        if (banner) {
            banner.style.display = 'none';
            this.setLoading(false);
        }
    }

    refreshUserArea() {
        if (!this.element) return;
        const userBtn = this.element.querySelector('.header-user');
        if (userBtn) {
            userBtn.innerHTML = `
                ${this._renderUserAvatar()}
                ${GlobalStateManager.getInstance().getCurrentUser()} <span class="dropdown-arrow" style="margin-left: 6px;">▼</span>
            `;
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

    hasVisibleItems() {
        if (!this.element) return false;

        // Check Navigation (Games, Sports, Org, People)
        const nav = this.element.querySelector('.header-nav');
        const hasNav = nav && nav.querySelectorAll('.nav-btn, .dropdown-container').length > 0;

        // Check Admin/Utility (Stats, Calendar)
        const stats = this.element.querySelector('.stats-btn');
        const calendar = this.element.querySelector('.calendar-toggle-btn');
        const hasUtils = !!stats || !!calendar;

        return hasNav || hasUtils;
    }
}
