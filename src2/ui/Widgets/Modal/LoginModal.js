import { BaseModal } from "./BaseModal.js";
import { Authenticator } from "../../../core/Database/Authenticator.js";

export class LoginModal extends BaseModal {
    constructor(onSuccessCallback) {
        super("Anmelden");
        this.onSuccessCallback = onSuccessCallback;
    }

    close() { }

    renderBody(container) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px; padding: 10px;">
                <input type="text" id="login-user" placeholder="Benutzername" style="padding: 10px; border-radius: var(--radius-sm); border: none; outline: none; background: var(--bg-hover);">
                <input type="password" id="login-pass" placeholder="Passwort" style="padding: 10px; border-radius: var(--radius-sm); border: none; outline: none; background: var(--bg-hover);">
                <button id="login-btn" style="padding: 10px; background: var(--accent); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-weight: bold; margin-top: 10px;">Login</button>
            </div>
        `;

        const btn = container.querySelector('#login-btn');
        btn.addEventListener('click', async () => {
            const user = container.querySelector('#login-user').value;
            const pass = container.querySelector('#login-pass').value;

            if (!user || !pass) return;

            btn.textContent = "...";
            btn.disabled = true;

            const success = await Authenticator.login(user, pass);

            if (success) {
                BaseModal.prototype.close.call(this);
                if (this.onSuccessCallback) this.onSuccessCallback();
            } else {
                btn.textContent = "Login";
                btn.disabled = false;
            }
        });
    }
}