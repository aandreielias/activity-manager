import '../styles/LoginDialog.css';
import { UserStatsService } from '../services/UserStatsService.js';
import { SUPABASE_CONFIG } from '../config.js';

/**
 * LoginDialog - Displays and handles the authentication dialog.
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
                    const authMap = await this._fetchAuthMap();
                    await this._validateAndStoreAuth(user, pass, authMap);
                    
                    document.body.removeChild(overlay);
                    resolve({ username: user, password: pass, role: user === 'root' ? 'admin' : 'user' });
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

    /**
     * Fetch auth data from Supabase.
     */
    static async _fetchAuthMap() {
        const res = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data?id=eq.app_auth&select=rows`, {
            headers: { 'apikey': SUPABASE_CONFIG.ANON_KEY, 'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}` }
        });
        
        if (!res.ok) throw new Error('Verbindung zu Supabase fehlgeschlagen');
        const data = await res.json();
        return data?.[0]?.rows || {};
    }

    /**
     * Validate password and update auth map if necessary.
     */
    static async _validateAndStoreAuth(user, pass, authMap) {
        if (authMap[user] && authMap[user] !== pass) {
            throw new Error('Ungültiges Passwort');
        }

        if (!authMap[user]) {
            authMap[user] = pass;
            await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'apikey': SUPABASE_CONFIG.ANON_KEY, 
                    'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`, 
                    'Prefer': 'resolution=merge-duplicates' 
                },
                body: JSON.stringify({ id: 'app_auth', rows: authMap })
            });
        }
        
        await UserStatsService.recordLogin(user);
    }
}
