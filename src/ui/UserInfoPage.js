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
    static async show(peopleData, tableConfigs) {
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
                    <h2>Nutzer-Verwaltung</h2>
                    <p>Statistiken und Berechtigungen verwalten</p>
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
            content.innerHTML = `
                <div class="empty-state-large">
                    <div class="empty-state-icon">👤</div>
                    <h3>Kein Nutzer ausgewählt</h3>
                    <p>Wählen Sie oben einen Nutzer aus, um dessen Profil zu bearbeiten.</p>
                </div>
            `;
            dialog.appendChild(content);

            const userSelect = header.querySelector('.user-select-dropdown');
            userSelect.onchange = (e) => {
                const selectedName = e.target.value;
                const person = peopleData.find(p => `${p.vorname || ''} ${p.nachname || ''}`.trim() === selectedName);
                if (person) {
                    this._renderUserProfile(content, person, stats[selectedName] || {}, tableConfigs, peopleData);
                }
            };

            const closeBtn = header.querySelector('.close-info-btn');
            closeBtn.onclick = close;
            overlay.onclick = (e) => { if (e.target === overlay) close(); };
        });
    }

    static _renderUserProfile(container, person, userStat, tableConfigs, peopleData) {
        const globalState = GlobalStateManager.getInstance();
        const name = `${person.vorname || ''} ${person.nachname || ''}`.trim();
        
        // Load fresh permissions map
        const permissionsMap = JSON.parse(localStorage.getItem('app_permissions_map') || '{}');
        const userPerm = permissionsMap[name] || PermissionService.getDefaultPermissions();

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
                            <span class="badge role-badge">${person.role || 'Nutzer'}</span>
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
                    </div>
                    
                    <div class="blackjack-stats-bar">
                        <div class="bj-metric">Winrate (BJ): <b>${userStat.winRate || 0}%</b></div>
                        <div class="bj-metric">Streak: <b>${userStat.blackjackHighestStreak || 0}</b></div>
                        <div class="bj-metric">Wins: <b>${userStat.wins || 0}</b></div>
                        <div class="bj-metric">Losses: <b>${userStat.losses || 0}</b></div>
                        <div class="bj-metric">Blackjacks: <b>${userStat.blackjacks || 0}</b></div>
                        ${globalState.isSuperAdmin() ? `<button class="action-btn-small reset-stats-btn" title="Alle Statistiken zurücksetzen">↺ Reset</button>` : ''}
                    </div>
                </div>

                <!-- Settings & Permissions -->
                ${globalState.canManagePermissions() ? `
                <div class="profile-section settings-section">
                    <div class="section-header"><h4>Rechte & Rollen</h4></div>
                    
                    <div class="settings-grid">
                        <!-- Management Access Card -->
                        <div class="settings-card">
                            <h5>Dashboard Zugriff</h5>
                            <p class="settings-desc">Bestimmt, welche Administrations-Tools dieser Nutzer sehen kann.</p>
                            <select class="mgmt-select-modern" ${person.role === 'Superadmin' ? 'disabled' : ''}>
                                <option value="none" ${userPerm.managementAccess === 'none' ? 'selected' : ''}>Kein Zugriff</option>
                                <option value="stats_only" ${userPerm.managementAccess === 'stats_only' ? 'selected' : ''}>Nur Statistiken</option>
                                <option value="stats_perms" ${userPerm.managementAccess === 'stats_perms' ? 'selected' : ''}>Stats & Berechtigungen</option>
                            </select>
                            
                            <div class="admin-role-toggle">
                                <span>Administrator-Status</span>
                                <label class="toggle-switch">
                                    <input type="checkbox" class="admin-role-cb" ${person.role === 'Admin' ? 'checked' : ''} ${person.role === 'Superadmin' ? 'disabled' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        <!-- Permission Preset Card -->
                        <div class="settings-card">
                            <h5>Zugriffs-Profil</h5>
                            <p class="settings-desc">Vordefinierte Berechtigungs-Schemas für schnelles Zuweisen.</p>
                            <div class="permission-presets">
                                <button class="preset-btn ${userPerm.type === 'readonly' ? 'active' : ''}" data-type="readonly" ${person.role === 'Superadmin' ? 'disabled' : ''}>Lese-Schutz</button>
                                <button class="preset-btn ${userPerm.type === 'except_people' ? 'active' : ''}" data-type="except_people" ${person.role === 'Superadmin' ? 'disabled' : ''}>Ohne Personen</button>
                                <button class="preset-btn ${userPerm.type === 'except_inventory' ? 'active' : ''}" data-type="except_inventory" ${person.role === 'Superadmin' ? 'disabled' : ''}>Ohne Inventar</button>
                                <button class="preset-btn ${userPerm.type === 'all' ? 'active' : ''}" data-type="all" ${person.role === 'Superadmin' ? 'disabled' : ''}>Vollzugriff</button>
                                <button class="preset-btn ${userPerm.type === 'specific' ? 'active' : ''}" data-type="specific" ${person.role === 'Superadmin' ? 'disabled' : ''}>Manuell</button>
                            </div>
                        </div>
                    </div>

                    <!-- Fine-grained Table Permissions -->
                    <div class="table-permissions-area" style="display: ${ (userPerm.type === 'specific' || userPerm.type === 'readonly') ? 'block' : 'none'};">
                        <h5>Tabellen-Berechtigungen</h5>
                        <div class="table-groups-container">
                            ${this._renderTableGroups(tableConfigs, userPerm)}
                        </div>
                    </div>
                </div>` : ''}
            </div>
        `;

        this._attachProfileListeners(container, name, userPerm, peopleData, tableConfigs, userStat);
    }

    static _renderTableGroups(tableConfigs, userPerm) {
        const globalState = GlobalStateManager.getInstance();
        const isSuperAdmin = globalState.isSuperAdmin();

        const groups = {
            'System': [
                { id: 'people_table', label: 'Personen (Split)' },
                { id: 'tbl_people', label: 'Personen (Haupt)' },
                { id: 'tbl_inventory', label: 'Inventar' }
            ],
            'Aktivitäten': tableConfigs.filter(t => t.category === 'spiele' && !['tbl_people', 'tbl_inventory'].includes(t.id)).map(t => ({ id: t.id, label: t.title })),
            'Sportarten': tableConfigs.filter(t => t.category === 'sportarten').map(t => ({ id: t.id, label: t.title })),
            ...this._getCustomGroups(tableConfigs)
        };

        let html = '';
        Object.entries(groups).filter(([_, items]) => items.length > 0).forEach(([name, items]) => {
            html += `
                <div class="permission-group-card">
                    <div class="group-header">
                        <h6>${name}</h6>
                        <div class="group-actions">
                            <button class="group-select-all" data-group="${name}" data-mode="view">Sicht</button>
                            <button class="group-select-all" data-group="${name}" data-mode="edit">Edit</button>
                        </div>
                    </div>
                    <div class="group-rows">
                        ${items.map(t => {
                            const viewChecked = Array.isArray(userPerm.viewTables) ? userPerm.viewTables.includes(t.id) : (Array.isArray(userPerm.tables) && userPerm.tables.includes(t.id));
                            const editChecked = Array.isArray(userPerm.editTables) ? userPerm.editTables.includes(t.id) : (Array.isArray(userPerm.tables) && userPerm.tables.includes(t.id));
                            
                            return `
                                <div class="table-perm-row">
                                    <span class="table-perm-label">${t.label}</span>
                                    <div class="table-perm-checks">
                                        <label class="compact-checkbox" title="Sichtbar">
                                            <input type="checkbox" class="cb-view" value="${t.id}" ${viewChecked ? 'checked' : ''} data-group="${name}">
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
                        
                        ${(name === 'System' && isSuperAdmin) ? `
                            <div class="table-perm-row special-perm-row">
                                <span class="table-perm-label">Rollen bearbeiten (Admin+)</span>
                                <div class="table-perm-checks">
                                    <label class="compact-checkbox" title="Edit Roles">
                                        <input type="checkbox" class="cb-role-edit" ${userPerm.canEditRoles ? 'checked' : ''}>
                                        <span class="box"></span>
                                    </label>
                                </div>
                            </div>
                            <div class="table-perm-row special-perm-row">
                                <span class="table-perm-label">Edit-Modus berechtigen</span>
                                <div class="table-perm-checks">
                                    <label class="compact-checkbox" title="Edit Mode">
                                        <input type="checkbox" class="cb-edit-mode-allow" ${userPerm.canUseEditMode ? 'checked' : ''}>
                                        <span class="box"></span>
                                    </label>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        return html;
    }

    static _getCustomGroups(tableConfigs) {
        const other = tableConfigs.filter(t => !['spiele', 'sportarten'].includes(t.category) && !['tbl_people', 'tbl_inventory'].includes(t.id));
        return other.length > 0 ? { 'Sonstige': other.map(t => ({ id: t.id, label: t.title })) } : {};
    }

    static _attachProfileListeners(container, name, userPerm, peopleData, tableConfigs, userStat) {
        const isSuperAdmin = GlobalStateManager.getInstance().isSuperAdmin();

        const save = (overridePerms = null) => {
            const activePreset = container.querySelector('.preset-btn.active');
            const type = activePreset ? activePreset.dataset.type : userPerm.type;
            
            const mgmtSelect = container.querySelector('.mgmt-select-modern');
            const managementAccess = mgmtSelect ? mgmtSelect.value : (userPerm.managementAccess || 'none');
            const canManage = (managementAccess === 'stats_only' || managementAccess === 'stats_perms');

            const viewTables = [];
            container.querySelectorAll('.cb-view:checked').forEach(cb => viewTables.push(cb.value));
            
            const editTables = [];
            container.querySelectorAll('.cb-edit:checked').forEach(cb => editTables.push(cb.value));

            const roleEditCb = container.querySelector('.cb-role-edit');
            const canEditRoles = roleEditCb ? roleEditCb.checked : (userPerm.canEditRoles || false);

            const editModeCb = container.querySelector('.cb-edit-mode-allow');
            const canUseEditMode = editModeCb ? editModeCb.checked : (userPerm.canUseEditMode || false);

            const newPerms = overridePerms || { type, viewTables, editTables, canManageUsers: canManage, managementAccess, canEditRoles, canUseEditMode };
            AuthService.savePermissions(name, newPerms);
            
            // Show feedback
            const saveIndicator = document.createElement('div');
            saveIndicator.className = 'save-indicator-toast';
            saveIndicator.textContent = 'Gespeichert';
            document.body.appendChild(saveIndicator);
            setTimeout(() => { if (saveIndicator.parentNode) saveIndicator.remove(); }, 2000);
        };

        // Presets
        container.querySelectorAll('.preset-btn').forEach(btn => {
            btn.onclick = () => {
                container.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const type = btn.dataset.type;
                const grid = container.querySelector('.table-permissions-area');
                if (grid) grid.style.display = (type === 'specific' || type === 'readonly') ? 'block' : 'none';
                
                save();
            };
        });

        // Group selection helpers
        container.querySelectorAll('.group-select-all').forEach(btn => {
            btn.onclick = () => {
                const group = btn.dataset.group;
                const mode = btn.dataset.mode;
                const selector = mode === 'view' ? '.cb-view' : '.cb-edit';
                const checkboxes = container.querySelectorAll(`${selector}[data-group="${group}"]`);
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                checkboxes.forEach(cb => cb.checked = !allChecked);
                save();
            };
        });

        // Individual checkboxes
        container.querySelectorAll('.table-groups-container input').forEach(cb => {
            cb.onchange = () => {
                const row = cb.closest('.table-perm-row');
                const viewCb = row.querySelector('.cb-view');
                const editCb = row.querySelector('.cb-edit');

                if (cb === editCb && editCb.checked) {
                    viewCb.checked = true; // Auto-enable view if editing is enabled
                } else if (cb === viewCb && !viewCb.checked) {
                    editCb.checked = false; // Auto-disable editing if view is revoked
                }

                save();
            };
        });
        
        // Management access
        const ms = container.querySelector('.mgmt-select-modern');
        if (ms) ms.onchange = () => save();

        // Admin Role toggle
        const at = container.querySelector('.admin-role-cb');
        if (at) at.onchange = async () => {
            const person = peopleData.find(p => `${p.vorname || ''} ${p.nachname || ''}`.trim() === name);
            if (person) {
                person.role = at.checked ? 'Admin' : 'User';
                await DataService.savePeople(peopleData);
                
                // Automatically apply new role default permissions
                const newPerms = PermissionService.getPermissionsForRole(person.role);
                save(newPerms);
                
                // Refresh heart badge in UI
                container.querySelector('.role-badge').textContent = person.role;
                
                // Re-render UI to reflect automatic preset change
                this._renderUserProfile(container, person, userStat, tableConfigs, peopleData);
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
