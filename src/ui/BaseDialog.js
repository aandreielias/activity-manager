export class BaseDialog {
    /**
     * Creates a modal dialog overlay and returns a Promise that resolves when the dialog completes.
     * @param {Object} options
     * @param {string} [options.overlayClassName='custom-dialog-overlay'] - Class for the overlay container.
     * @param {string} [options.dialogClassName='custom-dialog'] - Class for the dialog window itself.
     * @param {boolean} [options.closeOnEscape=true] - Whether to close on pressing Escape.
     * @param {boolean} [options.closeOnOutsideClick=false] - Whether to close when clicking the overlay.
     * @param {*} [options.onEscapeValue=null] - What to resolve with when Escape or outside click closes the dialog.
     * @param {function(HTMLElement, HTMLElement, function, function): void} options.render - Callback to render dialog content. `(dialog, overlay, resolve, cleanup)`
     * @param {function(KeyboardEvent, HTMLElement, HTMLElement, function, function): void} [options.onKeydown] - Optional custom keydown handler.
     * @returns {Promise<any>}
     */
    static show({
        overlayClassName = 'custom-dialog-overlay',
        dialogClassName = 'custom-dialog',
        closeOnEscape = true,
        closeOnOutsideClick = false,
        onEscapeValue = null,
        render,
        onKeydown: customOnKeydown
    }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = overlayClassName;

            const dialog = document.createElement('div');
            dialog.className = dialogClassName;

            const cleanup = () => {
                overlay.remove();
                document.removeEventListener('keydown', internalOnKeydown);
            };

            const resolveWithCleanup = (value) => {
                cleanup();
                resolve(value);
            };

            const internalOnKeydown = (e) => {
                if (closeOnEscape && e.key === 'Escape') {
                    resolveWithCleanup(onEscapeValue);
                }
                if (customOnKeydown) {
                    customOnKeydown(e, dialog, overlay, resolveWithCleanup, cleanup);
                }
            };

            if (closeOnOutsideClick) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        resolveWithCleanup(onEscapeValue);
                    }
                });
            }

            document.addEventListener('keydown', internalOnKeydown);

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            if (render) {
                // Pass dialog, overlay, resolve wrapped with cleanup, and naked cleanup
                render(dialog, overlay, resolveWithCleanup, cleanup);
            }
        });
    }
}
