import { Dialog } from './Dialog.js';

/**
 * ContextMenu - Manages right-click context menu for rows and cells
 */
export class ContextMenu {
    constructor() {
        this.element = null;
    }

    show(x, y, options) {
        this.close();

        this.element = document.createElement('div');
        this.element.className = 'row-context-menu';
        
        // Ensure menu stays within screen bounds
        const menuWidth = 160;
        const menuHeight = 200;
        const posX = Math.min(x, window.innerWidth - menuWidth);
        const posY = Math.min(y, window.innerHeight - menuHeight);
        
        this.element.style.top = `${posY}px`;
        this.element.style.left = `${posX}px`;

        if (options.onToggleFavorite) {
            const favItem = this._createMenuItem(
                options.isFavorite ? '★ Von Favoriten entfernen' : '☆ Zu Favoriten hinzufügen',
                () => {
                    this.close();
                    options.onToggleFavorite();
                }
            );
            this.element.appendChild(favItem);
        }

        if (options.onEdit) {
            const editItem = this._createMenuItem('✎ Feld bearbeiten', () => {
                this.close();
                options.onEdit();
            });
            this.element.appendChild(editItem);

            const separator = document.createElement('div');
            separator.className = 'context-menu-separator';
            this.element.appendChild(separator);
        }

        if (options.onShowInfo) {
            const infoItem = this._createMenuItem('ⓘ Eintragsinfo', () => {
                this.close();
                options.onShowInfo();
            });
            this.element.appendChild(infoItem);
        }

        if (options.onDelete) {
            const deleteItem = this._createMenuItem('🗑 Zeile löschen', async () => {
                this.close();
                const confirmed = await Dialog.confirm({
                    message: 'Diese Zeile wirklich unwiderruflich löschen?',
                    confirmText: 'Löschen',
                    confirmStyle: 'warning'
                });
                if (confirmed) {
                    options.onDelete?.();
                }
            });
            deleteItem.classList.add('context-menu-delete');
            this.element.appendChild(deleteItem);
        }

        document.body.appendChild(this.element);

        // Close on click outside or escape
        const handleClickOutside = (e) => {
            if (!this.element?.contains(e.target)) {
                this.close();
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };

        setTimeout(() => {
            document.addEventListener('click', handleClickOutside, { once: true });
            document.addEventListener('keydown', handleEscape, { once: true });
        }, 10);
    }

    _createMenuItem(label, onClickCallback) {
        const item = document.createElement('button');
        item.className = 'context-menu-item';
        item.textContent = label;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            onClickCallback();
        });
        return item;
    }

    close() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}

// Global instance
export const contextMenu = new ContextMenu();
