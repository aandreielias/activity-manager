import '../styles/UserInfoPage.css';
import { UserStatsService } from '../services/UserStatsService.js';
import { GlobalStateManager } from '../core/GlobalStateManager.js';
import { AuditLogsDialog } from './AuditLogsDialog.js';
import { AuthService } from '../services/AuthService.js';
import { Dialog } from './Dialog.js';
import { CATEGORIES, TABLE_NAMES, RIGHTS } from '../core/Constants.js';
import { SupabaseClient } from '../services/SupabaseClient.js';


/**
 * UserInfoPage - Centralized Administrative Dashboard.
 * Focuses on system statistics and individual user activity levels.
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
                if (tWrap.config.category === CATEGORIES.SPIELE) totalGames += tWrap.instance.rows.length;
                if (tWrap.config.category === CATEGORIES.SPORTARTEN) totalSports += tWrap.instance.rows.length;
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
        container.innerHTML = `
            <div class="user-profile-view anim-fade-in">
                ${this._getProfileHeaderHTML(person, userStat)}
                
                <div class="user-tabs-container">
                    <button class="user-tab-btn active" data-tab="stats">Statistiken</button>
                    ${GlobalStateManager.getInstance().getRight('service_rights') > 0 ? '<button class="user-tab-btn" data-tab="rights">Rechte</button>' : ''}
                </div>
 
                <div class="user-tab-content">
                    ${this._getStatsTabHTML(person, userStat)}
                </div>
            </div>
        `;
 
        // Resolve actual user_id for stats persistence
        AuthService.getUserByPersonId(person.id).then(user => {
            const userId = user ? user.nu_id : null;
            this._attachStatsEvents(container, person, userStat, userId);
        });

        const tabs = container.querySelectorAll('.user-tab-btn');
        const tabContent = container.querySelector('.user-tab-content');

        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (tab.dataset.tab === 'stats') {
                    tabContent.innerHTML = this._getStatsTabHTML(person, userStat);
                    AuthService.getUserByPersonId(person.id).then(user => {
                        this._attachStatsEvents(container, person, userStat, user ? user.nu_id : null);
                    });
                } else if (tab.dataset.tab === 'rights') {
                    AuthService.getUserByPersonId(person.id).then(user => {
                        this._renderRightsTab(tabContent, person, user ? user.nu_id : null);
                    });
                }
            };
        });
    }

    static async _renderRightsTab(container, person, userId) {
        if (!userId) {
            container.innerHTML = `
                <div class="empty-state-large" style="padding: 60px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🔒</div>
                    <h4>Kein Benutzerkonto</h4>
                    <p>Berechtigungen können nur für Personen mit verknüpftem Benutzerkonto verwaltet werden.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `<div class="empty-state-large">Lade Berechtigungen...</div>`;

        try {
            // Fetch current permissions
            const res = await SupabaseClient.get(TABLE_NAMES.PERMISSIONS, `?nb_nu_id=eq.${userId}`);
            const permissions = res.ok ? await res.json() : [];

            const gs = GlobalStateManager.getInstance();
            const allConfigs = gs.getAllTableConfigs();
            const navGroups = gs.getNavigationGroups();

            // Fetch user's teams to categorize sliders
            const teamsRes = await SupabaseClient.get(TABLE_NAMES.PERSON_TEAMS, `?pt_pe_id=eq.${person.id}`);
            const userTeams = teamsRes.ok ? await teamsRes.json() : [];
            const userTeamIds = userTeams.map(ut => ut.pt_tm_id);

            // Fetch team names for display
            const teamsDataRes = await SupabaseClient.get(TABLE_NAMES.TEAMS, '');
            const teamsData = teamsDataRes.ok ? await teamsDataRes.json() : [];
            const teamNameMap = new Map(teamsData.map(t => [t.tm_id, t.tm_name]));

            // Fetch team mappings to identify which group belongs to which team
            const mappingsRes = await SupabaseClient.get(TABLE_NAMES.TEAM_TABELLEN, '');
            const teamMappings = mappingsRes.ok ? await mappingsRes.json() : [];

            const memberGroups = [];
            const otherGroups = [];

            navGroups.forEach(ng => {
                const mapping = teamMappings.find(m => m.tt_id === ng.id);
                if (mapping && userTeamIds.includes(mapping.tt_tm_id)) {
                    memberGroups.push(ng);
                } else {
                    // Attach team name if possible
                    if (mapping && mapping.tt_tm_id) {
                        ng.teamName = teamNameMap.get(mapping.tt_tm_id);
                    }
                    otherGroups.push(ng);
                }
            });

            container.innerHTML = this._getRightsTabHTML(allConfigs, permissions, memberGroups, otherGroups);
            this._attachRightsEvents(container, person, userId, allConfigs, permissions, navGroups);
        } catch (e) {
            container.innerHTML = `<div class="empty-state-large">Fehler beim Laden: ${e.message}</div>`;
        }
    }

    static _getRightsTabHTML(configs, permissions, memberGroups, otherGroups) {
        // Helper to resolve level for a specific table in the target user's permissions
        const getTableLevel = (tId) => {
            const tableRule = permissions.find(p => p.nb_t_id === tId && !p.nb_tf_id);
            return tableRule ? tableRule.nb_right_level : 0;
        };

        const allGroups = [...memberGroups, ...otherGroups];

        const groupRowsHTML = allGroups.map(group => {
            const isMember = memberGroups.includes(group);
            const tablesInGroup = group.tables || [];
            if (tablesInGroup.length === 0) return '';
            
            const groupLevel = getTableLevel(tablesInGroup[0].id);
            const tableNames = tablesInGroup.map(t => t.title).join(', ');
            const dimStyle = !isMember ? 'opacity: 0.5; filter: grayscale(1);' : '';
            const teamBadge = !isMember ? `<span style="font-size: 10px; opacity: 0.8; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px;">Anderes Team (${group.teamName || 'Unbekannt'})</span>` : '';
            
            return `
                <div class="rights-group-row hero-card" style="${dimStyle}">
                    <div class="rights-group-main">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="rights-group-name">${group.name}</span>
                            ${teamBadge}
                        </div>
                        <span class="rights-group-tables-hint">${tableNames}</span>
                    </div>
                    <div class="rights-slider-container">
                        <input type="range" class="rights-group-slider" data-group-id="${group.id}" min="0" max="2" value="${groupLevel}">
                        <div class="slider-labels">
                            <span class="${groupLevel == 0 ? 'active' : ''}">Kein</span>
                            <span class="${groupLevel == 1 ? 'active' : ''}">Lesen</span>
                            <span class="${groupLevel == 2 ? 'active' : ''}">Schreiben</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Split custom rules into column-level and table-level
        const allCustom = permissions.filter(p => {
            if (p.nb_tf_id) return true;
            if (p.nb_t_id === 'global_all' || p.nb_t_id.startsWith('service_')) return true;
            const group = allGroups.find(g => g.tables.some(t => t.id === p.nb_t_id));
            if (!group) return true;
            const groupLevel = getTableLevel(group.tables[0].id);
            return p.nb_right_level !== groupLevel;
        });

        const columnRules = allCustom.filter(p => p.nb_tf_id);
        const tableRules = allCustom.filter(p => !p.nb_tf_id);

        const columnRulesHTML = columnRules.map((p, idx) => this._getRuleRowHTML(idx, p, configs)).join('');
        const tableRulesHTML = tableRules.map((p, idx) => this._getRuleRowHTML(columnRules.length + idx, p, configs)).join('');

        // Global rule
        const globalRule = permissions.find(p => p.nb_t_id === 'global_all' && !p.nb_tf_id);
        const globalLevel = globalRule ? globalRule.nb_right_level : -1;
        const isGlobalActive = globalLevel !== -1;

        return `
            <div class="rights-tab-container anim-fade-in">
                <div class="profile-section" style="margin-top:0;">
                    <div class="rights-group-row hero-card" style="margin-bottom: 24px;">
                        <div class="rights-group-main">
                            <span class="rights-group-name">Globale Berechtigung</span>
                        </div>
                        <div class="rights-slider-container">
                            <input type="range" class="rights-global-slider" min="-1" max="2" value="${globalLevel}">
                            <div class="slider-labels" style="grid-template-columns: repeat(4, 1fr);">
                                <span class="${globalLevel == -1 ? 'active' : ''}">Inaktiv</span>
                                <span class="${globalLevel == 0 ? 'active' : ''}">Kein</span>
                                <span class="${globalLevel == 1 ? 'active' : ''}">Lesen</span>
                                <span class="${globalLevel == 2 ? 'active' : ''}">Schreiben</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="rights-sub-sections" style="${isGlobalActive ? 'opacity: 0.4; pointer-events: none; transition: all 0.3s ease;' : 'transition: all 0.3s ease;'}">
                    <div class="profile-section">
                        <div class="section-header">
                            <h4>Spalten-Regeln</h4>
                            <button class="add-column-rule-btn add-rule-btn-dash">+ Spalten-Regel</button>
                        </div>
                        <div class="column-rules-list custom-rules-list">
                            ${columnRulesHTML || '<div class="empty-state-small">Keine Spalten-Regeln definiert.</div>'}
                        </div>
                    </div>

                    <div class="profile-section" style="margin-top: 32px;">
                        <div class="section-header">
                            <h4>Tabellen-Regeln</h4>
                            <button class="add-table-rule-btn add-rule-btn-dash">+ Tabellen-Regel</button>
                        </div>
                        <div class="table-rules-list custom-rules-list">
                            ${tableRulesHTML || '<div class="empty-state-small">Keine Tabellen-Regeln definiert.</div>'}
                        </div>
                    </div>

                    <div class="profile-section" style="margin-top: 32px;">
                        <div class="section-header">
                            <h4>Standard-Berechtigungen (Gruppen)</h4>
                        </div>
                        <div class="rights-groups-list">
                            ${groupRowsHTML}
                        </div>
                    </div>
                </div>

                <div class="rights-footer">
                    <button class="save-rights-btn primary-btn-dash">Berechtigungen speichern</button>
                </div>
            </div>
        `;
    }

    static _getRuleRowHTML(index, p, configs) {
        return `
            <div class="rule-row hero-card" data-index="${index}">
                <div class="rule-level-anchor"></div>
                <div class="rule-target-anchor"></div>
                <div class="rule-column-anchor"></div>
                <button class="remove-rule-btn" title="Regel entfernen">✕</button>
            </div>
        `;
    }

    static _attachRightsEvents(container, person, userId, configs, initialPermissions, navGroups) {
        const allGroups = [...navGroups];
        const getGroupForTable = (tId) => allGroups.find(g => (g.tables || []).some(t => t.id === tId));
        const getGroupLevel = (group) => {
            if (!group || !group.tables || group.tables.length === 0) return 0;
            const firstTableRule = initialPermissions.find(p => p.nb_t_id === group.tables[0].id && !p.nb_tf_id);
            return firstTableRule ? firstTableRule.nb_right_level : 0;
        };

        // Filter to only custom/exception rules, excluding global (handled by slider)
        let currentPermissions = initialPermissions.filter(p => {
            if (p.nb_t_id === 'global_all' && !p.nb_tf_id) return false; // Global handled by slider
            if (p.nb_tf_id) return true;
            if (p.nb_t_id.startsWith('service_')) return true;
            const group = getGroupForTable(p.nb_t_id);
            if (!group) return true;
            return p.nb_right_level !== getGroupLevel(group);
        });

        const renderRules = () => {
            const columnRules = currentPermissions.filter(p => p.nb_tf_id);
            const tableRules = currentPermissions.filter(p => !p.nb_tf_id);

            const colList = container.querySelector('.column-rules-list');
            const tblList = container.querySelector('.table-rules-list');

            colList.innerHTML = columnRules.length > 0
                ? columnRules.map((p, idx) => this._getRuleRowHTML(currentPermissions.indexOf(p), p, configs)).join('')
                : '<div class="empty-state-small">Keine Spalten-Regeln definiert.</div>';

            tblList.innerHTML = tableRules.length > 0
                ? tableRules.map((p, idx) => this._getRuleRowHTML(currentPermissions.indexOf(p), p, configs)).join('')
                : '<div class="empty-state-small">Keine Tabellen-Regeln definiert.</div>';

            attachRuleEvents();
        };

        const attachRuleEvents = () => {
            // Global slider
            const globalSlider = container.querySelector('.rights-global-slider');
            if (globalSlider) {
                globalSlider.oninput = (e) => {
                    const val = parseInt(e.target.value);
                    const labels = globalSlider.parentNode.querySelectorAll('.slider-labels span');
                    labels.forEach((l, i) => l.classList.toggle('active', i === val + 1));

                    const subSections = container.querySelector('.rights-sub-sections');
                    if (subSections) {
                        if (val !== -1) {
                            subSections.style.opacity = '0.4';
                            subSections.style.pointerEvents = 'none';
                        } else {
                            subSections.style.opacity = '1';
                            subSections.style.pointerEvents = 'auto';
                        }
                    }
                };
            }

            // Group sliders
            container.querySelectorAll('.rights-group-slider').forEach(slider => {
                slider.oninput = (e) => {
                    const val = e.target.value;
                    const labels = slider.parentNode.querySelectorAll('.slider-labels span');
                    labels.forEach((l, i) => l.classList.toggle('active', i == val));
                };
            });

            // Rule row dropdowns
            container.querySelectorAll('.rule-row').forEach(row => {
                const idx = parseInt(row.dataset.index);
                const p = currentPermissions[idx];
                if (!p) return;

                const levelOptions = [
                    { id: 0, label: 'Kein Zugriff' },
                    { id: 1, label: 'Lesen' },
                    { id: 2, label: 'Schreiben' }
                ];
                const levelAnchor = row.querySelector('.rule-level-anchor');
                levelAnchor.innerHTML = '';
                levelAnchor.appendChild(this._createDropdown({
                    options: levelOptions,
                    value: p.nb_right_level,
                    placeholder: 'Zugriff...',
                    onSelect: (o) => { p.nb_right_level = o.id; renderRules(); },
                    colored: true
                }));

                const targetConfigs = configs.map(c => ({ id: c.id, label: c.title }));
                targetConfigs.push({ id: 'service_stats', label: 'Dienst: Statistiken' }, { id: 'service_calendar', label: 'Dienst: Kalender' }, { id: 'service_rights', label: 'Dienst: Berechtigungen' });
                
                const targetAnchor = row.querySelector('.rule-target-anchor');
                targetAnchor.innerHTML = '';
                targetAnchor.appendChild(this._createDropdown({
                    options: targetConfigs,
                    value: p.nb_t_id,
                    placeholder: 'Tabelle...',
                    onSelect: (o) => { p.nb_t_id = o.id; p.nb_tf_id = null; renderRules(); }
                }));

                const selectedConfig = configs.find(c => c.id === p.nb_t_id);
                const columns = selectedConfig ? (selectedConfig.schema || []).map(c => ({ id: c.id, label: c.label || c.id })) : [];
                if (p.nb_tf_id) {
                    // Column rule: show column dropdown
                    const columnAnchor = row.querySelector('.rule-column-anchor');
                    columnAnchor.innerHTML = '';
                    columnAnchor.appendChild(this._createDropdown({
                        options: columns,
                        value: p.nb_tf_id,
                        placeholder: 'Spalte...',
                        disabled: !selectedConfig,
                        onSelect: (o) => { p.nb_tf_id = o.id; renderRules(); }
                    }));
                } else {
                    // Table rule: hide column dropdown
                    row.querySelector('.rule-column-anchor').innerHTML = '';
                }

                row.querySelector('.remove-rule-btn').onclick = () => {
                    currentPermissions.splice(idx, 1);
                    renderRules();
                };
            });
        };

        // Add Column Rule button
        const addColBtn = container.querySelector('.add-column-rule-btn');
        if (addColBtn) {
            addColBtn.onclick = () => {
                const defaultTid = configs[0]?.id || 'global_all';
                const defaultCol = configs[0]?.schema?.[0]?.id || null;
                currentPermissions.push({ nb_nu_id: userId, nb_t_id: defaultTid, nb_right_level: 0, nb_tf_id: defaultCol });
                renderRules();
            };
        }

        // Add Table Rule button
        const addTblBtn = container.querySelector('.add-table-rule-btn');
        if (addTblBtn) {
            addTblBtn.onclick = () => {
                const existingTids = new Set(currentPermissions.filter(p => !p.nb_tf_id).map(p => p.nb_t_id));
                const nextConfig = configs.find(c => !existingTids.has(c.id));
                const defaultTid = nextConfig ? nextConfig.id : configs[0]?.id;
                currentPermissions.push({ nb_nu_id: userId, nb_t_id: defaultTid, nb_right_level: 1, nb_tf_id: null });
                renderRules();
            };
        }

        const saveBtn = container.querySelector('.save-rights-btn');
        if (saveBtn) {
            saveBtn.onclick = async () => {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Speichere...';

                try {
                    // 1. Get global slider value
                    const globalSlider = container.querySelector('.rights-global-slider');
                    const globalLevel = globalSlider ? parseInt(globalSlider.value) : 2;

                    // 2. Get values from group sliders
                    const sliders = container.querySelectorAll('.rights-group-slider');
                    const groupPerms = [];

                    sliders.forEach(s => {
                        const groupId = s.dataset.groupId;
                        const level = parseInt(s.value);
                        const group = navGroups.find(g => g.id === groupId);
                        if (group && group.tables) {
                            group.tables.forEach(t => {
                                groupPerms.push({
                                    nb_nu_id: userId,
                                    nb_t_id: t.id,
                                    nb_right_level: level,
                                    nb_tf_id: null
                                });
                            });
                        }
                    });

                    // 3. Combine: Global -> Group -> Custom
                    const permMap = new Map();

                    if (globalLevel > -1) {
                        // Global rule is ACTIVE. Ignore all other rules!
                        permMap.set('global_all', { nb_nu_id: userId, nb_t_id: 'global_all', nb_right_level: globalLevel, nb_tf_id: null });
                    } else {
                        // Global rule is INACTIVE. Use group sliders and custom rules.
                        // Step A: Group sliders (Base Values)
                        groupPerms.forEach(p => {
                            permMap.set(p.nb_t_id, p);
                        });
                    }

                    // Step B: Apply custom rules (override group defaults)
                    // We save custom rules even if global is active, so they aren't lost when toggling.
                    if (globalLevel === -1) {
                        currentPermissions.forEach(p => {
                            const key = p.nb_tf_id ? `${p.nb_t_id}_col_${p.nb_tf_id}` : `${p.nb_t_id}`;
                            permMap.set(key, p);
                        });
                    } else {
                        // If global is active, we STILL save custom rules, but we don't need group defaults.
                        currentPermissions.forEach(p => {
                            const key = p.nb_tf_id ? `${p.nb_t_id}_col_${p.nb_tf_id}` : `${p.nb_t_id}`;
                            permMap.set(key, p);
                        });
                    }

                    // Step C: Normalize for Supabase (Ensures all objects have identical keys)
                    const finalPermissions = Array.from(permMap.values()).map(p => {
                        // Resolve physical field UUID for column rules
                        let fieldUuid = null;
                        if (p.nb_tf_id) {
                            const config = configs.find(c => c.id === p.nb_t_id);
                            const field = config?.schema?.find(f => f.id === p.nb_tf_id);
                            fieldUuid = field?.field_id || p.nb_tf_id; 
                        }

                        return {
                            nb_nu_id: userId,
                            nb_tm_id: null,
                            nb_t_id: p.nb_t_id,
                            nb_tf_id: fieldUuid,
                            nb_right_level: p.nb_right_level
                        };
                    });

                    // 3. Clear existing and save new
                    // Delete all user permissions first
                    await SupabaseClient.delete(TABLE_NAMES.PERMISSIONS, `?nb_nu_id=eq.${userId}`);
                    
                    if (finalPermissions.length > 0) {
                        // Insert new ones
                        const res = await SupabaseClient.post(TABLE_NAMES.PERMISSIONS, finalPermissions);
                        if (!res.ok) {
                            const errBody = await res.json();
                            if (res.status === 409) {
                                throw new Error('Daten-Konflikt: Möglicherweise existiert bereits eine Regel. Bitte Seite neu laden oder SQL-Fix anwenden.');
                            }
                            throw new Error(`Speichern fehlgeschlagen: ${errBody.message || res.statusText}`);
                        }
                    }

                    // If saving for self, refresh local state
                    const gs = GlobalStateManager.getInstance();
                    if (userId === gs.getCurrentUserId()) {
                        await gs.loadPermissions();
                        window.dispatchEvent(new CustomEvent('refresh-data'));
                    }

                    // Reload data to show updated state in the tab
                    await this._renderRightsTab(container, person, userId);

                    Dialog.alert({ title: 'Erfolg', message: 'Berechtigungen wurden erfolgreich gespeichert.' });
                } catch (e) {
                    alert('Fehler: ' + e.message);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Berechtigungen speichern';
                }
            };
        }

        attachRuleEvents();
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
        const chipsObj = userStat.chips || {1:0, 5:0, 10:0, 20:0, 25:0, 100:0, 500:0, 1000:0};
        const totalValue = UserStatsService.calculateTotalChipsValue(chipsObj);
        
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
                    <div class="stat-card">
                        <span class="stat-label">Gesamtwert Chips</span>
                        <span class="stat-value highlight" id="user-totalchips-display">${totalValue}</span>
                    </div>
                </div>

                <div class="chip-management-notion">
                    <div class="chip-management-header-notion">
                        <h5 class="chip-section-title-notion">Individuelle Casino Chips</h5>
                        <button class="reset-chips-btn-notion">Zu Default zurücksetzen</button>
                    </div>
                    <div class="chip-manage-list-notion">
                        ${[1, 5, 10, 20, 25, 100, 500, 1000].map(val => `
                            <div class="chip-item-notion">
                                <div class="chip-info-notion">
                                    <div class="admin-chip-disp-notion" data-val="${val}">${val}</div>
                                    <span class="chip-label-notion">${val}er Chip</span>
                                </div>
                                <input type="number" class="chip-count-input-notion" data-chip="${val}" value="${userStat.chips?.[val] || 0}" min="0">
                                <div class="chip-actions-notion">
                                    <button class="mod-chip-btn-notion minus" data-chip="${val}" data-diff="-1">−</button>
                                    <button class="mod-chip-btn-notion plus" data-chip="${val}" data-diff="1">+</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    static _attachStatsEvents(container, person, userStat, userId) {
        // We no longer return early here so that we can show a better message if userId is missing
        
        const modBtns = container.querySelectorAll('.mod-chip-btn-notion');
        const countInputs = container.querySelectorAll('.chip-count-input-notion');
        const totalDisp = container.querySelector('#user-totalchips-display');

        const checkAuth = () => {
            if (!userId) {
                alert('Dieser Person ist kein Benutzerkonto zugewiesen. Chips können nur für Konten verwaltet werden.');
                return false;
            }
            return true;
        };

        // Handle buttons (+1 / -1)
        modBtns.forEach(btn => {
            btn.onclick = async () => {
                if (!checkAuth()) return;

                const val = parseInt(btn.dataset.chip, 10);
                const diff = parseInt(btn.dataset.diff, 10);
                
                if (!userStat.chips) userStat.chips = {};
                const currentCount = userStat.chips[val] || 0;
                
                if (diff < 0 && currentCount === 0) return;

                btn.disabled = true;
                try {
                    await UserStatsService.updateChips(userId, { [val]: diff });
                    userStat.chips[val] = currentCount + diff;
                    
                    const input = container.querySelector(`.chip-count-input-notion[data-chip="${val}"]`);
                    if (input) input.value = userStat.chips[val];
                    
                    if (totalDisp) totalDisp.textContent = UserStatsService.calculateTotalChipsValue(userStat.chips);
                } catch (e) {
                    alert('Fehler beim Aktualisieren der Chips.');
                } finally {
                    btn.disabled = false;
                }
            };
        });

        // Handle direct input editing
        countInputs.forEach(input => {
            input.onchange = async () => {
                if (!checkAuth()) {
                    input.value = userStat.chips?.[parseInt(input.dataset.chip, 10)] || 0;
                    return;
                }

                const val = parseInt(input.dataset.chip, 10);
                let newQty = parseInt(input.value, 10);
                
                if (isNaN(newQty) || newQty < 0) {
                    newQty = 0;
                    input.value = 0;
                }

                input.disabled = true;
                try {
                    await UserStatsService.updateChipsAbsolute(userId, { [val]: newQty });
                    if (!userStat.chips) userStat.chips = {};
                    userStat.chips[val] = newQty;
                    
                    if (totalDisp) totalDisp.textContent = UserStatsService.calculateTotalChipsValue(userStat.chips);
                } catch (e) {
                    alert('Fehler beim Speichern der Chip-Anzahl.');
                    input.value = userStat.chips?.[val] || 0;
                } finally {
                    input.disabled = false;
                }
            };
        });

        // Handle focus behavior
        countInputs.forEach(input => {
            input.onfocus = () => input.select();
            input.onkeydown = (e) => {
                if (e.key === 'Enter') input.blur();
            };
        });

        // Handle Reset to Default
        const resetBtn = container.querySelector('.reset-chips-btn-notion');
        if (resetBtn) {
            resetBtn.onclick = async () => {
                const defaults = { 1: 50, 5: 20, 10: 10, 20: 5, 25: 4, 100: 1, 500: 0, 1000: 0 };
                
                try {
                    // Show confirmation first so the user sees the button works
                    const confirmed = await Dialog.bannerConfirm({ 
                        message: 'Möchten Sie die Chips auf Default zurücksetzen?',
                        confirmText: 'Ja, zurücksetzen'
                    });
                    
                    if (!confirmed) return;

                    // Then check if we actually have a user ID to save to
                    if (!checkAuth()) return;

                    resetBtn.disabled = true;
                    resetBtn.textContent = 'Wird zurückgesetzt...';

                    await UserStatsService.updateChipsAbsolute(userId, defaults);
                    
                    if (!userStat.chips) userStat.chips = {};
                    Object.assign(userStat.chips, defaults);
                    
                    // Update all inputs visually
                    countInputs.forEach(input => {
                        const val = input.dataset.chip;
                        if (defaults[val] !== undefined) {
                            input.value = defaults[val];
                        }
                    });

                    if (totalDisp) totalDisp.textContent = UserStatsService.calculateTotalChipsValue(userStat.chips);
                } catch (e) {
                    alert('Fehler beim Zurücksetzen der Chips.');
                } finally {
                    resetBtn.disabled = false;
                    resetBtn.textContent = 'Zu Default zurücksetzen';
                }
            };
        }
    }


    /**
     * Creates a premium dropdown button matching the filter bar style.
     * Menu stays open until clicking outside.
     * @private
     */
    static _createDropdown({ options, value, placeholder, onSelect, colored, disabled }) {
        const wrap = document.createElement('div');
        wrap.className = 'dropdown-container';
        if (disabled) { wrap.style.opacity = '0.5'; wrap.style.pointerEvents = 'none'; }

        const btn = document.createElement('button');
        btn.className = 'nav-btn dropdown-btn';
        const selected = options.find(o => o.id === value);
        const label = selected ? selected.label : placeholder;

        btn.innerHTML = `<span>${label}</span> <span class="dropdown-arrow">▼</span>`;
        if (selected && selected.id !== null) btn.classList.add('active');

        if (colored && selected) {
            const sid = Number(selected.id);
            if (sid === 2) btn.style.color = 'var(--success, #28a745)';
            else if (sid === 1) btn.style.color = 'var(--accent, #007bff)';
            else if (sid === 0) btn.style.color = 'var(--error, #dc3545)';
        }

        let activeMenu = null;
        let tracker = null;

        const closeMenu = () => {
            if (activeMenu) { activeMenu.remove(); activeMenu = null; }
            if (tracker) { cancelAnimationFrame(tracker); tracker = null; }
        };

        btn.onclick = (e) => {
            e.stopPropagation();
            if (activeMenu) { closeMenu(); return; }

            // Close any other open portal menus
            document.querySelectorAll('.dropdown-menu-portal').forEach(m => m.remove());

            const menu = document.createElement('div');
            menu.className = 'dropdown-menu dropdown-menu-portal';
            menu.style.cssText = 'display:flex; flex-direction:column; position:fixed; z-index:1000000;';

            options.forEach(o => {
                const item = document.createElement('button');
                item.className = 'dropdown-item';
                item.textContent = o.label;
                if (o.id === value) item.classList.add('selected');

                if (colored) {
                    const oid = Number(o.id);
                    if (oid === 2) item.style.color = 'var(--success, #28a745)';
                    else if (oid === 1) item.style.color = 'var(--accent, #007bff)';
                    else if (oid === 0) item.style.color = 'var(--error, #dc3545)';
                }

                item.onclick = (ev) => {
                    ev.stopPropagation();
                    closeMenu();
                    onSelect(o);
                };
                menu.appendChild(item);
            });

            document.body.appendChild(menu);
            activeMenu = menu;

            // Position tracking (follows the button even on scroll, flips up if needed)
            const position = () => {
                if (!activeMenu) return;
                const r = btn.getBoundingClientRect();
                const spaceBelow = window.innerHeight - r.bottom - 8;
                const spaceAbove = r.top - 8;
                const maxH = Math.min(300, Math.max(spaceBelow, spaceAbove));

                menu.style.maxHeight = `${maxH}px`;
                menu.style.overflowY = 'auto';
                menu.style.minWidth = `${r.width}px`;

                if (spaceBelow >= menu.scrollHeight || spaceBelow >= spaceAbove) {
                    menu.style.top = `${r.bottom + 4}px`;
                } else {
                    menu.style.top = `${r.top - menu.offsetHeight - 4}px`;
                }
                menu.style.left = `${r.left}px`;
                if (menu.getBoundingClientRect().right > window.innerWidth) {
                    menu.style.left = `${window.innerWidth - menu.offsetWidth - 20}px`;
                }
                tracker = requestAnimationFrame(position);
            };
            position();

            // Close on outside click
            const watchOutside = (ev) => {
                if (!menu.contains(ev.target) && ev.target !== btn) {
                    closeMenu();
                    document.removeEventListener('mousedown', watchOutside);
                }
            };
            setTimeout(() => document.addEventListener('mousedown', watchOutside), 0);
        };

        wrap.appendChild(btn);
        return wrap;
    }
}
