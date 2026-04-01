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
                    <select id="login-user-select" class="login-select input-field">
                        <option value="" disabled selected hidden>Nutzer Auswählen</option>
                        ${(peopleData || []).map(p => {
                            const name = `${p.vorname || ''} ${p.nachname || ''}`.trim();
                            return name ? `<option value="${name}">${name}</option>` : '';
                        }).join('')}
                    </select>
                </div>
                <div class="login-input-group">
                    <input type="password" id="login-password-input" placeholder="Passwort" class="login-password input-field">
                </div>
                <button id="login-submit-btn" class="login-btn header-btn no-icon">Anmelden</button>
                <div id="login-error-msg" class="login-error"></div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const select = dialog.querySelector('#login-user-select');
            const password = dialog.querySelector('#login-password-input');
            const submitBtn = dialog.querySelector('#login-submit-btn');
            const errorMsg = dialog.querySelector('#login-error-msg');

            const handleLogin = async () => {
                const user = select.value;
                const pass = password.value;

                if (!user) { errorMsg.textContent = 'Bitte Nutzer auswählen'; return; }
                if (!pass) { errorMsg.textContent = 'Bitte Passwort eingeben'; return; }

                submitBtn.disabled = true;
                submitBtn.textContent = 'Wird angemeldet...';

                try {
                    const result = await AuthService.authenticate(user, pass);

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
                }
            };

            submitBtn.addEventListener('click', handleLogin);
            password.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
            setTimeout(() => password.focus(), 100);
        });
    }
}
