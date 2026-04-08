import '../styles/LoginDialog.css';
import { AuthService } from '../services/AuthService.js';
import { BaseDialog } from './BaseDialog.js';

export class LoginDialog {
    static async show(peopleData) {
        return BaseDialog.show({
            overlayClassName: 'login-overlay',
            dialogClassName: 'login-dialog dialog-window',
            closeOnEscape: true,
            closeOnOutsideClick: false,
            onEscapeValue: null,
            render: (dialog, overlay, resolve, cleanup) => {
                dialog.innerHTML = `
                    <h2>Login</h2>
                    <div class="login-input-group">
                        <div id="login-user-dropdown" class="custom-login-select">
                            <div class="login-select-display">
                                <span class="selected-value">Nutzer Auswählen</span>
                                <span class="dropdown-arrow">▼</span>
                            </div>
                            <div class="login-select-options">
                                ${(peopleData || [])
            .sort((a, b) => {
                const aInactive = (a.Status || '').toLowerCase() === 'inaktiv' || (a.role || '').toLowerCase() === 'inaktiv';
                const bInactive = (b.Status || '').toLowerCase() === 'inaktiv' || (b.role || '').toLowerCase() === 'inaktiv';
                if (aInactive && !bInactive) return 1;
                if (!aInactive && bInactive) return -1;
                return 0;
            })
            .map(p => {
                const name = `${p.vorname || ''} ${p.nachname || ''}`.trim();
                if (!name) return '';
                const role = p.role || '';
                const isInactive = (p.Status || '').toLowerCase() === 'inaktiv' || (p.role || '').toLowerCase() === 'inaktiv';
                return `
                                            <div class="login-option ${isInactive ? 'is-inactive' : ''}" data-value="${name}">
                                                <span class="option-name">${name}</span>
                                                <span class="option-role">${role}</span>
                                            </div>
                                        `;
            }).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="login-input-group">
                        <input type="password" id="login-password-input" placeholder="Passwort" class="login-password input-field">
                    </div>
                    <button id="login-submit-btn" class="login-btn header-btn no-icon">Anmelden</button>
                    <div id="login-error-msg" class="login-error"></div>
                `;

                const dropdown = dialog.querySelector('#login-user-dropdown');
                const display = dropdown.querySelector('.login-select-display');
                const selectedText = display.querySelector('.selected-value');
                const password = dialog.querySelector('#login-password-input');
                const submitBtn = dialog.querySelector('#login-submit-btn');
                const errorMsg = dialog.querySelector('#login-error-msg');

                let selectedUser = '';

                // Toggle dropdown
                display.onclick = (e) => {
                    e.stopPropagation();
                    dropdown.classList.toggle('open');
                };

                // Select option
                dropdown.querySelectorAll('.login-option').forEach(opt => {
                    opt.onclick = (e) => {
                        e.stopPropagation();
                        selectedUser = opt.dataset.value;
                        selectedText.textContent = selectedUser;
                        dropdown.classList.remove('open');
                        password.focus();
                    };
                });

                // Close on outside click for dropdown
                const outsideClick = (e) => {
                    if (!dropdown.contains(e.target)) {
                        dropdown.classList.remove('open');
                    }
                };
                window.addEventListener('click', outsideClick);

                // Need custom cleanup to remove the window event listener for the dropdown
                const handleCleanup = () => {
                    window.removeEventListener('click', outsideClick);
                    cleanup();
                };

                const handleLogin = async () => {
                    const user = selectedUser;
                    const pass = password.value;

                    if (!user) { errorMsg.textContent = 'Bitte Nutzer auswählen'; return; }
                    if (!pass) { errorMsg.textContent = 'Bitte Passwort eingeben'; return; }

                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Wird angemeldet...';
                    document.body.style.cursor = 'wait';

                    try {
                        const result = await AuthService.authenticate(user, pass);
                        document.body.style.cursor = 'default';

                        handleCleanup();
                        resolve({
                            username: user,
                            password: pass,
                            role: result.role,
                            userId: result.userId,
                        });
                    } catch (e) {
                        errorMsg.textContent = e.message;
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Anmelden';
                        document.body.style.cursor = 'default';
                    }
                };

                submitBtn.addEventListener('click', handleLogin);
                password.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
                setTimeout(() => password.focus(), 100);
            }
        });
    }
}
