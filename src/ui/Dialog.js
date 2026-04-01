import '../styles/Dialog.css';

export class Dialog {
    static async confirm({ message, confirmText = 'Bestätigen', confirmStyle = 'warning' }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'custom-dialog';

            const msgSpan = document.createElement('span');
            msgSpan.className = 'unsaved-msg';
            msgSpan.textContent = message;

            // Using the exact styles from the unsaved-banner for the popup
            const confirmBtn = document.createElement('button');
            confirmBtn.className = confirmStyle === 'warning' ? 'discard-btn-header' : 'save-btn-header';
            confirmBtn.textContent = confirmText;

            const cancelBtn = document.createElement('button');
            // If primary action is warning (discard/delete), make cancel neutral/success.
            // To stick strictly to "same style as the save changes banner", we reuse its button classes.
            cancelBtn.className = confirmStyle === 'warning' ? 'save-btn-header' : 'discard-btn-header';
            cancelBtn.textContent = 'Abbrechen';
            
            // Ensure focus is trapped / managed
            const cleanup = () => {
                overlay.remove();
                document.removeEventListener('keydown', onKeydown);
            };

            const onKeydown = (e) => {
                if (e.key === 'Enter') {
                    cleanup();
                    resolve(true);
                }
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                }
            };

            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            document.addEventListener('keydown', onKeydown);

            dialog.appendChild(msgSpan);
            // Swapping order. Usually "Cancel" is left or right depending on OS. Let's put Cancel then Confirm.
            dialog.appendChild(cancelBtn);
            dialog.appendChild(confirmBtn);
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            // Focus cancel by default for destructive actions, or confirm for positive actions
            if (confirmStyle === 'warning') {
                cancelBtn.focus();
            } else {
                confirmBtn.focus();
            }
        });
    }

    static async prompt({ message, confirmText = 'Speichern', type = 'text', placeholder = '' }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'custom-dialog prompt-dialog';

            const msgSpan = document.createElement('div');
            msgSpan.className = 'unsaved-msg';
            msgSpan.textContent = message;
            msgSpan.style.marginBottom = '12px';

            const input = document.createElement('input');
            input.type = type;
            input.placeholder = placeholder;
            input.className = 'dialog-input';
            input.style.display = 'block';
            input.style.width = '100%';
            input.style.marginBottom = '16px';

            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'save-btn-header';
            confirmBtn.textContent = confirmText;

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'discard-btn-header';
            cancelBtn.textContent = 'Abbrechen';
            
            const cleanup = () => {
                overlay.remove();
                document.removeEventListener('keydown', onKeydown);
            };

            const onKeydown = (e) => {
                if (e.key === 'Enter') {
                    cleanup();
                    resolve(input.value);
                }
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                }
            };

            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(input.value);
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });

            document.addEventListener('keydown', onKeydown);

            dialog.appendChild(msgSpan);
            dialog.appendChild(input);
            dialog.appendChild(cancelBtn);
            dialog.appendChild(confirmBtn);
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            setTimeout(() => input.focus(), 50);
        });
    }

    static async alert({ message, title = 'Info' }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'custom-dialog';

            const titleEl = document.createElement('div');
            titleEl.className = 'unsaved-msg';
            titleEl.style.fontWeight = '700';
            titleEl.style.marginBottom = '8px';
            titleEl.textContent = title;

            const msgSpan = document.createElement('div');
            msgSpan.className = 'unsaved-msg';
            msgSpan.innerHTML = message.replace(/\n/g, '<br>');
            msgSpan.style.marginBottom = '16px';
            msgSpan.style.fontSize = '13px';
            msgSpan.style.lineHeight = '1.5';

            const okBtn = document.createElement('button');
            okBtn.className = 'save-btn-header';
            okBtn.textContent = 'OK';
            okBtn.style.margin = '0 auto';
            okBtn.style.display = 'block';
            
            const cleanup = () => {
                overlay.remove();
                document.removeEventListener('keydown', onKeydown);
            };

            const onKeydown = (e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    cleanup();
                    resolve();
                }
            };

            okBtn.addEventListener('click', () => {
                cleanup();
                resolve();
            });

            document.addEventListener('keydown', onKeydown);

            dialog.appendChild(titleEl);
            dialog.appendChild(msgSpan);
            dialog.appendChild(okBtn);
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            okBtn.focus();
        });
    }
}
