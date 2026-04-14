import '../styles/UserInfoPage.css';
import { UserStatsService } from '../services/UserStatsService.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';
import { AuditLogsDialog } from './AuditLogsDialog.js';
import { AuthService } from '../services/AuthService.js';
import { PermissionHub } from '../core/PermissionHub.js';
import { Dialog } from './Dialog.js';


/**
 * UserInfoPage - Centralized Administrative Dashboard (Simplified).
 * Focuses purely on system statistics and individual user activity levels.
 * All permission management, team configuration, and role management UI has been removed.
 */
export class UserInfoPage {
    static async show(peopleData, tableConfigs, allTables = {}) {
        const globalState = GlobalStateManager.getInstance();
        if (!globalState.isSuperAdmin()) {
            alert('Nur SuperAdmins haben Zugriff auf das System-Dashboard.');
            return;
        }
        if (document.querySelector('.user-info-overlay')) return;

        return new Promise(async (resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'user-info-overlay';
            document.body.appendChild(overlay);

            const close = () => {
                if (overlay.parentNode) document.body.removeChild(overlay);
                resolve();
            };

            const dialog = document.createElement('div');
            dialog.className = 'user-info-dialog';
            dialog.innerHTML = '<div class="empty-state-large">Lade System-Statistiken...</div>';
            overlay.appendChild(dialog);

            const gameRespCounts = {};
            const eventsTable = allTables['tbl_events']?.instance;
            if (eventsTable) {
                eventsTable.rows.forEach(row => {
                    const gamesRaw = row.data.games || '';
                    let games = [];
                    try { games = JSON.parse(gamesRaw); } catch (e) {}
                    if (Array.isArray(games)) {
                        games.forEach(g => {
                            if (g.responsible) {
                                gameRespCounts[g.responsible] = (gameRespCounts[g.responsible] || 0) + 1;
                            }
                        });
                    }
                });
            }

            let stats = {};
            try { stats = await UserStatsService.getStats(); } catch (e) {}

            dialog.innerHTML = '';
            const globalState = GlobalStateManager.getInstance();
            const isSuperAdmin = globalState.isSuperAdmin();

            const header = document.createElement('div');
            header.className = 'user-info-header';
            header.innerHTML = `
                <div class="user-info-title-area">
                    <h2>System-Dashboard</h2>
                    <p>Globale Statistiken & Nutzer-Aktivität</p>
                </div>
                <div class="user-info-selection">
                    <select class="user-select-dropdown">
                        <option value="" disabled selected>Nutzer-Profil wählen...</option>
                        ${peopleData
                            .filter(p => isSuperAdmin || (p.role || '').toLowerCase() !== 'superadmin')
                            .map(p => {
                                const name = `${p.vorname || ''} ${p.nachname || ''}`.trim();
                                return `<option value="${name}">${name}</option>`;
                            }).join('')}
                    </select>
                </div>
                <div class="user-info-header-actions">
                    <button class="logs-toggle-btn secondary-btn" style="margin-right: 12px; padding: 6px 12px; font-size: 12px; height: 32px; font-weight: 500;">
                        System-Logs
                    </button>
                    <button class="close-info-btn" aria-label="Schließen">✕</button>
                </div>
            `;
            dialog.appendChild(header);

            const content = document.createElement('div');
            content.className = 'user-info-content';

            let totalGames = 0, totalSports = 0;
            let activePeople = peopleData.filter(p => !p.Status || String(p.Status).toLowerCase() === 'aktiv').length;
            let inactivePeople = peopleData.filter(p => String(p.Status).toLowerCase() === 'inaktiv').length;

            Object.values(allTables).forEach(tWrap => {
                if (!tWrap.config || !tWrap.instance) return;
                if (tWrap.config.category === 'spiele') totalGames += tWrap.instance.rows.length;
                if (tWrap.config.category === 'sportarten') totalSports += tWrap.instance.rows.length;
            });

            const totalEntries = Object.values(allTables).reduce((sum, t) => sum + (t.instance?.rows.length || 0), 0);

            content.innerHTML = `
                <div class="profile-section dash-section" style="margin-top: 0;">
                    <div class="section-header"><h4>Datenbank-Übersicht</h4></div>
                    <div class="dash-overview-row">
                        <div class="dash-kpi"><span class="dash-kpi-val accent">${totalEntries}</span><span class="dash-kpi-lbl">Einträge gesamt</span></div>
                        <div class="dash-kpi"><span class="dash-kpi-val accent">${activePeople}</span><span class="dash-kpi-lbl">Aktive Personen</span></div>
                        <div class="dash-kpi"><span class="dash-kpi-val muted">${inactivePeople}</span><span class="dash-kpi-lbl">Inaktive Personen</span></div>
                        <div class="dash-kpi"><span class="dash-kpi-val accent">${totalGames}</span><span class="dash-kpi-lbl">Spiele</span></div>
                        <div class="dash-kpi"><span class="dash-kpi-val accent">${totalSports}</span><span class="dash-kpi-lbl">Sportarten</span></div>
                    </div>
                </div>
            `;
            dialog.appendChild(content);

            const userSelect = header.querySelector('.user-select-dropdown');
            userSelect.onchange = async (e) => {
                const selectedName = e.target.value;
                const person = peopleData.find(p => `${p.vorname || ''} ${p.nachname || ''}`.trim() === selectedName);
                if (person) {
                    const userStat = stats[selectedName] || {};
                    userStat.gameRespCount = gameRespCounts[person.id] || 0;
                    this._renderUserProfile(content, person, userStat);
                }
            };

            const closeBtn = header.querySelector('.close-info-btn');
            closeBtn.onclick = close;

            const logsBtn = header.querySelector('.logs-toggle-btn');
            if (logsBtn) {
                logsBtn.onclick = async () => {
                    await AuditLogsDialog.show();
                };
            }

            overlay.onclick = (e) => { if (e.target === overlay) close(); };
        });
    }

    static _renderUserProfile(container, person, userStat) {
        const globalState = GlobalStateManager.getInstance();
        const canManage = globalState.canManagePermissions();
        
        container.innerHTML = `
            <div class="user-profile-view anim-fade-in">
                ${this._getProfileHeaderHTML(person, userStat)}
                
                <div class="user-tabs-container">
                    <button class="user-tab-btn active" data-tab="stats">Statistiken</button>
                    ${canManage ? `<button class="user-tab-btn" data-tab="perms">Berechtigungen</button>` : ''}
                </div>

                <div class="user-tab-content">
                    ${this._getStatsTabHTML(person, userStat)}
                </div>
            </div>
        `;

        const tabs = container.querySelectorAll('.user-tab-btn');
        const tabContent = container.querySelector('.user-tab-content');

        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (tab.dataset.tab === 'stats') {
                    tabContent.innerHTML = this._getStatsTabHTML(person, userStat);
                } else {
                    this._renderPermissionsTab(tabContent, person);
                }
            };
        });
    }

    static _getProfileHeaderHTML(person, userStat) {
        const name = `${person.vorname || ''} ${person.nachname || ''}`.trim();
        const activityLevel = userStat.activityLevel || 'Idle';
        const userRole = person.role || 'User';
        return `
            <div class="profile-card hero-card">
                <div class="hero-avatar">${(person.vorname || '?')[0].toUpperCase()}</div>
                <div class="hero-details">
                    <h3>${name}</h3>
                    <div class="hero-badges">
                        <span class="badge role-badge">${userRole}</span>
                        <span class="badge status-badge ${activityLevel.toLowerCase()}">${activityLevel}</span>
                    </div>
                </div>
            </div>
        `;
    }

    static _getStatsTabHTML(person, userStat) {
        const lastLoginStr = userStat.lastLogin ? new Date(userStat.lastLogin).toLocaleDateString('de-DE') : 'N/A';
        return `
            <div class="profile-section anim-fade-in" style="margin-top:0;">
                <div class="section-header"><h4>Benutzer-Leistungsmetriken</h4></div>
                <div class="stats-grid-modern">
                    <div class="stat-card">
                        <span class="stat-label">Erstellte Einträge</span>
                        <span class="stat-value">${userStat.entryCount || 0}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Gespeicherte Favoriten</span>
                        <span class="stat-value highlight">${userStat.favoritesCount || 0}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Letzter System-Zugriff</span>
                        <span class="stat-value">${lastLoginStr}</span>
                    </div>
                </div>
            </div>
        `;
    }

    static async _renderPermissionsTab(container, person) {
        container.innerHTML = '<div class="empty-state-small">Lade Berechtigungen...</div>';
        
        const user = await AuthService.getUserByUsername(`${person.vorname || ''} ${person.nachname || ''}`.trim().toLowerCase());
        const perms = (user && user.permissions) ? user.permissions : { overwrites: {} };
        const overwrites = perms.overwrites || {};

        const gs = GlobalStateManager.getInstance();
        const availableTeams = gs.getAvailableTeams();
        const tableConfigs = gs.getAllTableConfigs();
        
        container.innerHTML = `
            <div class="permissions-tab anim-fade-in">
                <div class="section-header">
                    <h4>Berechtigungs-Konfiguration</h4>
                    <p>Feingranulare Steuerung der Zugriffsebene für diesen Nutzer</p>
                </div>
                
                <div class="perm-category-grid">
                    <div class="perm-category-card" data-cat="spiele">
                        <div class="category-header-row">
                            <div class="category-title-group">
                                <div class="category-title">Spiele</div>
                                <div class="perm-category-desc">Programme & Gemeinschaftsspiele</div>
                            </div>
                            <div class="category-master-control">
                                <div class="master-label">Master-Freigabe:</div>
                                ${this._renderPermSlider('cat_spiele', '', '', overwrites, true)}
                            </div>
                        </div>
                        
                        <div class="category-details-list">
                            ${tableConfigs.filter(t => t.category === 'spiele').map(t => 
                                this._renderPermSlider(t.id, t.title, `Einzelfreigabe: ${t.title}`, overwrites)
                            ).join('')}
                        </div>
                    </div>

                    <div class="perm-category-card" data-cat="sportarten">
                        <div class="category-header-row">
                            <div class="category-title-group">
                                <div class="category-title">Sportarten</div>
                                <div class="perm-category-desc">Sport-Management & Turniere</div>
                            </div>
                            <div class="category-master-control">
                                <div class="master-label">Master-Freigabe:</div>
                                ${this._renderPermSlider('cat_sportarten', '', '', overwrites, true)}
                            </div>
                        </div>

                        <div class="category-details-list">
                            ${tableConfigs.filter(t => t.category === 'sportarten').map(t => 
                                this._renderPermSlider(t.id, t.title, `Einzelfreigabe: ${t.title}`, overwrites)
                            ).join('')}
                        </div>
                    </div>

                    <div class="perm-category-card" data-cat="organisation">
                        <div class="category-header-row">
                            <div class="category-title-group">
                                <div class="category-title">Organisation</div>
                                <div class="perm-category-desc">Ressourcen, Personal und Events</div>
                            </div>
                            <div class="category-master-control">
                                <div class="master-label">Master-Freigabe:</div>
                                ${this._renderPermSlider('cat_organisation', '', '', overwrites, true)}
                            </div>
                        </div>

                        <div class="category-details-list">
                            ${tableConfigs.filter(t => t.category === 'organisation').map(t => 
                                this._renderPermSlider(t.id, t.title, `Einzelfreigabe: ${t.title}`, overwrites)
                            ).join('')}
                        </div>
                    </div>

                    <div class="perm-category-card">
                        <div class="category-title">System</div>
                        ${this._renderPermSlider('btn_stats', 'System-Dashboard', 'Statistiken & Nutzerverwaltung', overwrites)}
                        ${this._renderPermSlider('btn_audit_logs', 'Audit-Logs', 'System-Protokolle & Änderungen', overwrites)}
                    </div>
                </div>

                <div class="perms-footer" style="display: none;">
                    <button class="primary-btn save-perms-btn">Änderungen speichern</button>
                </div>
            </div>
        `;

        // Store initial state for change detection
        container.dataset.initialOverwrites = JSON.stringify(overwrites);

        this._attachSliderEvents(container);

        const saveBtn = container.querySelector('.save-perms-btn');
        saveBtn.onclick = async () => {
            const newOverwrites = {};
            container.querySelectorAll('.segmented-control').forEach(ctrl => {
                const id = ctrl.dataset.id;
                const val = parseInt(ctrl.dataset.val, 10);
                
                // If a master toggle is NOT in "Manuell" (-2), we save its value.
                // If it IS in "Manuell", we effectively ignore it in the hub check (by not saving it or saving as -2).
                if (val !== -1) {
                    newOverwrites[id] = val;
                }
            });

            try {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Speichere...';
                await AuthService.savePermissions(user.username, { overwrites: newOverwrites });
                GlobalStateManager.getInstance().showFlashMessage('Berechtigungen erfolgreich aktualisiert.');
                saveBtn.textContent = 'Gespeichert!';
                setTimeout(() => {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Änderungen speichern';
                }, 2000);
            } catch (e) {
                alert('Speichern fehlgeschlagen: ' + e.message);
                saveBtn.disabled = false;
                saveBtn.textContent = 'Änderungen speichern';
            }
        };
    }

    static _attachSliderEvents(container) {
        const initial = JSON.parse(container.dataset.initialOverwrites || '{}');
        const footer = container.querySelector('.perms-footer');
        
        const checkForChanges = () => {
            let hasChanged = false;
            container.querySelectorAll('.segmented-control').forEach(ctrl => {
                const id = ctrl.dataset.id;
                const currentVal = parseInt(ctrl.dataset.val, 10);
                const initialVal = initial[id] !== undefined ? initial[id] : -1;
                
                if (currentVal !== initialVal) {
                    hasChanged = true;
                }
            });
            
            if (footer) footer.style.display = hasChanged ? 'flex' : 'none';
        };

        container.querySelectorAll('.segment-item').forEach(item => {
            item.onclick = (e) => {
                const ctrl = e.target.closest('.segmented-control');
                const val = parseInt(e.target.dataset.val, 10);
                ctrl.dataset.val = val;
                
                const id = ctrl.dataset.id;
                if (id && id.startsWith('cat_')) {
                    const card = ctrl.closest('.perm-category-card');
                    const details = card?.querySelector('.category-details-list');
                    if (details) {
                        details.classList.toggle('manual-mode', val === -2);
                    }
                }
                
                checkForChanges();
            };
        });

        container.querySelectorAll('.segmented-control[data-id^="cat_"]').forEach(ctrl => {
            const val = parseInt(ctrl.dataset.val, 10);
            const card = ctrl.closest('.perm-category-card');
            const details = card?.querySelector('.category-details-list');
            if (details) {
                details.classList.toggle('manual-mode', val === -2);
            }
        });
        
        // Initial check in case anything starts in a changed state (unlikely but safe)
        checkForChanges();
    }

    static _renderPermSlider(id, label, desc, overwrites, isMaster = false) {
        const currentVal = overwrites[id] !== undefined ? overwrites[id] : -1;
        
        return `
            <div class="perm-item ${!label ? 'no-label' : ''}">
                ${label ? `
                <div class="perm-info">
                    <div class="perm-label">${label}</div>
                    <div class="perm-desc">${desc}</div>
                </div>
                ` : ''}
                <div class="segmented-control ${isMaster ? 'master-slider' : ''}" data-id="${id}" data-val="${currentVal}">
                    <div class="slider"></div>
                    ${isMaster ? `<div class="segment-item" data-val="-2">Manuell</div>` : ''}
                    <div class="segment-item" data-val="-1">Stand.</div>
                    <div class="segment-item" data-val="0">Kein</div>
                    <div class="segment-item" data-val="1">Lesen</div>
                    <div class="segment-item" data-val="2">Schr.</div>
                </div>
            </div>
        `;
    }
}
