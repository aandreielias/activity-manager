import '../styles/LoginDialog.css';
import { AuthService } from '../services/AuthService.js';

/**
 * LoginDialog — Login UI that authenticates against the relational `users` table.
 */
export class LoginDialog {
    /**
     * Show the login dialog and return a promise that resolves with user credentials.
     * @param {Array} peopleData List of users available to select.
     */
    static async show(peopleData) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'login-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'login-dialog dialog-window';
            dialog.innerHTML = `
                <h2>Login</h2>
                <div class="login-input-group">
                    <div id="login-user-dropdown" class="custom-login-select">
                        <div class="login-select-display">
                            <span class="selected-value">Nutzer Auswählen</span>
                            <span class="dropdown-arrow">▼</span>
                        </div>
                        <div class="login-select-options">
                            ${(peopleData || []).map(p => {
                                const name = `${p.vorname || ''} ${p.nachname || ''}`.trim();
                                if (!name) return '';
                                const role = p.role || '';
                                return `
                                    <div class="login-option" data-value="${name}">
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

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const dropdown = dialog.querySelector('#login-user-dropdown');
            const display = dropdown.querySelector('.login-select-display');
            const selectedText = display.querySelector('.selected-value');
            const optionsContainer = dropdown.querySelector('.login-select-options');
            const password = dialog.querySelector('#login-password-input');
            const submitBtn = dialog.querySelector('#login-submit-btn');
            const errorMsg = dialog.querySelector('#login-error-msg');

            let selectedUser = '';

            // Toggle dropdown
            display.onclick = (e) => {
                e.stopPropagation();
                const isOpen = dropdown.classList.contains('open');
                // Close all other dropdowns if any
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

            // Close on outside click
            const outsideClick = (e) => {
                if (!dropdown.contains(e.target)) {
                    dropdown.classList.remove('open');
                }
            };
            window.addEventListener('click', outsideClick);

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

                    window.removeEventListener('click', outsideClick);
                    document.body.removeChild(overlay);
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
        });
    }
}
