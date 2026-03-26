/**
 * Header - Main application header with navigation and theme toggle
 */
export class Header {
    constructor({ appName = 'Activity Manager', onThemeToggle, onTableSwitch, tableConfigs = [] }) {
        this.appName       = appName;
        this.onThemeToggle = onThemeToggle;
        this.onTableSwitch = onTableSwitch;
        this.tableConfigs  = tableConfigs;
        this.currentTable  = tableConfigs[0]?.id || 'games';
        this.element       = null;
    }

    render() {
        this.element = document.createElement('header');
        this.element.className = 'app-header';
        this.element.innerHTML = this._getHeaderHTML();

        this._attachEventListeners();
        this._injectStyles();

        return this.element;
    }

    _getHeaderHTML() {
        // Separate Spiele (games) tables and other tables
        const spieleTables = this.tableConfigs.filter(t => t.category === 'spiele');
        const otherTables = this.tableConfigs.filter(t => !t.category);
        
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
            </nav>
            <div class="header-right">
                <button class="theme-toggle" aria-label="Toggle theme" title="Toggle dark mode">
                    <span class="theme-icon">☀</span>
                </button>
            </div>
        `;
    }

    _renderDropdownButton(spieleTables) {
        if (spieleTables.length === 0) return '';
        
        return `
            <div class="dropdown-container">
                <button class="nav-btn dropdown-btn active" data-table="${spieleTables[0].id}">
                    Spiele
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

        // Dropdown menu
        const dropdownContainer = this.element.querySelector('.dropdown-container');
        const dropdownBtn = this.element.querySelector('.dropdown-btn');
        const dropdownMenu = this.element.querySelector('.dropdown-menu');
        
        if (dropdownBtn && dropdownMenu && dropdownContainer) {
            dropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Only toggle dropdown if clicking the button text/arrow, not when dropdown is already open
                if (!dropdownContainer.classList.contains('show')) {
                    // When opening dropdown, trigger show all spiele
                    this.onTableSwitch?.('all-spiele');
                }
                dropdownContainer.classList.toggle('show');
                dropdownMenu.classList.toggle('show');
            });

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
        this.element.querySelectorAll('.nav-btn:not(.dropdown-btn)').forEach(btn => {
            btn.addEventListener('click', () => {
                const tableId = btn.dataset.table;
                this.switchTo(tableId);
                this.onTableSwitch?.(tableId);
            });
        });
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

    _injectStyles() {
        if (document.getElementById('header-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'header-styles';
        style.textContent = `
            .app-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 32px;
                height: 56px;
                background: var(--bg);
                border-bottom: 1px solid var(--border-light);
                position: sticky;
                top: 0;
                z-index: 100;
                transition: background var(--transition), border-color var(--transition);
            }

            .header-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .header-logo {
                font-size: 18px;
                color: var(--accent);
                font-weight: 700;
            }

            .header-title {
                font-size: 14px;
                font-weight: 700;
                letter-spacing: -0.01em;
                color: var(--text-primary);
            }

            .header-nav {
                display: flex;
                align-items: center;
                gap: 4px;
                margin: 0 auto 0 24px;
            }

            .nav-btn {
                background: none;
                border: none;
                cursor: pointer;
                color: var(--text-secondary);
                font-size: 13px;
                font-weight: 500;
                padding: 6px 12px;
                border-radius: var(--radius-sm);
                transition: background var(--transition), color var(--transition);
                white-space: nowrap;
            }

            .nav-btn:hover {
                background: var(--bg-hover);
                color: var(--text-primary);
            }

            .nav-btn.active {
                color: var(--accent);
                font-weight: 600;
                background: var(--accent-light);
            }

            .theme-toggle {
                background: none;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                width: 36px;
                height: 36px;
                cursor: pointer;
                color: var(--text-secondary);
                font-size: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background var(--transition), color var(--transition), border-color var(--transition);
                margin-left: 24px;
            }

            .theme-toggle:hover {
                background: var(--bg-hover);
                border-color: var(--border);
                color: var(--text-primary);
            }

            .theme-toggle:focus-visible {
                outline: 2px solid var(--accent);
                outline-offset: 2px;
            }

            .dropdown-container {
                position: relative;
                display: inline-block;
            }

            .dropdown-btn {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .dropdown-arrow {
                font-size: 10px;
                transition: transform var(--transition);
                display: inline-block;
            }

            .dropdown-container.show .dropdown-arrow {
                transform: rotate(180deg);
            }

            .dropdown-menu {
                position: absolute;
                top: 100%;
                left: 0;
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                min-width: 240px;
                margin-top: 4px;
                padding: 4px 0;
                display: none;
                flex-direction: column;
                gap: 0;
                box-shadow: var(--shadow-md);
                z-index: 1000;
                border-top: 2px solid var(--accent);
            }

            .dropdown-menu.show {
                display: flex;
            }

            .dropdown-item {
                background: none;
                border: none;
                cursor: pointer;
                color: var(--text-primary);
                font-size: 13px;
                font-weight: 500;
                padding: 8px 12px;
                text-align: left;
                transition: background var(--transition), color var(--transition);
                white-space: nowrap;
            }

            .dropdown-item:hover {
                background: var(--bg-hover);
                color: var(--accent);
            }

            .dropdown-item:active {
                background: var(--accent-light);
            }
        `;

        document.head.appendChild(style);
    }
}
