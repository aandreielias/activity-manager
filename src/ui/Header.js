export class Header {
    constructor({appName = 'Acrivity Manager', onThemeToggle}) {

        this.appName = appName;
        this.onThemeToggle = onThemeToggle;
        this.element = null;
    }

    render() {

        this.element = document.createElement('header');
        this.element.className = 'app-header';
        this.element.innerHTML =
            `
            <div class="header-left">
                <span class="header-logo">⬡</span>
                <span class="header-title">${this.appName}</span>
            </div>
            <div class="header-right">
                <button class="theme-toggle-btn" title="Toggle Theme">
                    <span class="theme-icon">☀</span>
                </button>
            </div>
            `;

        this._bindEvents();
        this._injectSytles();
        return this.element;
    }

    _bindEvents() {

        const btn = this.element.querySelector('.theme-toggle');
        btn.addEventListener('click', () => {

            const isDark = document.documentElement.dataset.theme === 'dark';
            document.documentElement.dataset.theme = isDark ? '' : 'dark';

            btn.querySelector('.theme-icon').textContent = isDark ? '☀' : 'C';
            this.onThemeToggle?.(!isDark);
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
              padding: 0 24px;
              height: 52px;
              background: var(--bg);
              border-bottom: 1px solid var(--border);
              position: sticky;
              top: 0;
              z-index: 100;
              transition: background var(--transition), border-color var(--transition);
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .header-logo {
              font-size: 18px;
              color: var(--accent);
            }
            .header-title {
              font-size: 14px;
              font-weight: 600;
              letter-spacing: -0.01em;
              color: var(--text-primary);
            }
            .theme-toggle {
              background: none;
              border: 1px solid var(--border);
              border-radius: var(--radius-sm);
              width: 32px;
              height: 32px;
              cursor: pointer;
              color: var(--text-secondary);
              font-size: 14px;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: background var(--transition), color var(--transition);
            }
            .theme-toggle:hover {
              background: var(--bg-hover);
              color: var(--text-primary);
            }
        `;
        document.head.appendChild(style);
    }
}