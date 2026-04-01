import '../styles/UserInfoPage.css';
import { UserStatsService } from '../services/UserStatsService.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';
import { DataService } from '../services/DataService.js';
import { AuthService } from '../services/AuthService.js';

/**
 * UserInfoPage - Clean Administrative Dashboard
 * Perfectly aligned with the application's design system.
 */
export class UserInfoPage {
    static async show(peopleData, tableConfigs) {
        return new Promise(async (resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'user-info-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'user-info-dialog';

            const stats = await UserStatsService.getStats();
            const permissionsMap = JSON.parse(localStorage.getItem('app_permissions_map') || '{}');
            const globalState = GlobalStateManager.getInstance();
            const isSuperAdmin = globalState.isSuperAdmin();
            const canSeeStats = globalState.canSeeStats();
            const canSeePermissions = globalState.canSeePermissions();

            const header = document.createElement('div');
            header.className = 'user-info-header';
            header.innerHTML = `
                <h2>Nutzer-Verwaltung</h2>
                <div class="user-info-selection">
                    <select class="user-select-dropdown">
                        <option value="" disabled selected>Nutzer auswählen...</option>
                        ${peopleData.map(p => {
                            const name = `${p.vorname || ''} ${p.nachname || ''}`.trim();
                            return `<option value="${name}">${name}</option>`;
                        }).join('')}
                    </select>
                </div>
                <button class="close-info-btn">Schließen</button>
            `;
            dialog.appendChild(header);

            const content = document.createElement('div');
            content.className = 'user-info-content';
            content.innerHTML = `
                <div class="empty-state">
                    <p style="font-size: 14px; color: var(--text-muted);">
                        Wählen Sie einen Nutzer aus, um Statistiken und Berechtigungen anzuzeigen.
                    </p>
                </div>
            `;
            dialog.appendChild(content);

            const userSelect = header.querySelector('.user-select-dropdown');
            userSelect.onchange = (e) => {
                const selectedName = e.target.value;
                const person = peopleData.find(p => `${p.vorname || ''} ${p.nachname || ''}`.trim() === selectedName);
                if (person) {
                    this._renderUserProfile(content, person, stats[selectedName] || {}, permissionsMap, tableConfigs, isSuperAdmin, canSeeStats, canSeePermissions, peopleData);
                }
            };

            const closeBtn = header.querySelector('.close-info-btn');
            closeBtn.onclick = () => {
                document.body.removeChild(overlay);
                resolve();
            };

            overlay.onclick = (e) => { if (e.target === overlay) closeBtn.onclick(); };

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
        });
    }

    static _renderUserProfile(container, person, userStat, permissionsMap, tableConfigs, isSuperAdmin, canSeeStats, canSeePermissions, peopleData) {
        const name = `${person.vorname || ''} ${person.nachname || ''}`.trim();
        const userPerm = permissionsMap[name] || { type: 'except_people', canManageUsers: false, managementAccess: 'none' };
        
        const winRate = (userStat.blackjackWins + userStat.blackjackLosses) > 0 
            ? Math.round((userStat.blackjackWins / (userStat.blackjackWins + userStat.blackjackLosses)) * 100) 
            : 0;

        const topCategory = this._getTopCategory(userStat.categoryHits);
        const activityLevel = this._getActivityLevel(userStat.lastLogin);
        const lastLoginStr = userStat.lastLogin ? new Date(userStat.lastLogin).toLocaleDateString('de-DE') : 'N/A';

        container.innerHTML = `
            <div class="user-profile-view">
                <div class="profile-hero">
                    <div class="hero-avatar">${(person.vorname || '?')[0].toUpperCase()}</div>
                    <div class="hero-info">
                        <h3>${name}</h3>
                        <div class="hero-meta">
                            <span class="status-aktiv" style="font-size: 11px; padding: 2px 8px; border-radius: 4px; ${activityLevel === 'Idle' ? 'background: var(--bg-tertiary); color: var(--text-muted);' : ''}">${activityLevel}</span>
                            <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">${person.role || 'Nutzer'}</span>
                        </div>
                    </div>
                </div>

                ${canSeeStats ? `
                <div class="stats-grid">
                    <div class="stat-tile"><span class="tile-label">Einträge</span><span class="tile-val">${userStat.entryCount || 0}</span></div>
                    <div class="stat-tile"><span class="tile-label">Favoriten</span><span class="tile-val" style="color:var(--accent);">${userStat.favoritesCount || 0}</span></div>
                    <div class="stat-tile"><span class="tile-label">Area</span><span class="tile-val" style="color:var(--accent);">${topCategory}</span></div>
                </div>
                ` : ''}

                ${canSeeStats ? `
                <div class="blackjack-minimal-bar">
                    <span class="bj-min-title">Aktivität-Details</span>
                    <div class="bj-min-stats">
                        <div class="bj-min-item">Zul.: <b>${lastLoginStr}</b></div>
                        <div class="bj-min-item">Win: <b style="color: ${winRate > 50 ? 'var(--success)' : ''}">${winRate}%</b></div>
                        <div class="bj-min-item">Streak: <b>${userStat.blackjackHighestStreak || 0}</b></div>
                    </div>
                </div>
                ` : ''}

                <div class="admin-settings-container">
                    ${isSuperAdmin ? `
                    <div class="admin-pane">
                        <h4>System-Privilegien</h4>
                        <div class="mgmt-field">
                            <label>Dashboard Zugriff</label>
                            <select class="management-access-select">
                                <option value="none" ${userPerm.managementAccess === 'none' ? 'selected' : ''}>Kein Zugriff</option>
                                <option value="stats_only" ${userPerm.managementAccess === 'stats_only' ? 'selected' : ''}>Nur Statistiken</option>
                                <option value="stats_perms" ${userPerm.managementAccess === 'stats_perms' ? 'selected' : ''}>Stats & Berechtigungen</option>
                            </select>
                        </div>
                        <div class="roles-box">
                            <span>Administrator</span>
                            <label class="switch">
                                <input type="checkbox" class="admin-toggle-cb" ${person.role === 'Admin' ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    ` : ''}

                    ${canSeePermissions ? `
                    <div class="admin-pane">
                        <h4>Berechtigungen</h4>
                        <div class="perm-controls">
                            <button class="permission-readonly-toggle ${userPerm.type === 'readonly' ? 'active' : ''}">Read-Only</button>
                            <select class="permission-type-select" style="display: ${userPerm.type === 'readonly' ? 'none' : 'block'}">
                                <option value="all" ${userPerm.type === 'all' ? 'selected' : ''}>Voller Zugriff</option>
                                <option value="except_people" ${userPerm.type === 'except_people' ? 'selected' : ''}>Außer Personen</option>
                                <option value="except_inventory" ${userPerm.type === 'except_inventory' ? 'selected' : ''}>Außer Inventar</option>
                                <option value="specific" ${userPerm.type === 'specific' ? 'selected' : ''}>Spezifisch...</option>
                            </select>
                        </div>
                        <div class="specific-tables-grid" style="display: ${ (userPerm.type === 'readonly' || userPerm.type === 'specific') ? 'grid' : 'none'};">
                            ${this._renderTableCheckboxes(tableConfigs, userPerm)}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        this._attachProfileListeners(container, name, userPerm, permissionsMap, peopleData, canSeePermissions, isSuperAdmin);
    }

    static _attachProfileListeners(container, name, userPerm, permissionsMap, peopleData, canSeePermissions, isSuperAdmin) {
        const savePerms = () => {
            const isReadonly = container.querySelector('.permission-readonly-toggle')?.classList.contains('active');
            let type = container.querySelector('.permission-type-select')?.value;
            if (isReadonly) type = 'readonly';
            
            const mgmtSelect = container.querySelector('.management-access-select');
            const managementAccess = mgmtSelect ? mgmtSelect.value : (userPerm.managementAccess || 'none');
            const canManage = (managementAccess === 'stats_only' || managementAccess === 'stats_perms');
            
            const tables = [];
            container.querySelectorAll('.specific-tables-grid input:checked').forEach(cb => tables.push(cb.value));

            const newPerms = { type: type || userPerm.type, tables, canManageUsers: canManage, managementAccess };
            AuthService.savePermissions(name, newPerms);
        };

        if (canSeePermissions) {
            const roBtn = container.querySelector('.permission-readonly-toggle');
            const typeSel = container.querySelector('.permission-type-select');
            const grid = container.querySelector('.specific-tables-grid');

            if (roBtn && typeSel && grid) {
                roBtn.onclick = () => {
                    roBtn.classList.toggle('active');
                    typeSel.style.display = roBtn.classList.contains('active') ? 'none' : 'block';
                    grid.style.display = (roBtn.classList.contains('active') || typeSel.value === 'specific') ? 'grid' : 'none';
                    savePerms();
                };
                typeSel.onchange = () => {
                    grid.style.display = (typeSel.value === 'specific') ? 'grid' : 'none';
                    savePerms();
                };
                grid.querySelectorAll('input').forEach(cb => cb.onchange = savePerms);
            }
        }

        if (isSuperAdmin) {
            const ms = container.querySelector('.management-access-select');
            if (ms) ms.onchange = savePerms;
            const at = container.querySelector('.admin-toggle-cb');
            if (at) at.onchange = () => {
                const person = peopleData.find(p => `${p.vorname || ''} ${p.nachname || ''}`.trim() === name);
                if (person) {
                    person.role = at.checked ? 'Admin' : 'user';
                    DataService.saveTable('tbl_people', 'people.json', peopleData);
                }
            };
        }
    }

    static _getActivityLevel(lastLogin) {
        if (!lastLogin) return 'Idle';
        const diffDays = (new Date() - new Date(lastLogin)) / (1000 * 60 * 60 * 24);
        return diffDays < 2 ? 'Aktiv' : (diffDays < 7 ? 'Kürzlich' : 'Idle');
    }

    static _getTopCategory(hits) {
        if (!hits || Object.keys(hits).length === 0) return 'N/A';
        let top = 'N/A', max = 0;
        Object.entries(hits).forEach(([cat, val]) => { if (val > max) { max = val; top = cat.charAt(0).toUpperCase() + cat.slice(1); } });
        return top;
    }

    static _renderTableCheckboxes(tableConfigs, userPerm) {
        const tables = [
            { id: 'people_table', label: 'Personen (Split)' },
            { id: 'tbl_people', label: 'Personen (Haupt)' },
            { id: 'tbl_inventory', label: 'Inventar' },
            ...tableConfigs.filter(t => !['tbl_people', 'tbl_inventory'].includes(t.id)).map(t => ({ id: t.id, label: t.title }))
        ];

        return tables.map(t => {
            const checked = (userPerm.type === 'specific' || userPerm.type === 'readonly') && Array.isArray(userPerm.tables) && userPerm.tables.includes(t.id);
            return `<label class="perm-checkbox"><input type="checkbox" value="${t.id}" ${checked ? 'checked' : ''}><span>${t.label}</span></label>`;
        }).join('');
    }
}
