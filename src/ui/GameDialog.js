import { BaseDialog } from './BaseDialog.js';

export class GameDialog extends BaseDialog {
    /**
     * Shows a game in a modal window.
     * @param {Object} gameUI - The UI instance (BlackjackUI, TexasHoldemUI, etc.)
     * @returns {Promise}
     */
    static show(gameUI) {
        return super.show({
            overlayClassName: 'game-dialog-overlay',
            dialogClassName: 'game-dialog',
            closeOnEscape: true,
            closeOnOutsideClick: false,
            render: (dialog, overlay, resolve, cleanup) => {
                // Set the close callback for the UI
                gameUI.setOnClose(() => {
                    cleanup();
                    resolve();
                });
                
                const content = gameUI.render();
                // Ensure content takes full size of dialog
                content.style.width = '100%';
                content.style.height = '100%';
                content.style.position = 'relative';
                content.style.top = '0';
                content.style.left = '0';
                content.style.right = '0';
                content.style.bottom = '0';
                content.style.borderRadius = 'inherit';
                
                dialog.appendChild(content);
            }
        });
    }
}
