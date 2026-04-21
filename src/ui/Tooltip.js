/**
 * Tooltip - A premium, reusable tooltip system.
 * Supports HTML content, positioning, and custom delays.
 */
export class Tooltip {
    static #instance = null;
    static #timer = null;

    static init() {
        if (this.#instance) return;

        this.#instance = document.createElement('div');
        this.#instance.className = 'custom-tooltip';
        this.#instance.style.display = 'none';
        document.body.appendChild(this.#instance);

        // Add global styles for the tooltip
        const style = document.createElement('style');
        style.textContent = `
            .custom-tooltip {
                position: fixed;
                z-index: 99999;
                padding: 12px;
                background: var(--bg);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                color: var(--text-primary);
                font-size: 13px;
                line-height: 1.4;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
                pointer-events: none;
                max-width: 280px;
                white-space: pre-wrap;
                opacity: 0;
                transform: translateY(6px) scale(0.98);
                transition: opacity 0.15s ease, transform 0.15s ease;
            }
            .custom-tooltip.visible {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            .custom-tooltip .tooltip-title {
                display: block;
                font-weight: 700;
                margin-bottom: 4px;
                color: var(--accent);
                font-size: 14px;
            }
            .custom-tooltip .tooltip-section-title {
                display: block;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                margin-top: 10px;
                margin-bottom: 4px;
                opacity: 0.5;
                font-weight: 700;
            }
            .custom-tooltip .tooltip-list {
                font-size: 12px;
                opacity: 0.9;
            }
            .tooltip-loader {
                width: 24px;
                height: 24px;
                border: 2px solid rgba(var(--accent-rgb), 0.1);
                border-top-color: var(--accent);
                border-radius: 50%;
                animation: tooltip-spinner 0.6s linear infinite;
            }
            @keyframes tooltip-spinner {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    static attach(element, content, delay = 500, condition = null) {
        this.init();
        
        let localTimer = null;

        element.addEventListener('mouseenter', (e) => {
            if (condition && !condition()) return;
            localTimer = setTimeout(() => {
                this.show(e.clientX, e.clientY, content);
            }, delay);
        });

        element.addEventListener('mousemove', (e) => {
            if (this.#instance && this.#instance.style.display === 'block') {
                this._positionTooltip(e.clientX, e.clientY);
            }
        });

        element.addEventListener('mouseleave', () => {
            clearTimeout(localTimer);
            this.hide();
        });
    }

    static show(x, y, content) {
        if (!this.#instance) this.init();

        this.#instance.innerHTML = content.trim();
        this.#instance.style.display = 'block';
        
        // Use timeout to ensure transform animation works
        setTimeout(() => {
            this.#instance.classList.add('visible');
        }, 10);

        this._positionTooltip(x, y);
    }

    static hide() {
        clearTimeout(this.#timer);
        if (this.#instance) {
            this.#instance.classList.remove('visible');
            setTimeout(() => {
                if (!this.#instance.classList.contains('visible')) {
                    this.#instance.style.display = 'none';
                }
            }, 200);
        }
    }

    static _positionTooltip(x, y) {
        const offset = 15;
        const rect = this.#instance.getBoundingClientRect();
        
        let left = x + offset;
        let top = y + offset;

        // Boundary checks
        if (left + rect.width > window.innerWidth - 20) {
            left = x - rect.width - offset;
        }
        if (top + rect.height > window.innerHeight - 20) {
            top = y - rect.height - offset;
        }

        this.#instance.style.left = `${left}px`;
        this.#instance.style.top = `${top}px`;
    }
}
