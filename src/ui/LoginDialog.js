import '../styles/LoginDialog.css';
import { AuthService } from '../services/AuthService.js';
import { BaseDialog } from './BaseDialog.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';

export class LoginDialog {
    static async show(peopleData) {
        const gs = GlobalStateManager.getInstance();
        const availableTeams = gs.getAvailableTeams();
        
        // Filter out inactive users immediately and sort alphabetically
        const activePeople = (peopleData || [])
            .filter(p => {
                const isInactive = (p.Status || '').toLowerCase() === 'inaktiv' || (p.role || '').toLowerCase() === 'inaktiv';
                return !isInactive;
            })
            .sort((a, b) => {
                const nameA = `${a.vorname || ''} ${a.nachname || ''}`.trim().toLowerCase();
                const nameB = `${b.vorname || ''} ${b.nachname || ''}`.trim().toLowerCase();
                return nameA.localeCompare(nameB);
            });

        return BaseDialog.show({
            overlayClassName: 'login-overlay',
            dialogClassName: 'login-dialog dialog-window',
            closeOnEscape: true,
            closeOnOutsideClick: false,
            onEscapeValue: null,
            render: (dialog, overlay, resolve, cleanup) => {
                dialog.innerHTML = `
                    <h2>Login</h2>
                    
                    <div class="login-input-group login-row">
                        <div id="login-user-dropdown" class="custom-login-select">
                            <div class="login-select-display">
                                <span class="selected-value">Nutzer Auswählen</span>
                                <span class="dropdown-arrow">▼</span>
                            </div>
                            <div class="login-select-options" id="login-user-options-container">
                                <!-- Users will be rendered here dynamically -->
                            </div>
                        </div>

                        <div id="login-team-dropdown" class="custom-login-select">
                            <div class="login-select-display">
                                <span class="selected-value">Alle</span>
                                <span class="dropdown-arrow">▼</span>
                            </div>
                            <div class="login-select-options">
                                <div class="login-option" data-value="all">
                                    <span class="option-name">Alle</span>
                                </div>
                                ${availableTeams.map(t => `
                                    <div class="login-option" data-value="${t.name}">
                                        <span class="option-name">${t.name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="login-input-group">
                        <input type="password" id="login-password-input" placeholder="Passwort" class="login-password input-field">
                    </div>
                    <button id="login-submit-btn" class="login-btn header-btn no-icon">Anmelden</button>
                    <div id="login-error-msg" class="login-error"></div>
                `;

                const teamDropdown = dialog.querySelector('#login-team-dropdown');
                const userDropdown = dialog.querySelector('#login-user-dropdown');
                const userOptionsContainer = dialog.querySelector('#login-user-options-container');
                const password = dialog.querySelector('#login-password-input');
                const submitBtn = dialog.querySelector('#login-submit-btn');
                const errorMsg = dialog.querySelector('#login-error-msg');

                let selectedUser = '';
                let currentTeamFilter = 'all';

                const renderUsers = (filterTeam = 'all') => {
                    const filtered = activePeople.filter(p => {
                        if (filterTeam === 'all') return true;
                        const pTeams = (p.Team || p.Teams || '').split(',').map(s => s.trim()).filter(Boolean);
                        return pTeams.includes(filterTeam);
                    });

                    userOptionsContainer.innerHTML = filtered.map(p => {
                        const name = `${p.vorname || ''} ${p.nachname || ''}`.trim();
                        if (!name) return '';
                        const teams = p.Team || p.Teams || '';
                        return `
                            <div class="login-option stacked" data-value="${name}">
                                <div class="option-name">${name}</div>
                                <div class="option-role">${teams}</div>
                            </div>
                        `;
                    }).join('');

                    // Re-attach clicks
                    userOptionsContainer.querySelectorAll('.login-option').forEach(opt => {
                        opt.onclick = (e) => {
                            e.stopPropagation();
                            selectedUser = opt.dataset.value;
                            userDropdown.querySelector('.selected-value').textContent = selectedUser;
                            userDropdown.classList.remove('open');
                            password.focus();
                        };
                    });
                };

                // Initial render
                renderUsers();

                // Toggle dropdowns
                [teamDropdown, userDropdown].forEach(dd => {
                    const display = dd.querySelector('.login-select-display');
                    display.onclick = (e) => {
                        e.stopPropagation();
                        // Close other if open
                        [teamDropdown, userDropdown].filter(d => d !== dd).forEach(d => d.classList.remove('open'));
                        dd.classList.toggle('open');
                    };
                });

                // Team filter selection
                teamDropdown.querySelectorAll('.login-option').forEach(opt => {
                    opt.onclick = (e) => {
                        e.stopPropagation();
                        currentTeamFilter = opt.dataset.value;
                        teamDropdown.querySelector('.selected-value').textContent = currentTeamFilter === 'all' ? 'Alle' : currentTeamFilter;
                        teamDropdown.classList.remove('open');
                        
                        // Reset selected user when team changes
                        selectedUser = '';
                        userDropdown.querySelector('.selected-value').textContent = 'Nutzer Auswählen';
                        
                        renderUsers(currentTeamFilter);
                    };
                });

                // Close on outside click for dropdown
                const outsideClick = (e) => {
                    if (!teamDropdown.contains(e.target) && !userDropdown.contains(e.target)) {
                        teamDropdown.classList.remove('open');
                        userDropdown.classList.remove('open');
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
                            permissions: result.permissions,
                            personId: result.personId
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
