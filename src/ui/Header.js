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
        const otherTables = viewableConfigs.filter(t => !t.category && t.id !== 'tbl_people' && t.id !== 'tbl_inventory');

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
            </nav>
            <div class="header-center">
                <div class="unsaved-banner" style="display: none;">
                    <span class="unsaved-msg">Ungespeicherte Änderungen vorhanden</span>
                    <button class="save-btn-header">Speichern</button>
                    <button class="discard-btn-header">Verwerfen</button>
                </div>
            </div>
            <div class="header-right">
                ${globalState.canManageUsers() ? `
                    <button class="nav-btn user-info-btn" title="Nutzer verwalten">
                        Nutzer
                    </button>
                ` : ''}
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

            if (e.target.closest('.user-info-btn')) {
                this.onUserInfo?.();
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
            console.log('Attaching dblclick listener to logo area');
            logo.addEventListener('dblclick', (e) => {
                console.log('Logo area double-clicked!', e.target);
                if (this.onLogoDoubleClick) {
                    this.onLogoDoubleClick();
                } else {
                    console.warn('onLogoDoubleClick callback not set');
                }
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
        if (banner) banner.style.display = 'flex';
    }

    hideUnsavedBanner() {
        const banner = this.element.querySelector('.unsaved-banner');
        if (banner) banner.style.display = 'none';
    }
}
