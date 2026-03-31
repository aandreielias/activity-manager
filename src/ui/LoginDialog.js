import '../styles/LoginDialog.css';

export class LoginDialog {
    static async show(peopleData) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'login-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'login-dialog dialog-window';

            const title = document.createElement('h2');
            title.textContent = 'Login';
            dialog.appendChild(title);

            const select = document.createElement('select');
            select.className = 'login-select input-field';
            
            // Add placeholder
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Nutzer Auswählen';
            placeholder.disabled = true;
            placeholder.selected = true;
            placeholder.hidden = true;
            select.appendChild(placeholder);

            // Add people
            if (peopleData && Array.isArray(peopleData)) {
                peopleData.forEach(p => {
                    const name = `${p.vorname || ''} ${p.nachname || ''}`.trim();
                    if (name) {
                        const opt = document.createElement('option');
                        opt.value = name;
                        opt.textContent = name;
                        select.appendChild(opt);
                    }
                });
            }

            dialog.appendChild(select);

            const password = document.createElement('input');
            password.type = 'password';
            password.placeholder = 'Passwort';
            password.className = 'login-password input-field';
            dialog.appendChild(password);

            const btn = document.createElement('button');
            btn.className = 'login-btn header-btn no-icon';
            btn.textContent = 'Anmelden';
            dialog.appendChild(btn);

            const errorMsg = document.createElement('div');
            errorMsg.className = 'login-error';
            dialog.appendChild(errorMsg);

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const doLogin = async () => {
                const user = select.value;
                const pass = password.value;

                if (!user) {
                    errorMsg.textContent = 'Bitte Nutzer auswählen';
                    return;
                }
                if (!pass) {
                    errorMsg.textContent = 'Bitte Passwort eingeben';
                    return;
                }

                btn.disabled = true;
                btn.textContent = 'Wird angemeldet...';
                
                try {
                    const { SUPABASE_CONFIG } = await import('../config.js');
                    const supabaseAuthRes = await fetch(`${SUPABASE_CONFIG.URL}/rest/v1/table_data?id=eq.app_auth&select=rows`, {
                        headers: { 'apikey': SUPABASE_CONFIG.ANON_KEY, 'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}` }
                    });
                    
                    if (!supabaseAuthRes.ok) {
                        throw new Error('Verbindung zu Supabase fehlgeschlagen');
                    }

                    const sbAuthData = await supabaseAuthRes.json();
                    const authMap = sbAuthData && sbAuthData[0] ? sbAuthData[0].rows : {};

                    // Check if password matches
                    if (authMap[user] && authMap[user] !== pass) {
                        throw new Error('Ungültiges Passwort');
                    }

                    // Success or Register (if user doesn't exist yet, we allow it for this simplified app)
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

                    // Resolve
                    document.body.removeChild(overlay);
                    resolve({ username: user, password: pass, role: user === 'root' ? 'admin' : 'user' });

                } catch (e) {
                    errorMsg.textContent = e.message;
                    btn.disabled = false;
                    btn.textContent = 'Anmelden';
                }
            };

            btn.addEventListener('click', doLogin);
            password.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') doLogin();
            });
            
            // Focus password on open
            setTimeout(() => password.focus(), 100);
        });
    }
}
