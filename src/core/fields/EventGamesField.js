import { Field } from './Field.js';
import { GlobalStateManager } from '../GlobalStateManager.js';
import { DataService } from '../../services/DataService.js';
import { SupabaseClient } from '../../services/SupabaseClient.js';
import { Dialog } from '../../ui/Dialog.js';
import { BaseDialog } from '../../ui/BaseDialog.js';
import { Tooltip } from '../../ui/Tooltip.js';
import { TooltipGenerator } from '../../utils/TooltipGenerator.js';

/**
 * EventGamesField - Specialized field for defining a sequence (Reihenfolge)
 * of items, each assigned to a team and a responsible person.
 */
export class EventGamesField extends Field {
    updateDisplay() {
        if (!this.contentWrap) return;
        this.contentWrap.innerHTML = '';

        const rawValue = this.getRawValue();
        if (rawValue === '—' || !rawValue) {
            this.contentWrap.textContent = '—';
            return;
        }

        let data = [];
        try {
            data = JSON.parse(rawValue);
        } catch (e) {
            data = rawValue.split(',').map(t => ({ name: t.trim(), team: 'Aktivitäten', responsible: null })).filter(d => d.name);
        }

        if (!Array.isArray(data)) data = [];

        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'event-games-tags';
        tagsContainer.style.display = 'flex';
        tagsContainer.style.flexWrap = 'wrap';
        tagsContainer.style.gap = '6px';

        data.forEach(item => {
            const team = item.team || 'Aktivitäten';
            const isAktivitäten = team === 'Aktivitäten';
            
            const gameInfo = isAktivitäten ? this._getGameData(item.name) : null;
            const status = gameInfo ? gameInfo.data.status : (isAktivitäten ? this._getGameStatus(item.name) : 'To Do');
            let statusClass = isAktivitäten && status ? 'status-' + status.toLowerCase().replace(/\s+/g, '-') : '';
            let isDeleted = false;

            if (isAktivitäten && !this._getGameCategory(item.name)) {
                statusClass = 'status-deleted';
                isDeleted = true;
            }

            const tag = document.createElement('span');
            tag.className = `event-game-tag ${statusClass}`;
            tag.style.fontSize = '12px';
            tag.style.cursor = 'pointer';

            const teamSpan = document.createElement('span');
            teamSpan.className = 'game-team';
            teamSpan.style.opacity = '0.7';
            teamSpan.style.fontSize = '10px';
            teamSpan.style.marginRight = '4px';
            teamSpan.style.fontWeight = 'bold';
            teamSpan.textContent = `[${team}]`;
            tag.appendChild(teamSpan);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'game-name';
            nameSpan.textContent = item.name;
            tag.appendChild(nameSpan);

            if (isDeleted) {
                const delSpan = document.createElement('span');
                delSpan.style.fontSize = '8px';
                delSpan.style.opacity = '0.7';
                delSpan.style.marginLeft = '4px';
                delSpan.textContent = '(gelöscht)';
                tag.appendChild(delSpan);
            }

            if (item.responsible && !isDeleted) {
                const person = this.peopleData?.find(p => p.id === item.responsible);
                if (person) {
                    const respSpan = document.createElement('span');
                    respSpan.className = 'game-resp';
                    respSpan.style.marginLeft = '4px';
                    respSpan.textContent = `(${person.vorname} ${person.nachname.charAt(0)}.)`;
                    tag.appendChild(respSpan);
                }
            }

            // Attach tooltip
            if (gameInfo) {
                const html = TooltipGenerator.generateGameTooltip(gameInfo.data, gameInfo.categoryTitle);
                const condition = () => !this.td?.classList.contains('editing');
                Tooltip.attach(tag, html, 400, condition);
            }

            tagsContainer.appendChild(tag);
        });

        this.contentWrap.appendChild(tagsContainer);
    }

    _getGameData(gameName) {
        const tables = GlobalStateManager.getInstance().getTables();
        if (!tables) return null;
        for (const [id, tableInfo] of Object.entries(tables)) {
            if (tableInfo.config.category !== 'spiele' && tableInfo.config.category !== 'sportarten') continue;
            const row = tableInfo.instance.rows.find(r => r.data.name === gameName);
            if (row) return { data: row.data, categoryTitle: tableInfo.config.title };
        }
        return null;
    }

    startEditing() {
        this.onEditStart?.();
        this._showPicker();
    }

    async _showPicker() {
        const rawValue = this.getRawValue();
        let currentData = [];
        try {
            currentData = JSON.parse(rawValue);
        } catch (e) {
            currentData = rawValue === '—' || !rawValue ? [] : rawValue.split(',').map(t => ({ name: t.trim(), team: 'Aktivitäten', responsible: null })).filter(d => d.name);
        }
        if (!Array.isArray(currentData)) currentData = [];

        const gs = GlobalStateManager.getInstance();
        const availableTeams = gs.getAvailableTeams();
        const availableGames = [...(this.colDef.availableTags || [])];
        
        const activePeople = (this.peopleData || [])
            .filter(p => (p.Status || '').toLowerCase() !== 'inaktiv')
            .map(p => ({ id: p.id, name: `${p.vorname} ${p.nachname}`, teams: (p.Team || p.Teams || '').split(',').map(s => s.trim()).filter(Boolean) }));

        return BaseDialog.show({
            overlayClassName: 'picker-overlay',
            dialogClassName: 'picker-dialog',
            closeOnEscape: false,
            closeOnOutsideClick: true,
            onEscapeValue: null,
            render: (dialog, overlay, resolve, cleanup) => {
                dialog.style.maxWidth = '600px';

                const header = document.createElement('div');
                header.className = 'picker-header';
                header.innerHTML = '<h2>Reihenfolge & Verantwortliche</h2>';
                dialog.appendChild(header);

                const content = document.createElement('div');
                content.className = 'picker-content';
                dialog.appendChild(content);

                let internalSelected = [...currentData];
                this.selectedRowEls = [];
                this.availableTagEls = [];
                this.currentSearchVal = '';

                const _applySearch = (val) => {
                    this.currentSearchVal = (val || '').toLowerCase().trim();
                    const v = this.currentSearchVal;

                    const filterItems = (items, showDisplay) => {
                        items.forEach(item => {
                            if (!v) {
                                item.el.style.display = showDisplay;
                            } else {
                                const words = item.text.split(/[\s-]+/);
                                const match = words.some(w => w.startsWith(v)) || item.text.includes(v);
                                item.el.style.display = match ? showDisplay : 'none';
                            }
                        });
                    };

                    filterItems(this.availableTagEls, 'inline-flex');
                    filterItems(this.selectedRowEls, 'flex');
                };

                const refreshSelected = () => {
                    const existingSection = content.querySelector('.selected-section');
                    if (existingSection) existingSection.remove();
                    this.selectedRowEls = [];

                    const section = document.createElement('div');
                    section.className = 'picker-section selected-section';
                    section.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div class="picker-section-title">Aktuelle Reihenfolge</div>
                            <button class="picker-btn primary" style="padding:4px 8px; font-size:10px;">+ Neuer Punkt</button>
                        </div>
                    `;

                    section.querySelector('.primary').onclick = () => {
                        internalSelected.push({ name: 'Neuer Punkt', team: 'Aktivitäten', responsible: null });
                        refreshSelected();
                    };

                    const list = document.createElement('div');
                    list.className = 'picker-list';
                    list.style.gap = '8px';

                    internalSelected.forEach((item, idx) => {
                        const itemRow = document.createElement('div');
                        itemRow.className = 'event-game-picker-row';
                        itemRow.style.display = 'flex';
                        itemRow.style.alignItems = 'center';
                        itemRow.style.gap = '8px';
                        itemRow.style.padding = '6px';
                        itemRow.style.borderBottom = '1px solid var(--border-light)';

                        // Drag/Nav controls
                        const nav = document.createElement('div');
                        nav.style.display = 'flex';
                        nav.style.flexDirection = 'column';
                        nav.style.gap = '2px';
                        const up = document.createElement('button'); up.className = 'col-nav-btn'; up.innerHTML = '▲'; up.disabled = idx === 0;
                        up.onclick = () => { const itm = internalSelected.splice(idx, 1)[0]; internalSelected.splice(idx - 1, 0, itm); refreshSelected(); };
                        const down = document.createElement('button'); down.className = 'col-nav-btn'; down.innerHTML = '▼'; down.disabled = idx === internalSelected.length - 1;
                        down.onclick = () => { const itm = internalSelected.splice(idx, 1)[0]; internalSelected.splice(idx + 1, 0, itm); refreshSelected(); };
                        nav.appendChild(up); nav.appendChild(down);
                        itemRow.appendChild(nav);

                        const isAktivitäten = (item.team || 'Aktivitäten') === 'Aktivitäten';
                        const status = isAktivitäten ? this._getGameStatus(item.name) : 'To Do';
                        const isDeleted = isAktivitäten && !this._getGameCategory(item.name);
                        const statusClass = isDeleted ? 'status-deleted' : (status ? 'status-' + status.toLowerCase().replace(/\s+/g, '-') : 'status-to-do');

                        // Team select
                        const teamSel = document.createElement('select');
                        teamSel.className = 'dialog-input';
                        teamSel.style.width = '100px';
                        teamSel.style.fontSize = '11px';
                        teamSel.innerHTML = availableTeams.map(t => `<option value="${t.name}" ${item.team === t.name ? 'selected' : ''}>${t.name}</option>`).join('');
                        teamSel.onchange = (e) => {
                            item.team = e.target.value;
                            item.responsible = null; // Reset person on team change
                            refreshSelected();
                        };
                        itemRow.appendChild(teamSel);

                        // Editable Name
                        const nameInput = document.createElement('input');
                        nameInput.className = 'dialog-input';
                        nameInput.style.flex = '1';
                        nameInput.style.fontSize = '12px';
                        nameInput.style.fontWeight = '600';
                        nameInput.value = item.name;
                        nameInput.oninput = (e) => item.name = e.target.value;
                        itemRow.appendChild(nameInput);

                        // Person select (filtered by team)
                        const filteredPeople = activePeople.filter(p => !item.team || item.team === 'all' || p.teams.includes(item.team));
                        const personSel = document.createElement('select');
                        personSel.className = 'dialog-input';
                        personSel.style.width = '120px';
                        personSel.style.fontSize = '11px';
                        personSel.innerHTML = '<option value="">Person...</option>' +
                            filteredPeople.map(p => `<option value="${p.id}" ${item.responsible === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
                        personSel.onchange = (e) => item.responsible = e.target.value;
                        itemRow.appendChild(personSel);

                        const del = document.createElement('button');
                        del.className = 'picker-btn secondary';
                        del.style.padding = '4px 8px';
                        del.textContent = '✕';
                        del.onclick = () => { internalSelected.splice(idx, 1); refreshSelected(); };
                        itemRow.appendChild(del);

                        list.appendChild(itemRow);
                        this.selectedRowEls.push({ text: item.name.toLowerCase(), el: itemRow });
                    });

                    if (internalSelected.length === 0) {
                        const empty = document.createElement('div');
                        empty.textContent = 'Noch keine Einträge vorhanden.';
                        empty.style.padding = '20px';
                        empty.style.textAlign = 'center';
                        empty.style.color = 'var(--text-muted)';
                        list.appendChild(empty);
                    }

                    section.appendChild(list);
                    content.prepend(section);
                    _applySearch(this.currentSearchVal);
                };

                const refreshAvailable = () => {
                    const existing = content.querySelector('.available-section');
                    if (existing) existing.remove();
                    this.availableTagEls = [];

                    const section = document.createElement('div');
                    section.className = 'picker-section available-section';

                    const headerRow = document.createElement('div');
                    headerRow.style.display = 'flex';
                    headerRow.style.justifyContent = 'space-between';
                    headerRow.style.alignItems = 'center';
                    headerRow.style.marginBottom = '8px';
                    headerRow.innerHTML = '<div class="picker-section-title" style="margin:0">Objekt hinzufügen (Aktivitäten)</div>';

                    const search = document.createElement('input');
                    search.className = 'dialog-input';
                    search.placeholder = 'Suchen...';
                    search.style.width = '140px';
                    search.value = this.currentSearchVal;
                    search.oninput = (e) => _applySearch(e.target.value);
                    search.onkeydown = async (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            const sVal = search.value.trim();
                            if (!sVal) return;
                            const match = availableGames.find(g => g.toLowerCase() === sVal.toLowerCase());
                            if (match) {
                                internalSelected.push({ name: match, team: 'Aktivitäten', responsible: null });
                                refreshSelected();
                                search.value = ''; _applySearch('');
                                return;
                            }
                            await handleQuickAdd(sVal, search);
                        }
                    };

                    headerRow.appendChild(search);
                    section.appendChild(headerRow);

                    const list = document.createElement('div');
                    list.className = 'picker-list';
                    list.style.flexDirection = 'row';
                    list.style.flexWrap = 'wrap';
                    list.style.gap = '6px';

                    availableGames.forEach(game => {
                        const tag = document.createElement('div');
                        tag.className = 'inventory-tag available';
                        tag.style.display = 'inline-flex';
                        tag.style.flexDirection = 'column';
                        tag.style.padding = '6px 10px';
                        tag.style.cursor = 'pointer';
                        tag.innerHTML = `<span style="font-size:8px; opacity:0.6">${this._getGameCategory(game) || '&nbsp;'}</span><span style="font-weight:500">${game}</span>`;
                        tag.onclick = () => { internalSelected.push({ name: game, team: 'Aktivitäten', responsible: null }); refreshSelected(); };
                        tag.ondblclick = (e) => {
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent('jump-to-game', { detail: { gameName: game } }));
                        };
                        list.appendChild(tag);
                        this.availableTagEls.push({ text: game.toLowerCase(), el: tag });
                    });

                    section.appendChild(list);
                    content.appendChild(section);
                    _applySearch(this.currentSearchVal);
                };

                const handleQuickAdd = async (sVal, searchInput) => {
                    const configs = GlobalStateManager.getInstance().getAllTableConfigs();
                    const cats = configs
                        .filter(c => c.category === 'spiele' || c.category === 'sportarten')
                        .map(c => ({ id: c.id, label: c.title, table: c.category === 'sportarten' ? 'sport_venues' : 'activities', dbCat: c.id.replace('tbl_activities_', '').replace('tbl_sport_', '') }));

                    if (cats.length === 0) cats.push({ id: 'sonstige', label: 'Sonstige', table: 'activities', dbCat: 'sonstige' });

                    const overlayDiag = document.createElement('div');
                    overlayDiag.className = 'custom-dialog-overlay';
                    overlayDiag.style.zIndex = '20000';
                    const diag = document.createElement('div');
                    diag.className = 'custom-dialog picker-dialog';
                    diag.style.display = 'block'; diag.style.background = 'var(--bg)'; diag.style.padding = '24px'; diag.style.width = '360px';
                    diag.innerHTML = `<div class="picker-header" style="padding:0; border:none; margin-bottom:16px;"><h2>Kategorie wählen</h2></div>
                        <div style="margin-bottom:12px; font-size:0.9rem;">In welche Tabelle gehört "${sVal}"?</div>
                        <select class="dialog-input" style="width:100%; margin-bottom:20px; height:38px;">${cats.map(c => `<option value="${c.id}">${c.label}</option>`).join('')}</select>
                        <div style="display:flex; justify-content:flex-end; gap:10px;"><button class="picker-btn secondary">Abbrechen</button><button class="picker-btn primary">Erstellen</button></div>`;

                    overlayDiag.appendChild(diag);
                    document.body.appendChild(overlayDiag);

                    const select = diag.querySelector('select');
                    diag.querySelector('.secondary').onclick = () => overlayDiag.remove();
                    diag.querySelector('.primary').onclick = async () => {
                        const c = cats.find(x => x.id === select.value);
                        overlayDiag.remove();
                        searchInput.disabled = true;
                        try {
                            const payload = { name: sVal, status: 'To Do', created_at: new Date().toISOString() };
                            if (c.table === 'sport_venues') payload.sport_type = c.dbCat; else payload.category = c.dbCat;
                            const res = await SupabaseClient.post(c.table, payload, { 'Prefer': 'return=representation' });
                            if (!res.ok) throw new Error();
                            const inserted = await res.json();
                            const newGame = inserted[0];
                            GlobalStateManager.getInstance().trackSessionGame(newGame.name, c.label);
                            internalSelected.push({ name: newGame.name, team: 'Aktivitäten', responsible: null });
                            availableGames.push(newGame.name);
                            refreshSelected();
                            refreshAvailable();
                            window.dispatchEvent(new CustomEvent('refresh-data'));
                        } catch (e) { alert('Fehler'); }
                        searchInput.disabled = false;
                        searchInput.value = '';
                        _applySearch('');
                    };
                };

                refreshSelected();
                refreshAvailable();

                const footer = document.createElement('div');
                footer.className = 'picker-footer';
                const cBtn = document.createElement('button'); cBtn.className = 'picker-btn secondary'; cBtn.textContent = 'Abbrechen';
                const sBtn = document.createElement('button'); sBtn.className = 'picker-btn primary'; sBtn.textContent = 'Speichern';
                footer.appendChild(cBtn); footer.appendChild(sBtn);
                dialog.appendChild(footer);

                cBtn.onclick = cleanup;
                sBtn.onclick = () => {
                    const val = JSON.stringify(internalSelected);
                    this.onChange?.(this.colDef.id, val);
                    this.value = val;
                    this.updateDisplay();
                    cleanup();
                };
            }
        });
    }

    _getGameStatus(gameName) {
        const tables = GlobalStateManager.getInstance().getTables();
        if (!tables) return 'To Do';
        for (const [id, tableInfo] of Object.entries(tables)) {
            if (tableInfo.config.category !== 'spiele') continue;
            const row = tableInfo.instance.rows.find(r => r.data.name === gameName);
            if (row) return row.data.status || 'To Do';
        }
        return 'To Do';
    }

    _getGameCategory(gameName) {
        const gs = GlobalStateManager.getInstance();
        const sessionCat = gs.getSessionGameCategory(gameName);
        if (sessionCat) return sessionCat;
        const tables = gs.getTables();
        if (!tables) return '';
        for (const [id, tableInfo] of Object.entries(tables)) {
            if (tableInfo.config.category !== 'spiele') continue;
            const row = tableInfo.instance.rows.find(r => r.data.name === gameName);
            if (row) return tableInfo.config.title;
        }
        return null;
    }
}
