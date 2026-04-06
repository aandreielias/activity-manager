import '../styles/Header.css';
import { GlobalStateManager } from '../core/GlobalStateManager.js';

/**
 * Header - Main application header with navigation and theme toggle
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
        this.onUserInfo = null;
        this.onLogout = null;
        this.onChangePassword = null;
        this.onFavoritesToggle = null;
        this.onLogoDoubleClick = null;
        this.favoritesActive = false;
        this.currentResults = [];
        this.selectedIndex = -1;

        GlobalStateManager.getInstance().onFlashMessageCallback((msg, type) => this.showFlash(msg, type));
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

        // Filter configurations based on current view permissions
        const viewableConfigs = this.tableConfigs.filter(t => globalState.canView(t.id));

        // Categories
        const spieleTables = viewableConfigs.filter(t => t.category === 'spiele');
        const sportTables = viewableConfigs.filter(t => t.category === 'sportarten');
        const otherTables = viewableConfigs.filter(t => !t.category && !['tbl_people', 'tbl_inventory', 'tbl_ort'].includes(t.id));

        // Permissions for split-views
        const canViewPeople = globalState.canView('people_table') || globalState.canView('tbl_people');
        const canViewInventory = globalState.canView('tbl_inventory');

        return `
            <div class="header-left" title="do NOT double click">
                <span class="header-logo">⬡</span>
                <span class="header-title">${this.appName}</span>
            </div>
            <nav class="header-nav">
                ${this._renderCategoryButton(spieleTables, 'spiele', 'Spiele')}
                ${this._renderCategoryButton(sportTables, 'sportarten', 'Sportarten')}
                ${otherTables.map((config, idx) =>
            `<button class="nav-btn ${idx === 0 && spieleTables.length === 0 ? 'active' : ''}" data-table="${config.id}">${config.title}</button>`
        ).join('')}
                
                ${canViewPeople ? `
                <button class="nav-btn persons-toggle-btn" title="Personen-Ansicht umschalten">
                    Personen
                </button>` : ''}
                
                ${canViewInventory ? `
                <button class="nav-btn inventory-toggle-btn" title="Inventar-Ansicht umschalten">
                    Inventar
                </button>` : ''}

                ${globalState.isEditModeActive() ? `
                <button class="nav-btn orte-btn" title="Orte verwalten">
                    Orte
                </button>` : ''}
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
                    <button class="nav-btn user-info-btn" title="Nutzer verwalten">
                        Nutzer
                    </button>
                ` : ''}
                ${globalState.isEditModeActive() ? `
                    <button class="nav-btn add-table-btn" style="border-color:var(--warning); color:var(--warning)" title="Neue Kategorie erstellen">
                        + Kategorie
                    </button>
                ` : ''}
                <button class="nav-btn calendar-toggle-btn" title="Kalender öffnen">
                    Kalender
                </button>
                <div class="dropdown-container user-dropdown-container">
                    <button class="header-user user-menu-btn">
                        ${globalState.getCurrentUser()} <span class="dropdown-arrow" style="margin-left: 6px;">▼</span>
                    </button>
                    <div class="dropdown-menu user-dropdown-menu">
                        ${globalState.canUseEditMode() ? `
                            <button class="dropdown-item edit-mode-btn ${globalState.isEditModeActive() ? 'active' : ''}">
                                ${globalState.isEditModeActive() ? 'Edit-Modus deaktivieren' : 'Edit-Modus aktivieren'}
                            </button>
                        ` : ''}
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

    _renderCategoryButton(categoryTables, categoryId, categoryLabel) {
        if (categoryTables.length === 0) return '';

        // If only ONE table is allowed in this category, show it as a simple button
        if (categoryTables.length === 1) {
            const table = categoryTables[0];
            return `<button class="nav-btn ${this.currentTable === table.id ? 'active' : ''}" data-table="${table.id}">${table.title}</button>`;
        }

        // Multiple tables allowed -> Show split-button dropdown
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

            if (e.target.closest('.orte-btn')) {
                this.onTableSwitch?.('tbl_ort');
            }

            if (e.target.closest('.user-info-btn')) {
                this.onUserInfo?.();
            }
            
            if (e.target.closest('.add-table-btn')) {
                const name = prompt('Name für die neue Kategorie (z.B. Escape Rooms):');
                if (name) {
                    try {
                        const gs = GlobalStateManager.getInstance();
                        const slug = name.toLowerCase().replace(/\s+/g, '_');
                        // 1. Add to activity_category_enum
                        await gs.addEnumOption('activity_category_enum', slug);
                        // 2. Update local tables.json (simulated or instructions given)
                        alert(`Kategorie '${name}' in DB erstellt. Bitte füge 'tbl_activities_${slug}' zu tables.json hinzu.`);
                        window.location.reload();
                    } catch (err) {
                        alert(`Fehler: ${err.message}`);
                    }
                }
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

            if (e.target.closest('.edit-mode-btn')) {
                const btn = e.target.closest('.edit-mode-btn');
                const isActive = btn.textContent.includes('deaktivieren');
                if (isActive) {
                    btn.textContent = 'Edit-Modus aktivieren';
                    btn.classList.remove('active');
                } else {
                    btn.textContent = 'Edit-Modus deaktivieren';
                    btn.classList.add('active');
                }
                this.onEditModeToggle?.(!isActive);
            }

            if (e.target.closest('.favorites-toggle-btn')) {
                this.favoritesActive = !this.favoritesActive;
                e.target.closest('.favorites-toggle-btn').classList.toggle('active', this.favoritesActive);
                this.onFavoritesToggle?.(this.favoritesActive);
            }

            // Dropdown toggles
            const dropdownBtn = e.target.closest('.dropdown-btn, .user-menu-btn');
            if (dropdownBtn) {
                const container = dropdownBtn.closest('.dropdown-container');
                const isShowing = container.classList.contains('show');
                this._closeAllDropdowns();
                if (!isShowing) container.classList.add('show');
            } else if (!e.target.closest('.dropdown-menu')) {
                this._closeAllDropdowns();
            }
        });

        // Logo double click for Blackjack
        const logo = this.element.querySelector('.header-left');
        if (logo) {
            logo.addEventListener('dblclick', () => {
                this.onLogoDoubleClick?.();
            });
        }

        // Split view buttons double click for full screen
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

        // Unsaved changes banner
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

        // Search bar
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

        // Close search results on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.header-search-container')) {
                resultsDropdown?.classList.remove('show');
            }
        });

        // Handle result clicks
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

        // Update selected index on mouse move
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
        const trimmedQuery = query.trim();

        if (trimmedQuery.length < 2) {
            resultsDropdown.classList.remove('show');
            resultsDropdown.innerHTML = '';
            this.currentResults = [];
            this.selectedIndex = -1;
            return;
        }

        const results = [];
        const globalState = GlobalStateManager.getInstance();

        // Iterate over all tables
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
                        
                        const strValue = String(value);
                        if (strValue.toLowerCase().includes(trimmedQuery.toLowerCase())) {
                            const colDef = inst.schema.find(c => c.id === colId);
                            // Avoid duplicate results for the same row in same table if we already found a match
                            // (Actually the user wants column name, so multiple columns in same row are fine)
                            results.push({
                                tableId,
                                tableTitle,
                                colId,
                                colLabel: colDef ? colDef.label : colId,
                                value: strValue,
                                rowId: row.id
                            });
                        }
                    });
                });
            });
        });

        this.currentResults = results.slice(0, 5);
        this.selectedIndex = this.currentResults.length > 0 ? 0 : -1;
        this._renderSearchResults(this.currentResults, trimmedQuery);
    }

    _renderSearchResults(results, query) {
        const resultsDropdown = this.element.querySelector('.search-results-dropdown');
        if (!resultsDropdown) return;

        if (results.length === 0) {
            resultsDropdown.innerHTML = '<div class="no-results">Keine Ergebnisse gefunden</div>';
        } else {
            resultsDropdown.innerHTML = results.map((res, i) => `
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
            `).join('');
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
        this.element.querySelectorAll('.nav-btn:not(.persons-toggle-btn):not(.inventory-toggle-btn)').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.table === table);
        });
    }

    showUnsavedBanner() {
        const banner = this.element.querySelector('.unsaved-banner');
        if (banner) {
            banner.style.display = 'flex';
            this.setLoading(false); // Reset loading state when showing banner
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
            document.body.style.cursor = 'wait';
            if (msg) msg.textContent = 'Speichere...';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Speichern...';
            }
            if (discardBtn) discardBtn.disabled = true;
            if (bar) bar.style.display = 'block';
        } else {
            document.body.style.cursor = 'default';
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
