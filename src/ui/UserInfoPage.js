import '../styles/UserInfoPage.css';
import { UserStatsService } from '../services/UserStatsService.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';
import { DataService } from '../services/DataService.js';
import { AuthService } from '../services/AuthService.js';
import { PermissionService } from '../services/PermissionService.js';
import { Dialog } from './Dialog.js';

/**
 * UserInfoPage - Centralized Administrative Dashboard.
 * Manages users, statistics, and fine-grained permissions.
 */
export class UserInfoPage {
    static async show(peopleData, tableConfigs, allTables = {}) {
        // Purely DOM-driven check for robustness
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
            dialog.innerHTML = '<div class="empty-state-large">Lade Nutzer-Daten...</div>';
            overlay.appendChild(dialog);

            // Pre-calculate game responsibility counts from events
            const gameRespCounts = {};
            const eventsTable = allTables['tbl_events']?.instance;
            if (eventsTable) {
                eventsTable.rows.forEach(row => {
                    const gamesRaw = row.data.games || '';
                    let games = [];
                    try {
                        games = JSON.parse(gamesRaw);
                    } catch (e) {
                        // ignore classic format for stats as it has no responsible person linked
                    }
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
            try {
                stats = await UserStatsService.getStats();
            } catch (e) {
                console.error('[UserInfoPage] Failed to load stats:', e);
            }
            dialog.innerHTML = '';

            const globalState = GlobalStateManager.getInstance();
            const isSuperAdmin = globalState.isSuperAdmin();

            const header = document.createElement('div');
            header.className = 'user-info-header';
            header.innerHTML = `
                <div class="user-info-title-area">
                    <h2>System-Stats</h2>
                    <p>Dashboard & Berechtigungen verwalten</p>
                </div>
                <div class="user-info-selection">
                    <select class="user-select-dropdown">
                        <option value="" disabled selected>Nutzer auswählen...</option>
                        ${peopleData
        .filter(p => isSuperAdmin || (p.role || '').toLowerCase() !== 'superadmin')
        .map(p => {
            const name = `${p.vorname || ''} ${p.nachname || ''}`.trim();
            return `<option value="${name}">${name}</option>`;
        }).join('')}
                    </select>
                </div>
                <div class="user-info-header-actions">
                    <button class="close-info-btn" aria-label="Schließen">✕</button>
                </div>
            `;
            dialog.appendChild(header);

            const content = document.createElement('div');
            content.className = 'user-info-content';

            let totalGames = 0;
            let totalSports = 0;
            let totalEvents = allTables['tbl_events']?.instance?.rows.length || 0;
            let totalInventory = allTables['tbl_inventory']?.instance?.rows.length || 0;
            let activePeople = peopleData.filter(p => !p.Status || String(p.Status).toLowerCase() === 'aktiv').length;
            let inactivePeople = peopleData.filter(p => String(p.Status).toLowerCase() === 'inaktiv').length;

            // Count statuses across all tables
            let globalTodo = 0, globalInProgress = 0, globalDone = 0;

            Object.values(allTables).forEach(tWrap => {
                if (!tWrap.config || !tWrap.instance) return;
                if (tWrap.config.category === 'spiele') totalGames += tWrap.instance.rows.length;
                if (tWrap.config.category === 'sportarten') totalSports += tWrap.instance.rows.length;

                tWrap.instance.rows.forEach(row => {
                    const s = String(row.data.Status || row.data.status || '').toLowerCase().replace(/\s+/g, '-');
                    if (s === 'to-do' || s === 'todo') globalTodo++;
                    else if (s === 'in-progress') globalInProgress++;
                    else if (s === 'done') globalDone++;
                });
            });

            const totalEntries = Object.values(allTables)
                .filter(t => t.instance)
                .reduce((sum, t) => sum + t.instance.rows.length, 0);

            // Build per-table cards with mini status bars
            const tableCardsHtml = Object.values(allTables)
                .filter(tWrap => tWrap.config && tWrap.instance)
                .map(tWrap => {
                    const rows = tWrap.instance.rows;
                    const count = rows.length;
                    let todo = 0, inProg = 0, done = 0;
                    rows.forEach(row => {
                        const s = String(row.data.Status || row.data.status || '').toLowerCase().replace(/\s+/g, '-');
                        if (s === 'to-do' || s === 'todo') todo++;
                        else if (s === 'in-progress') inProg++;
                        else if (s === 'done') done++;
                    });
                    const hasStatus = (todo + inProg + done) > 0;
                    const statusBar = hasStatus ? `
                        <div class="dash-mini-status">
                            ${todo ? `<span class="dash-status-dot todo">${todo} To Do</span>` : ''}
                            ${inProg ? `<span class="dash-status-dot inprog">${inProg} In Progress</span>` : ''}
                            ${done ? `<span class="dash-status-dot done">${done} Done</span>` : ''}
                        </div>
                    ` : '';
                    return `
                        <div class="dash-table-card">
                            <div class="dash-table-card-header">
                                <span class="dash-table-name">${tWrap.instance.title || tWrap.config.title}</span>
                                <span class="dash-table-count">${count}</span>
                            </div>
                            ${statusBar}
                        </div>
                    `;
                }).join('');

            content.innerHTML = `
                <div class="profile-section dash-section" style="margin-top: 0;">
                    <div class="section-header"><h4>System-Übersicht</h4></div>
                    <div class="dash-overview-row">
                        <div class="dash-kpi"><span class="dash-kpi-val accent">${totalEntries}</span><span class="dash-kpi-lbl">Einträge gesamt</span></div>
                        <div class="dash-kpi"><span class="dash-kpi-val accent">${activePeople}</span><span class="dash-kpi-lbl">Aktive Personen</span></div>
                        <div class="dash-kpi"><span class="dash-kpi-val muted">${inactivePeople}</span><span class="dash-kpi-lbl">Inaktive Personen</span></div>
                        <div class="dash-kpi"><span class="dash-kpi-val accent">${totalGames}</span><span class="dash-kpi-lbl">Spiele</span></div>
                        <div class="dash-kpi"><span class="dash-kpi-val accent">${totalSports}</span><span class="dash-kpi-lbl">Sportarten</span></div>
                        <div class="dash-kpi"><span class="dash-kpi-val">${totalEvents}</span><span class="dash-kpi-lbl">Events</span></div>
                        <div class="dash-kpi"><span class="dash-kpi-val">${totalInventory}</span><span class="dash-kpi-lbl">Inventar</span></div>
                    </div>

                    <div class="section-header" style="margin-top: 20px;"><h4>Aufgaben-Status (Alle Tabellen)</h4></div>
                    <div class="dash-status-summary">
                        <div class="dash-status-block todo-block">
                            <span class="dash-status-num">${globalTodo}</span>
                            <span class="dash-status-lbl">To Do</span>
                        </div>
                        <div class="dash-status-block inprog-block">
                            <span class="dash-status-num">${globalInProgress}</span>
                            <span class="dash-status-lbl">In Progress</span>
                        </div>
                        <div class="dash-status-block done-block">
                            <span class="dash-status-num">${globalDone}</span>
                            <span class="dash-status-lbl">Done</span>
                        </div>
                    </div>

                    <div class="section-header" style="margin-top: 20px;"><h4>Tabellen-Details</h4></div>
                    <div class="dash-tables-grid">
                        ${tableCardsHtml}
                    </div>
                </div>
            `;
            dialog.appendChild(content);

            const userSelect = header.querySelector('.user-select-dropdown');
            userSelect.onchange = async (e) => {
                const selectedName = e.target.value;
                const person = peopleData.find(p => `${p.vorname || ''} ${p.nachname || ''}`.trim() === selectedName);
                if (person) {
                    const userStats = stats[selectedName] || {};
                    userStats.gameRespCount = gameRespCounts[person.id] || 0;
                    await this._renderUserProfile(content, person, userStats, tableConfigs, peopleData);
                }
            };

            const onEsc = (e) => {
                if (e.key === 'Escape') {
                    close();
                    document.removeEventListener('keydown', onEsc);
                }
            };
            document.addEventListener('keydown', onEsc);

            const closeBtn = header.querySelector('.close-info-btn');
            closeBtn.onclick = () => { close(); document.removeEventListener('keydown', onEsc); };
            overlay.onclick = (e) => { if (e.target === overlay) { close(); document.removeEventListener('keydown', onEsc); } };
        });
    }

    static async _renderUserProfile(container, person, userStat, tableConfigs, peopleData) {
        const globalState = GlobalStateManager.getInstance();
        const isSuperAdmin = globalState.isSuperAdmin();
        const name = `${person.vorname || ''} ${person.nachname || ''}`.trim();

        // Load fresh permissions from DB
        const userRecord = await AuthService.getUserByUsername(name);
        const userPerm = userRecord?.permissions || PermissionService.getDefaultPermissions();

        const activityLevel = userStat.activityLevel || 'Idle';
        const lastLoginStr = userStat.lastLogin ? new Date(userStat.lastLogin).toLocaleDateString('de-DE') : 'N/A';

        container.innerHTML = `
            <div class="user-profile-view">
                <!-- Profile Header -->
                <div class="profile-card hero-card">
                    <div class="hero-avatar">${(person.vorname || '?')[0].toUpperCase()}</div>
                    <div class="hero-details">
                        <h3>${name}</h3>
                        <div class="hero-badges">
                            <select class="badge role-select-badge" ${((person.role || '').toLowerCase() === 'superadmin' && !isSuperAdmin) ? 'disabled' : ''}>
                                ${['Superadmin', 'Admin', 'Supervisor', 'User', 'Inaktiv'].map(r => `
                                    <option value="${r}" ${ (person.role || (r === 'User' ? 'User' : '')).toLowerCase() === r.toLowerCase() ? 'selected' : ''} ${ (r === 'Superadmin' && !isSuperAdmin) ? 'disabled' : ''}>${r}</option>
                                `).join('')}
                            </select>
                            <span class="badge status-badge ${activityLevel.toLowerCase()}">${activityLevel}</span>
                        </div>
                    </div>
                </div>

                <!-- Statistics Section -->
                <div class="profile-section">
                    <div class="section-header"><h4>Aktivitäts-Statistiken</h4></div>
                    <div class="stats-grid-modern">
                        <div class="stat-card">
                            <span class="stat-label">Einträge</span>
                            <span class="stat-value">${userStat.entryCount || 0}</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Favoriten</span>
                            <span class="stat-value highlight">${userStat.favoritesCount || 0}</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Hauptbereich</span>
                            <span class="stat-value highlight">${userStat.topCategory || 'N/A'}</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Letzter Login</span>
                            <span class="stat-value">${lastLoginStr}</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Verantwortlich f. Spiele</span>
                            <span class="stat-value highlight">${userStat.gameRespCount || 0}</span>
                        </div>
                    </div>
                    
                    <div class="blackjack-stats-bar">
                        <div class="bj-metric">Winrate (BJ): <b>${userStat.winRate || 0}%</b></div>
                        <div class="bj-metric">Streak: <b>${userStat.blackjackHighestStreak || 0}</b></div>
                        <div class="bj-metric">Wins: <b>${userStat.wins || 0}</b></div>
                        <div class="bj-metric">Losses: <b>${userStat.losses || 0}</b></div>
                        <div class="bj-metric">Blackjacks: <b>${userStat.blackjacks || 0}</b></div>
                        ${globalState.isSuperAdmin() ? '<button class="action-btn-small reset-stats-btn" title="Alle Statistiken zurücksetzen">↺ Reset</button>' : ''}
                    </div>
                </div>

                <!-- Team & Roles Section -->
                <div class="profile-section team-config-section">
                    <div class="section-header"><h4>Team-Konfiguration & Rollen</h4></div>
                    <div class="team-roles-grid">
                        ${(person.Team || person.Teams || '').split(',').filter(t => t.trim()).map(teamName => {
                            teamName = teamName.trim();
                            const currentTeamRole = (userPerm.teamRoles || {})[teamName] || 'User';
                            return `
                                <div class="team-role-card" data-team="${teamName}">
                                    <div class="trc-info">
                                        <span class="trc-name">${teamName}</span>
                                        <span class="trc-desc">Rolle in diesem Team</span>
                                    </div>
                                    <div class="trc-action">
                                        <select class="team-role-select" data-team="${teamName}">
                                            <option value="User" ${currentTeamRole === 'User' ? 'selected' : ''}>User</option>
                                            <option value="Supervisor" ${currentTeamRole === 'Supervisor' ? 'selected' : ''}>Supervisor</option>
                                        </select>
                                    </div>
                                </div>
                            `;
                        }).join('') || '<div class="empty-msg">Diesem Nutzer sind aktuell keine Teams zugewiesen.</div>'}
                    </div>
                </div>

                <!-- Settings & Permissions -->
                ${globalState.canManagePermissions() ? `
                <div class="profile-section settings-section">
                    <div class="section-header"><h4>Management & Strategie</h4></div>
                    
                    <div class="settings-grid dynamic-settings">
                        <!-- Management Modules Card -->
                        <div class="settings-card mgmt-card">
                            <div class="card-title-row">
                                <h5>Dashboard & Tools</h5>
                                <span class="card-status-pill">${userPerm.managementAccess !== 'none' ? 'Aktiv' : 'Inaktiv'}</span>
                            </div>
                            <p class="settings-desc">Einzelne Administrations-Module für diesen Nutzer freischalten.</p>
                            
                            <div class="mgmt-toggles-list">
                                <label class="mgmt-toggle-item">
                                    <span class="mt-label">Statistiken & Overview</span>
                                    <input type="checkbox" class="cb-mgmt-module" data-module="stats" ${['stats_only', 'stats_perms'].includes(userPerm.managementAccess) ? 'checked' : ''}>
                                    <span class="mt-slider"></span>
                                </label>
                                <label class="mgmt-toggle-item">
                                    <span class="mt-label">Nutzer & Rechte</span>
                                    <input type="checkbox" class="cb-mgmt-module" data-module="perms" ${userPerm.managementAccess === 'stats_perms' ? 'checked' : ''}>
                                    <span class="mt-slider"></span>
                                </label>
                                <label class="mgmt-toggle-item">
                                    <span class="mt-label">Audit-Logs (System)</span>
                                    <input type="checkbox" class="cb-view-logs-allow" ${userPerm.canViewLogs ? 'checked' : ''}>
                                    <span class="mt-slider"></span>
                                </label>
                                <label class="mgmt-toggle-item">
                                    <span class="mt-label">Edit-Modus Master</span>
                                    <input type="checkbox" class="cb-edit-mode-allow" ${userPerm.canUseEditMode ? 'checked' : ''}>
                                    <span class="mt-slider"></span>
                                </label>
                            </div>
                        </div>

                        <!-- Smart Preset Card -->
                        <div class="settings-card preset-card">
                            <div class="card-title-row">
                                <h5>Smart-Profile</h5>
                                <span class="card-status-pill highlight">${userPerm.type.toUpperCase()}</span>
                            </div>
                            <p class="settings-desc">Rechte-Sets basierend auf Teams & Workspaces.</p>
                            
                            <div class="permission-presets-grid">
                                <button class="smart-preset-btn ${userPerm.type === 'readonly' ? 'active' : ''}" data-type="readonly">
                                    <span class="sp-text">Nur Lesen (Global)</span>
                                </button>
                                <button class="smart-preset-btn ${userPerm.type === 'all' ? 'active' : ''}" data-type="all">
                                    <span class="sp-text">Vollzugriff (Global)</span>
                                </button>
                                
                                <!-- Dynamic Team/Workspace Presets -->
                                ${this._renderDynamicPresets(tableConfigs, person)}

                                <button class="smart-preset-btn manual-btn ${userPerm.type === 'specific' ? 'active' : ''}" data-type="specific">
                                    <span class="sp-text">Manuelle Konsole</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- FINE-GRAINED PERMISSION CONSOLE (RENEWED) -->
                    <div class="perm-console" style="display: ${ (userPerm.type === 'specific' || userPerm.type === 'readonly') ? 'flex' : 'none'};">
                        <div class="perm-sidebar">
                            <div class="perm-sidebar-search">
                                <input type="text" placeholder="Tabelle suchen..." class="perm-search-input">
                            </div>
                            <div class="perm-workspace-list">
                                <!-- Dynamically filled via JS -->
                            </div>
                        </div>
                        <div class="perm-main-stage">
                            <div class="perm-stage-header">
                                <div class="stage-title-group">
                                    <h5 class="active-workspace-title">Workspace auswählen</h5>
                                    <div class="perspective-switcher">
                                        <span class="ps-label">Sichtweise:</span>
                                        <select class="ps-select">
                                            <option value="global">Global (Alle)</option>
                                            <option value="System">System & Verwaltung</option>
                                            ${(person.Team || person.Teams || '').split(',').filter(t => t.trim()).map(t => {
                                                const role = (userPerm.teamRoles || {})[t.trim()] || 'User';
                                                return `<option value="${t.trim()}">${t.trim()} (${role})</option>`;
                                            }).join('')}
                                        </select>
                                    </div>
                                </div>
                                <div class="stage-actions">
                                    <button class="stage-bulk-btn" data-mode="read-all">Alles Lesen</button>
                                    <button class="stage-bulk-btn" data-mode="edit-all">Alles Edit</button>
                                </div>
                            </div>
                            <div class="perm-tables-grid">
                                <!-- Tables for the selected workspace -->
                                <div class="empty-stage-hint">Wähle einen Workspace links aus, um detaillierte Rechte zu setzen.</div>
                            </div>
                        </div>
                    </div>
                </div>` : ''}
            </div>
        `;

        this._attachProfileListeners(container, name, userPerm, peopleData, tableConfigs, userStat);
        
        // Initial setup for the new dynamic permission console
        if (userPerm.type === 'specific' || userPerm.type === 'readonly') {
            this._setupPermConsole(container, tableConfigs, userPerm);
        }
    }

    static _setupPermConsole(container, tableConfigs, userPerm) {
        const workspaceList = container.querySelector('.perm-workspace-list');
        const searchInput = container.querySelector('.perm-search-input');
        const perspectiveSelect = container.querySelector('.ps-select');
        
        // Group tables
        const groups = this._getGroupedTables(tableConfigs);
        let activeGroup = null;
        
        const renderSidebar = (filter = '') => {
            const perspective = perspectiveSelect.value.toLowerCase();
            
            workspaceList.innerHTML = Object.keys(groups)
                .filter(name => {
                    const matchesSearch = name.toLowerCase().includes(filter.toLowerCase());
                    if (perspective === 'global') return matchesSearch;
                    
                    // Perspective Mapping Logic
                    if (perspective === 'system') return matchesSearch && name === 'System';
                    if (perspective === 'aktivitäten') {
                        return matchesSearch && (['Spiele', 'Sportarten', 'Aktivitäten'].includes(name));
                    }
                    
                    // Dynamic direct match for other teams
                    return matchesSearch && (name.toLowerCase() === perspective);
                })
                .map(name => `
                    <div class="perm-workspace-item ${activeGroup === name ? 'active' : ''}" data-workspace="${name}">
                        <span class="pw-name">${name}</span>
                        <span class="pw-count">${groups[name].length}</span>
                    </div>
                `).join('');
                
            workspaceList.querySelectorAll('.perm-workspace-item').forEach(item => {
                item.onclick = () => {
                    activeGroup = item.dataset.workspace;
                    workspaceList.querySelectorAll('.perm-workspace-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    this._renderWorkspaceStage(container, activeGroup, groups[activeGroup], userPerm, perspectiveSelect.value);
                };
            });
        };

        searchInput.oninput = (e) => renderSidebar(e.target.value);
        perspectiveSelect.onchange = () => {
            renderSidebar(searchInput.value);
            // After re-rendering sidebar, try to select the focus workspace
            const focusName = perspectiveSelect.value !== 'global' ? this._capitalizeFirst(perspectiveSelect.value) : null;
            const target = workspaceList.querySelector(`[data-workspace="${focusName}"]`) || workspaceList.querySelector('.perm-workspace-item');
            if (target) target.click();
        };

        renderSidebar();

        // Select first automatically
        const first = workspaceList.querySelector('.perm-workspace-item');
        if (first) first.click();
    }

    static _getGroupedTables(tableConfigs) {
        const groups = { 'System': [
            { id: 'people_table', title: 'Personen (Split)', isSensitive: true },
            { id: 'tbl_people', title: 'Personen (Haupt)', isSensitive: true },
            { id: 'tbl_inventory', title: 'Inventar', isSensitive: true }
        ]};

        tableConfigs.forEach(t => {
            if (['tbl_people', 'tbl_inventory'].includes(t.id)) return;
            let groupName = this._capitalizeFirst(t.workspace || t.category || 'System');
            if (groupName === 'Sonstige') groupName = 'System'; // Merge Sonstige into System
            
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(t);
        });
        return groups;
    }

    static _renderWorkspaceStage(container, groupName, tables, userPerm, activePerspective = 'global') {
        const stageGrid = container.querySelector('.perm-tables-grid');
        const stageTitle = container.querySelector('.active-workspace-title');
        const userTeams = GlobalStateManager.getInstance().getCurrentTeams() || [];
        
        stageTitle.textContent = groupName;
        
        // Determine the effective role for this perspective
        const perspectiveRole = activePerspective === 'global' ? null : ((userPerm.teamRoles || {})[activePerspective] || 'User');

        stageGrid.innerHTML = tables.map(t => {
            const isSensitive = t.isSensitive || false;
            const viewChecked = Array.isArray(userPerm.viewTables) ? userPerm.viewTables.includes(t.id) : (Array.isArray(userPerm.tables) && userPerm.tables.includes(t.id));
            const editChecked = Array.isArray(userPerm.editTables) ? userPerm.editTables.includes(t.id) : (Array.isArray(userPerm.tables) && userPerm.tables.includes(t.id));
            
            const teamRequirement = t.requiresTeam;
            const isContextTeam = teamRequirement && teamRequirement.toLowerCase() === activePerspective.toLowerCase();
            const hasTeamAccess = teamRequirement && userTeams.some(ut => ut.toLowerCase() === teamRequirement.toLowerCase());

            let accessLevel = 'none';
            if (editChecked) accessLevel = 'edit';
            else if (viewChecked || hasTeamAccess) accessLevel = 'read';
            
            // If we are in the context of the required team, and the role is Supervisor, indicate edit potential
            const contextBonus = isContextTeam && perspectiveRole?.toLowerCase() === 'supervisor' ? ' (Team Supervisor)' : '';

            return `
                <div class="perm-table-card ${isSensitive ? 'sensitive' : ''} ${hasTeamAccess ? 'team-owned' : ''} ${isContextTeam ? 'context-active' : ''}" data-table-id="${t.id}">
                    <div class="ptc-header">
                        <div class="ptc-name-group">
                            <span class="ptc-name">${t.title || t.label}</span>
                            ${isContextTeam ? `<span class="context-tag">Aktueller Kontext</span>` : ''}
                        </div>
                        ${teamRequirement ? `<span class="team-badge-mini">${teamRequirement}</span>` : ''}
                    </div>
                    <div class="ptc-access-selector">
                        <button class="access-btn ${accessLevel === 'none' ? 'active' : ''}" data-level="none">Aus</button>
                        <button class="access-btn ${accessLevel === 'read' ? 'active' : ''}" data-level="read">Lesen</button>
                        <button class="access-btn ${accessLevel === 'edit' ? 'active' : ''}" data-level="edit">Edit</button>
                    </div>
                    <div class="ptc-footer">
                        ${isContextTeam ? `Rolle im Team: <b>${perspectiveRole}</b>` : (hasTeamAccess ? 'Team-Zugriff aktiv' : '')}
                    </div>
                </div>
            `;
        }).join('');

        if (groupName === 'System') {
            stageGrid.innerHTML += this._renderSpecialSystemPerms(userPerm);
        }

        this._attachStageListeners(container, groupName, tables);
    }

    static _attachStageListeners(container, groupName, tables) {
        container.querySelectorAll('.access-btn').forEach(btn => {
            btn.onclick = () => {
                const card = btn.closest('.perm-table-card');
                card.querySelectorAll('.access-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Trigger global save
                container.dispatchEvent(new CustomEvent('perm-change'));
            };
        });

        // Bulk buttons in the header
        container.querySelectorAll('.stage-bulk-btn').forEach(btn => {
            btn.onclick = () => {
                const mode = btn.dataset.mode;
                container.querySelectorAll('.perm-table-card').forEach(card => {
                    card.querySelectorAll('.access-btn').forEach(b => b.classList.remove('active'));
                    const targetBtn = mode === 'read-all' ? card.querySelector('[data-level="read"]') : card.querySelector('[data-level="edit"]');
                    if (targetBtn) targetBtn.classList.add('active');
                });
                container.dispatchEvent(new CustomEvent('perm-change'));
            };
        });
    }

    static _renderTableGroups(tableConfigs, userPerm) {
        const globalState = GlobalStateManager.getInstance();
        const isSuperAdmin = globalState.isSuperAdmin();
        const userTeams = globalState.getCurrentTeams() || [];

        // 1. Group tables by Workspace (Primary) or Category (Secondary)
        const groups = {};

        // Explicit System Group for core tables
        groups['System'] = [
            { id: 'people_table', label: 'Personen (Split)', isSensitive: true },
            { id: 'tbl_people', label: 'Personen (Haupt)', isSensitive: true },
            { id: 'tbl_inventory', label: 'Inventar', isSensitive: true }
        ];

        tableConfigs.forEach(t => {
            if (['tbl_people', 'tbl_inventory'].includes(t.id)) return;
            
            const groupName = t.workspace || t.category || 'Sonstige';
            const normalizedGroupName = this._capitalizeFirst(groupName);
            
            if (!groups[normalizedGroupName]) groups[normalizedGroupName] = [];
            groups[normalizedGroupName].push({
                id: t.id,
                label: t.title,
                requiresTeam: t.requiresTeam,
                isSensitive: t.isSensitive
            });
        });

        let html = '';
        Object.entries(groups).forEach(([name, items]) => {
            if (items.length === 0) return;

            html += `
                <div class="permission-group-card workspace-card">
                    <div class="group-header">
                        <div class="group-title-info">
                            <h6>${name}</h6>
                            ${name !== 'System' ? `<span class="group-subtitle">${items.length} Tabellen</span>` : ''}
                        </div>
                        <div class="group-actions">
                            <button class="group-select-all" data-group="${name}" data-mode="view" title="Alle anzeigen">Sicht</button>
                            <button class="group-select-all" data-group="${name}" data-mode="edit" title="Alle editieren">Edit</button>
                        </div>
                    </div>
                    <div class="group-rows">
                        ${items.map(t => {
                            const viewChecked = Array.isArray(userPerm.viewTables) ? userPerm.viewTables.includes(t.id) : (Array.isArray(userPerm.tables) && userPerm.tables.includes(t.id));
                            const editChecked = Array.isArray(userPerm.editTables) ? userPerm.editTables.includes(t.id) : (Array.isArray(userPerm.tables) && userPerm.tables.includes(t.id));
                            
                            // Check if team-based access applies
                            const teamRequirement = t.requiresTeam;
                            const hasTeamAccess = teamRequirement && userTeams.some(ut => ut.toLowerCase() === teamRequirement.toLowerCase());

                            return `
                                <div class="table-perm-row ${t.isSensitive ? 'is-sensitive-row' : ''} ${hasTeamAccess ? 'has-team-access' : ''}">
                                    <div class="table-perm-info">
                                        <span class="table-perm-label">${t.label}</span>
                                        ${teamRequirement ? `<span class="team-badge-mini" title="Team-Berechtigung: ${teamRequirement}">${teamRequirement}</span>` : ''}
                                    </div>
                                    <div class="table-perm-checks">
                                        <label class="compact-checkbox ${hasTeamAccess ? 'team-locked' : ''}" title="${hasTeamAccess ? 'Freigegeben durch Team' : 'Sichtbar'}">
                                            <input type="checkbox" class="cb-view" value="${t.id}" ${ (viewChecked || hasTeamAccess) ? 'checked' : ''} ${hasTeamAccess ? 'disabled' : ''} data-group="${name}">
                                            <span class="box"></span>
                                        </label>
                                        <label class="compact-checkbox" title="Editierbar">
                                            <input type="checkbox" class="cb-edit" value="${t.id}" ${editChecked ? 'checked' : ''} data-group="${name}">
                                            <span class="box"></span>
                                        </label>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                        
                        ${(name === 'System' && isSuperAdmin) ? this._renderSpecialSystemPerms(userPerm) : ''}
                    </div>
                </div>
            `;
        });
        return html;
    }

    static _renderSpecialSystemPerms(userPerm) {
        return `
            <div class="table-perm-row special-perm-row">
                <span class="table-perm-label">Rollen bearbeiten (Admin+)</span>
                <div class="table-perm-checks">
                    <label class="compact-checkbox">
                        <input type="checkbox" class="cb-role-edit" ${userPerm.canEditRoles ? 'checked' : ''}>
                        <span class="box"></span>
                    </label>
                </div>
            </div>
            <div class="table-perm-row special-perm-row">
                <span class="table-perm-label">Edit-Modus berechtigen</span>
                <div class="table-perm-checks">
                    <label class="compact-checkbox">
                        <input type="checkbox" class="cb-edit-mode-allow" ${userPerm.canUseEditMode ? 'checked' : ''}>
                        <span class="box"></span>
                    </label>
                </div>
            </div>
            <div class="table-perm-row special-perm-row">
                <span class="table-perm-label">Audit-Logs ansehen</span>
                <div class="table-perm-checks">
                    <label class="compact-checkbox">
                        <input type="checkbox" class="cb-view-logs-allow" ${userPerm.canViewLogs ? 'checked' : ''}>
                        <span class="box"></span>
                    </label>
                </div>
            </div>
        `;
    }

    static _capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    static _renderDynamicPresets(tableConfigs, person) {
        // Collect workspaces
        const workspaces = [...new Set(tableConfigs.map(t => t.workspace || t.category || 'Sonstige'))];
        const userTeams = (person.Teams || '').split(',').map(t => t.trim().toLowerCase());

        return workspaces.map(ws => {
            const isTeamMatch = userTeams.includes(ws.toLowerCase());
            return `
                <button class="smart-preset-btn ${isTeamMatch ? 'team-suggested' : ''}" data-type="workspace:${ws}">
                    <span class="sp-text">${this._capitalizeFirst(ws)}-Schreiber</span>
                </button>
            `;
        }).join('');
    }

    static _attachProfileListeners(container, name, userPerm, peopleData, tableConfigs, userStat) {
        const isSuperAdmin = GlobalStateManager.getInstance().isSuperAdmin();

        const save = (overridePerms = null) => {
            const activePreset = container.querySelector('.smart-preset-btn.active');
            let type = activePreset ? activePreset.dataset.type : userPerm.type;

            // Resolve managementAccess from toggles
            const statsOn = container.querySelector('.cb-mgmt-module[data-module="stats"]').checked;
            const permsOn = container.querySelector('.cb-mgmt-module[data-module="perms"]').checked;
            let managementAccess = 'none';
            if (permsOn) managementAccess = 'stats_perms';
            else if (statsOn) managementAccess = 'stats_only';

            const viewTables = [];
            const editTables = [];

            // If a preset was just clicked, we might need to overwrite table lists
            if (overridePerms && overridePerms.isPresetAction) {
                const presetValue = overridePerms.preset;
                tableConfigs.concat(this._getGroupedTables(tableConfigs)['System']).forEach(t => {
                    if (presetValue === 'all') { viewTables.push(t.id); editTables.push(t.id); }
                    else if (presetValue === 'readonly') { viewTables.push(t.id); }
                    else if (presetValue.startsWith('workspace:')) {
                        const ws = presetValue.split(':')[1];
                        viewTables.push(t.id);
                        if ((t.workspace || t.category || 'Sonstige') === ws) editTables.push(t.id);
                    }
                });
                type = presetValue;
            } else {
                // Collect from active cards in console
                container.querySelectorAll('.perm-table-card').forEach(card => {
                    const tableId = card.dataset.tableId;
                    const activeLevel = card.querySelector('.access-btn.active')?.dataset.level;
                    if (activeLevel === 'read' || activeLevel === 'edit') viewTables.push(tableId);
                    if (activeLevel === 'edit') editTables.push(tableId);
                });
            }

            const canViewLogs = container.querySelector('.cb-view-logs-allow').checked;
            const canUseEditMode = container.querySelector('.cb-edit-mode-allow').checked;

            // Collect Team-based Roles
            const teamRoles = {};
            container.querySelectorAll('.team-role-select').forEach(sel => {
                teamRoles[sel.dataset.team] = sel.value;
            });

            const newPerms = { 
                type, 
                viewTables: [...new Set(viewTables)], 
                editTables: [...new Set(editTables)], 
                canManageUsers: (managementAccess === 'stats_perms'),
                managementAccess,
                canEditRoles: permsOn, // Inherit role editing from perms module
                canUseEditMode,
                canViewLogs,
                teamRoles
            };

            AuthService.savePermissions(name, newPerms).then(() => {
                const saveIndicator = document.createElement('div');
                saveIndicator.className = 'save-indicator-toast';
                saveIndicator.textContent = 'Berechtigungen aktualisiert';
                document.body.appendChild(saveIndicator);
                setTimeout(() => { if (saveIndicator.parentNode) saveIndicator.remove(); }, 2000);
            });
        };

        // Presets (Smart Profiles)
        container.querySelectorAll('.smart-preset-btn').forEach(btn => {
            btn.onclick = () => {
                container.querySelectorAll('.smart-preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const val = btn.dataset.type;
                const consoleArea = container.querySelector('.perm-console');
                if (consoleArea) {
                    consoleArea.style.display = (val === 'specific' || val === 'readonly') ? 'flex' : 'none';
                }
                
                // If not manual, perform a bulk update
                if (val !== 'specific') {
                    save({ isPresetAction: true, preset: val });
                } else {
                    save(); // Just update type
                }
            };
        });

        // Toggles & Team Roles
        container.querySelectorAll('.mgmt-toggle-item input, .team-role-select').forEach(inp => {
            inp.onchange = () => save();
        });

        // Sidebar card changes
        container.addEventListener('perm-change', () => save());

        // Management access
        const ms = container.querySelector('.mgmt-select-modern');
        if (ms) ms.onchange = () => save();

        // Role selection dropdown
        const rs = container.querySelector('.role-select-badge');
        if (rs) rs.onchange = async () => {
            const person = peopleData.find(p => `${p.vorname || ''} ${p.nachname || ''}`.trim() === name);
            if (person) {
                const newRole = rs.value;
                person.role = newRole;
                await DataService.savePeople(peopleData);

                // Automatically apply new role default permissions
                const newPerms = PermissionService.getPermissionsForRole(newRole);
                await AuthService.savePermissions(name, newPerms);

                // Re-render UI to reflect automatic preset change and updated states
                await this._renderUserProfile(container, person, userStat, tableConfigs, peopleData);
            }
        };

        // Stats Reset
        const resetBtn = container.querySelector('.reset-stats-btn');
        if (resetBtn) {
            resetBtn.onclick = async () => {
                const confirmed = await Dialog.confirm({
                    message: `Alle Statistiken für ${name} wirklich auf Null setzen?`,
                    confirmStyle: 'warning',
                    confirmText: 'Reset'
                });
                if (confirmed) {
                    let userId = userStat.userId || (await AuthService.getUserByUsername(name))?.id;
                    if (userId) {
                        try {
                            await UserStatsService.resetAllStats(userId);
                            const newStats = await UserStatsService.getStats();
                            this._renderUserProfile(container, peopleData.find(p => `${p.vorname || ''} ${p.nachname || ''}`.trim() === name), newStats[name] || {}, tableConfigs, peopleData);
                        } catch (err) {
                            console.error('[UserInfoPage] Reset failed:', err);
                        }
                    }
                }
            };
        }
    }
}
