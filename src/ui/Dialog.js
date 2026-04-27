import '../styles/Dialog.css';
import { BaseDialog } from './BaseDialog.js';

export class Dialog {
    static async confirm({ message, confirmText = 'Bestätigen', confirmStyle = 'warning' }) {
        return BaseDialog.show({
            onEscapeValue: false,
            render: (dialog, overlay, resolve, cleanup) => {
                const msgSpan = document.createElement('span');
                msgSpan.className = 'unsaved-msg';
                msgSpan.textContent = message;

                const confirmBtn = document.createElement('button');
                confirmBtn.className = confirmStyle === 'warning' ? 'discard-btn-header' : 'save-btn-header';
                confirmBtn.textContent = confirmText;

                const cancelBtn = document.createElement('button');
                cancelBtn.className = confirmStyle === 'warning' ? 'save-btn-header' : 'discard-btn-header';
                cancelBtn.textContent = 'Abbrechen';

                confirmBtn.addEventListener('click', () => resolve(true));
                cancelBtn.addEventListener('click', () => resolve(false));

                dialog.appendChild(msgSpan);
                dialog.appendChild(cancelBtn);
                dialog.appendChild(confirmBtn);

                if (confirmStyle === 'warning') {
                    cancelBtn.focus();
                } else {
                    confirmBtn.focus();
                }
            },
            onKeydown: (e, dialog, overlay, resolve) => {
                if (e.key === 'Enter') resolve(true);
            }
        });
    }

    static async prompt({ message, confirmText = 'Speichern', type = 'text', placeholder = '' }) {
        return BaseDialog.show({
            dialogClassName: 'custom-dialog prompt-dialog',
            onEscapeValue: null,
            render: (dialog, overlay, resolve, cleanup) => {
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

                confirmBtn.addEventListener('click', () => resolve(input.value));
                cancelBtn.addEventListener('click', () => resolve(null));

                dialog.appendChild(msgSpan);
                dialog.appendChild(input);
                dialog.appendChild(cancelBtn);
                dialog.appendChild(confirmBtn);

                setTimeout(() => input.focus(), 50);
            },
            onKeydown: (e, dialog, overlay, resolve) => {
                if (e.key === 'Enter') resolve(dialog.querySelector('input').value);
            }
        });
    }

    static async alert({ message, title = 'Info' }) {
        return BaseDialog.show({
            onEscapeValue: undefined,
            render: (dialog, overlay, resolve, cleanup) => {
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

                okBtn.addEventListener('click', () => resolve());

                dialog.appendChild(titleEl);
                dialog.appendChild(msgSpan);
                dialog.appendChild(okBtn);

                okBtn.focus();
            },
            onKeydown: (e, dialog, overlay, resolve) => {
                if (e.key === 'Enter') resolve();
            }
        });
    }


    static async select({ message, options, confirmText = 'Bestätigen' }) {
        return BaseDialog.show({
            dialogClassName: 'custom-dialog prompt-dialog',
            onEscapeValue: null,
            render: (dialog, overlay, resolve, cleanup) => {
                const msgSpan = document.createElement('div');
                msgSpan.className = 'unsaved-msg';
                msgSpan.textContent = message;
                msgSpan.style.marginBottom = '12px';

                const select = document.createElement('select');
                select.className = 'dialog-input';
                select.style.display = 'block';
                select.style.width = '100%';
                select.style.marginBottom = '16px';

                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = typeof opt === 'object' ? opt.value : opt;
                    option.textContent = typeof opt === 'object' ? opt.label : opt;
                    select.appendChild(option);
                });

                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'save-btn-header';
                confirmBtn.textContent = confirmText;

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'discard-btn-header';
                cancelBtn.textContent = 'Abbrechen';

                confirmBtn.addEventListener('click', () => resolve(select.value));
                cancelBtn.addEventListener('click', () => resolve(null));

                dialog.appendChild(msgSpan);
                dialog.appendChild(select);
                dialog.appendChild(cancelBtn);
                dialog.appendChild(confirmBtn);

                setTimeout(() => select.focus(), 50);
            },
            onKeydown: (e, dialog, overlay, resolve) => {
                if (e.key === 'Enter') resolve(dialog.querySelector('select').value);
            }
        });
    }

    /**
     * Shows a pill-shaped banner at the top of the screen for confirmations.
     * Matches the "Unsaved Changes" style.
     */
    static async bannerConfirm({ message, confirmText = 'Bestätigen', confirmStyle = 'warning' }) {
        return new Promise((resolve) => {
            const banner = document.createElement('div');
            banner.className = 'unsaved-banner';
            banner.style.display = 'flex'; // Ensure visibility
            banner.style.top = '24px';
            banner.style.zIndex = '10001'; 

            const msg = document.createElement('span');
            msg.className = 'unsaved-msg';
            msg.textContent = message;
            banner.appendChild(msg);

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '8px';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'save-btn-header';
            cancelBtn.textContent = 'Abbrechen';
            
            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'discard-btn-header';
            confirmBtn.textContent = confirmText;

            actions.appendChild(cancelBtn);
            actions.appendChild(confirmBtn);
            banner.appendChild(actions);

            document.body.appendChild(banner);

            const cleanup = () => {
                banner.classList.add('removing');
                setTimeout(() => {
                    if (banner.parentNode) banner.parentNode.removeChild(banner);
                }, 300);
            };

            cancelBtn.onclick = () => { cleanup(); resolve(false); };
            confirmBtn.onclick = () => { cleanup(); resolve(true); };
        });
    }
}

