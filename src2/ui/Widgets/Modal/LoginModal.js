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
            <div class="login-form-container">
                <input type="text" id="login-user" placeholder="Benutzername" class="login-input">
                <input type="password" id="login-pass" placeholder="Passwort" class="login-input">
                <button id="login-btn" class="login-btn">Login</button>
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