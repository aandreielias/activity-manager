import '../styles/Header.css';

/**
 * Header - Main application header with navigation and theme toggle
 */
export class Header {
    constructor({ appName = 'Activity Manager', onThemeToggle, onTableSwitch, tableConfigs = [], tables = {} }) {
        this.appName       = appName;
        this.onThemeToggle = onThemeToggle;
        this.onTableSwitch = onTableSwitch;
        this.tableConfigs  = tableConfigs;
        this.tables        = tables;
        this.currentTable  = tableConfigs[0]?.id || 'games';
        this.element       = null;
        this.personsSplitOpen = false;
    }

    render() {
        this.element = document.createElement('header');
        this.element.className = 'app-header';
        this.element.innerHTML = this._getHeaderHTML();

        this._attachEventListeners();

        return this.element;
    }

    _getHeaderHTML() {
        // Separate Spiele (games) tables and other tables
        const spieleTables = this.tableConfigs.filter(t => t.category === 'spiele');
        const otherTables = this.tableConfigs.filter(t => !t.category && t.id !== 'tbl_people');

        return `
            <div class="header-left">
                <span class="header-logo">⬡</span>
                <span class="header-title">${this.appName}</span>
            </div>
            <nav class="header-nav">
                ${this._renderDropdownButton(spieleTables)}
                ${otherTables.map((config, idx) =>
        `<button class="nav-btn ${idx === 0 && spieleTables.length === 0 ? 'active' : ''}" data-table="${config.id}">${config.title}</button>`
    ).join('')}
                <button class="nav-btn persons-toggle-btn" title="Personen-Ansicht umschalten">
                    Personen
                </button>
            </nav>
            <div class="header-center">
                <div class="unsaved-banner" style="display: none;">
                    <span class="unsaved-msg">Ungespeicherte Änderungen vorhanden</span>
                    <button class="save-btn-header">Speichern</button>
                    <button class="discard-btn-header">Verwerfen</button>
                </div>
            </div>
            <div class="header-right">
                <button class="theme-toggle" aria-label="Design umschalten" title="Dunkelmodus umschalten">
                    <span class="theme-icon">☀</span>
                </button>
            </div>
        `;
    }

    _renderDropdownButton(spieleTables) {
        if (spieleTables.length === 0) return '';

        return `
            <div class="dropdown-container split-btn-group">
                <button class="nav-btn split-main-btn active" data-table="all-spiele">
                    Spiele
                </button>
                <div class="split-divider"></div>
                <button class="nav-btn split-arrow-btn dropdown-btn" aria-label="Spiele Menü öffnen">
                    <span class="dropdown-arrow">▼</span>
                </button>
                <div class="dropdown-menu">
                    ${spieleTables.map(config =>
        `<button class="dropdown-item" data-table="${config.id}">${config.title}</button>`
    ).join('')}
                </div>
            </div>
        `;
    }

    _attachEventListeners() {
        // Theme toggle
        const themeBtn = this.element.querySelector('.theme-toggle');
        themeBtn.addEventListener('click', () => this._toggleTheme(themeBtn));

        // Persons toggle button
        const personsBtn = this.element.querySelector('.persons-toggle-btn');
        if (personsBtn) {
            personsBtn.addEventListener('click', () => {
                this.onPersonsToggle?.();
            });
            personsBtn.addEventListener('dblclick', () => {
                this.onPersonsFullView?.();
            });
        }

        // Unsaved changes buttons
        const saveBtn = this.element.querySelector('.save-btn-header');
        const discardBtn = this.element.querySelector('.discard-btn-header');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.onSaveAll?.(this.tables);
            });
        }

        if (discardBtn) {
            discardBtn.addEventListener('click', () => {
                this.onDiscardAll?.();
            });
        }

        // Dropdown menu
        const dropdownContainer = this.element.querySelector('.dropdown-container');
        const dropdownBtn = this.element.querySelector('.dropdown-btn');
        const splitMainBtn = this.element.querySelector('.split-main-btn');
        const dropdownMenu = this.element.querySelector('.dropdown-menu');

        if (dropdownBtn && dropdownMenu && dropdownContainer) {
            dropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // We no longer trigger onTableSwitch here, this arrow just opens the menu
                dropdownContainer.classList.toggle('show');
                dropdownMenu.classList.toggle('show');
            });
            
            if (splitMainBtn) {
                splitMainBtn.addEventListener('click', () => {
                    this.switchTo('all-spiele');
                    this.onTableSwitch?.('all-spiele');
                    dropdownContainer.classList.remove('show');
                    dropdownMenu.classList.remove('show');
                });
            }

            // Close dropdown when item clicked
            this.element.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    const tableId = item.dataset.table;
                    this.switchTo(tableId);
                    this.onTableSwitch?.(tableId);
                    dropdownContainer.classList.remove('show');
                    dropdownMenu.classList.remove('show');
                });
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!dropdownContainer.contains(e.target)) {
                    dropdownContainer.classList.remove('show');
                    dropdownMenu.classList.remove('show');
                }
            });
        }

        // Table navigation (regular buttons)
        this.element.querySelectorAll('.nav-btn:not(.dropdown-btn):not(.persons-toggle-btn)').forEach(btn => {
            btn.addEventListener('click', () => {
                const tableId = btn.dataset.table;
                this.switchTo(tableId);
                this.onTableSwitch?.(tableId);
            });
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
        }
    }

    _toggleTheme(themeBtn) {
        const isDark = document.documentElement.dataset.theme === 'dark';
        document.documentElement.dataset.theme = isDark ? '' : 'dark';
        themeBtn.querySelector('.theme-icon').textContent = isDark ? '☀' : '☾';
        this.onThemeToggle?.(!isDark);
    }

    switchTo(table) {
        this.currentTable = table;
        this.element.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.table === table);
        });
    }
}
