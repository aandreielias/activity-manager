import '../styles/UserInfoPage.css';
import { UserStatsService } from '../services/UserStatsService.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';
import { AuditLogsDialog } from './AuditLogsDialog.js';


/**
 * UserInfoPage - Centralized Administrative Dashboard (Simplified).
 * Focuses purely on system statistics and individual user activity levels.
 * All permission management, team configuration, and role management UI has been removed.
 */
export class UserInfoPage {
    static async show(peopleData, tableConfigs, allTables = {}) {
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
        const name = `${person.vorname || ''} ${person.nachname || ''}`.trim();
        const activityLevel = userStat.activityLevel || 'Idle';
        const lastLoginStr = userStat.lastLogin ? new Date(userStat.lastLogin).toLocaleDateString('de-DE') : 'N/A';
        const userRole = person.role || 'User';

        container.innerHTML = `
            <div class="user-profile-view anim-fade-in">
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

                <div class="profile-section">
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
            </div>
        `;
    }
}
