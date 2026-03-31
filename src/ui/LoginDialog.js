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

            // Pre-fill from localStorage if available? 
            // The prompt says "the chosen user gets saved so you dont have to login everytime"
            // We'll handle this generically in main.js, this dialog is ONLY shown if we need to login

            const doLogin = async () => {
                const user = select.value;
                const pass = password.value;
                if (!pass) {
                    errorMsg.textContent = 'Bitte Passwort eingeben';
                    return;
                }

                btn.disabled = true;
                btn.textContent = 'Wird angemeldet...';
                
                try {
                    const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: user, password: pass })
                    });
                    
                    let data;
                    const responseText = await res.text();
                    
                    try {
                        data = JSON.parse(responseText);
                    } catch (parseError) {
                        console.error('Server response is not valid JSON:', responseText);
                        throw new Error(`Server antwortete ungültig (${res.status})`);
                    }

                    if (!res.ok || !data.success) {
                        throw new Error(data.error || 'Login fehlgeschlagen');
                    }

                    // Success
                    document.body.removeChild(overlay);
                    resolve({ username: user, password: pass, role: data.role });

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
