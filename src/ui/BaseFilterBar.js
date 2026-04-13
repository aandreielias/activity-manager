import { GlobalStateManager } from '../core/GlobalStateManager.js';

/**
 * BaseFilterBar - Abstract parent class for all filter bars.
 * Faceted search is disabled. Parent-Child constraints are retained.
 */
export class BaseFilterBar {
    constructor({ schema, state, onUpdate, tableId, rows, isGlobal }) {
        this.schema = schema; this.state = state; this.onUpdate = onUpdate; 
        this.tableId = tableId; this.rows = rows || []; this.isGlobal = isGlobal || false;
        this.globalStateContext = null; this.element = null; this._activeMenu = null; this._activeTracker = null;
        if (!this.state.filters) this.state.filters = [];
        if (this.state.filters.length === 0) this.state.filters.push({ attrId: null, mode: null, value: [], quantityMode: 'any', quantityValue: '', availability: [] });
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = `filter-bar ${this.state.active ? '' : 'hidden'}`;
        const content = document.createElement('div'); content.className = 'filter-bar-content';
        this.element.appendChild(content); this._populate(content); return this.element;
    }

    updateSchema(newSchema) { this.schema = newSchema; if (this.element) this.refresh(); }
    updateRows(rows, globalState = null) { this.rows = rows || []; this.globalStateContext = globalState; if (this.element && this.state.active) this.refresh(); }

    refresh() {
        if (!this.element) return; this._closeActiveMenu(); 
        this.element.classList.toggle('hidden', !this.state.active);
        const content = this.element.querySelector('.filter-bar-content');
        if (content) { content.innerHTML = ''; this._populate(content); }
    }

    _populate(container) {
        if (this.schema.length === 0) return;
        const g1 = document.createElement('div'); g1.className = 'filter-group'; g1.innerHTML = '<span class="filter-label">Gruppieren:</span>';
        const gO = this.schema.filter(f => ['enum', 'number', 'tag'].includes(f.type));
        const curG = this.schema.find(s => s.id === this.state.groupBy);
        g1.appendChild(this._createFilterDropdown(gO, curG ? curG.label : 'Attribut...', (o) => { this.state.groupBy = o.id; this.refresh(); this.onUpdate(this.state); }));
        if (this.state.groupBy) {
            const b = Object.assign(document.createElement('button'), { className: 'filter-remove-btn', innerHTML: '×' });
            b.onclick = () => { this.state.groupBy = null; this.refresh(); this.onUpdate(this.state); }; g1.appendChild(b);
        }
        container.appendChild(g1); container.appendChild(Object.assign(document.createElement('div'), { className: 'filter-separator' }));

        const g2 = document.createElement('div'); g2.className = 'filter-group'; g2.innerHTML = '<span class="filter-label">Filter:</span>';
        this.state.filters.forEach((f, idx) => {
            const row = document.createElement('div'); row.className = 'filter-row';
            const cur = this.schema.find(s => s.id === f.attrId);
            row.appendChild(this._createFilterDropdown(this.schema, cur ? cur.label : 'Attribut...', (o) => { f.attrId = o.id; f.mode = null; f.value = []; f.availability = []; this.refresh(); this.onUpdate(this.state); }));

            if (cur) {
                const label = (cur.label || '').toLowerCase();
                const id = (cur.id || '').toLowerCase();
                const isInv = id.includes('gegenstände') || id.includes('required_items') || label.includes('gegenstände') || cur.type === 'inventory';

                let modes = [{ id: 'contains', label: 'enthält' }, { id: 'not_contains', label: 'enthält nicht' }, { id: 'equals', label: 'exakt' }];
                if (cur.type === 'number') modes = [{ id: 'equals', label: 'gleich' }, { id: 'greater', label: 'größer' }, { id: 'less', label: 'kleiner' }];
                else if (cur.type === 'date' || cur.id === 'date') modes = [{ id: 'equals', label: 'am' }, { id: 'after', label: 'nach' }, { id: 'before', label: 'vor' }];
                else if (['enum', 'tag', 'inventory'].includes(cur.type) || isInv || cur.options || cur.availableTags) modes = [{ id: 'is', label: 'ist' }, { id: 'is_not', label: 'ist nicht' }];
                if (!f.mode) f.mode = modes[0].id;
                row.appendChild(this._createFilterDropdown(modes, modes.find(m => m.id === f.mode)?.label || modes[0].label, (o) => { f.mode = o.id; this.refresh(); this.onUpdate(this.state); }));

                if (['enum', 'tag', 'inventory'].includes(cur.type) || isInv || cur.options || cur.availableTags) {
                    let full = cur.options || cur.availableTags || [];
                    if (isInv) full = GlobalStateManager.getInstance().getInventory().map(i => i.data?.name || i.name);
                    if (full.length === 0) full = GlobalStateManager.getInstance().getEnumOptionsForColumn(cur.id, this.tableId) || [];
                    const normFull = full.map(o => { const id = typeof o === 'string' ? o : (o.id ?? o.value); return { id, label: typeof o === 'string' ? o : (o.label ?? o.header ?? id) }; });
                    
                    let finalOptions = normFull;

                    // STRICT HIERARCHICAL LOGIC (No Faceting)
                    if (!this.isGlobal && this.globalStateContext && this.globalStateContext.active) {
                        const globalCriteria = (this.globalStateContext.filters || []).filter(gf => gf.attrId && (Array.isArray(gf.value) ? gf.value.length > 0 : gf.value !== ''));
                        
                        // Rule: Dropdown is ONLY pruned if the Global Filter targets the EXACT SAME attribute
                        const sameAttrFilters = globalCriteria.filter(gf => this._compare(gf.attrId, cur.id));
                        if (sameAttrFilters.length > 0) {
                            finalOptions = normFull.filter(opt => {
                                return sameAttrFilters.every(gf => {
                                    const vals = Array.isArray(gf.value) ? gf.value : [gf.value];
                                    const match = vals.some(v => this._compare(v, opt.id));
                                    return gf.mode === 'is' ? match : !match;
                                });
                            });
                        }
                    }

                    if (!Array.isArray(f.value)) f.value = f.value ? [f.value] : [];
                    const l = f.value.length === 0 ? 'Wert...' : (f.value.length === 1 ? finalOptions.find(o => o.id === f.value[0])?.label || f.value[0] : `${f.value.length} ausgewählt`);
                    row.appendChild(this._createFilterDropdown(finalOptions, l, () => this.onUpdate(this.state), false, true, f.value, cur.id?.toLowerCase().includes('status')));

                    if (isInv && f.mode === 'is') {
                        row.appendChild(Object.assign(document.createElement('span'), { className: 'filter-label', textContent: 'Anzahl:', style: 'margin-left:8px' }));
                        const qMs = [{ id: 'any', label: 'egal' }, { id: 'equals', label: '=' }, { id: 'greater', label: '>' }, { id: 'less', label: '<' }];
                        row.appendChild(this._createFilterDropdown(qMs, qMs.find(m => m.id === (f.quantityMode || 'any')).label, (o) => { f.quantityMode = o.id; this.refresh(); this.onUpdate(this.state); }));
                        if (f.quantityMode && f.quantityMode !== 'any') {
                            const qIn = Object.assign(document.createElement('input'), { 
                                className: 'filter-input', 
                                type: 'number',
                                min: '1',
                                value: f.quantityValue || '', 
                                placeholder: '1', 
                                style: 'width:60px' 
                            });
                            qIn.oninput = (e) => { 
                                let val = parseInt(e.target.value);
                                if (val < 1) { val = 1; e.target.value = 1; }
                                f.quantityValue = val; 
                                this.onUpdate(this.state); 
                            }; row.appendChild(qIn);
                        }
                        row.appendChild(Object.assign(document.createElement('span'), { className: 'filter-label', textContent: 'Verfügbarkeit:', style: 'margin-left:8px' }));
                        const aMs = [{ id: 'available', label: 'Verfügbar' }, { id: 'partial', label: 'Teilweise' }, { id: 'none', label: 'Nicht verfügbar' }];
                        const aL = f.availability.length === 0 ? 'Alle' : (f.availability.length === 1 ? aMs.find(m => m.id === f.availability[0]).label : `${f.availability.length} ausgewählt`);
                        row.appendChild(this._createFilterDropdown(aMs, aL, () => this.onUpdate(this.state), false, true, f.availability, true));
                    }
                } else {
                    const isNum = cur.type === 'number';
                    const isDate = cur.type === 'date' || cur.id === 'date';
                    
                    let minVal = isNum ? '1' : undefined;
                    let maxVal = undefined;

                    // Apply Parent-Child constraints for Scalar fields
                    if (!this.isGlobal && this.globalStateContext && this.globalStateContext.active) {
                        const globalCriteria = (this.globalStateContext.filters || []).filter(gf => this._compare(gf.attrId, cur.id));
                        globalCriteria.forEach(gf => {
                            if (gf.mode === 'greater') {
                                if (!minVal || parseFloat(gf.value) > parseFloat(minVal)) minVal = gf.value;
                            } else if (gf.mode === 'less') {
                                if (!maxVal || parseFloat(gf.value) < parseFloat(maxVal)) maxVal = gf.value;
                            } else if (gf.mode === 'equals' && gf.value) {
                                minVal = gf.value;
                                maxVal = gf.value;
                            }
                        });
                    }

                    const inp = Object.assign(document.createElement('input'), { 
                        className: 'filter-input', 
                        type: isNum ? 'number' : (isDate ? 'date' : 'text'),
                        min: minVal,
                        max: maxVal,
                        value: f.value || '', 
                        placeholder: 'Wert...' 
                    });
                    
                    inp.oninput = (e) => { 
                        let val = e.target.value;
                        // Validation logic
                        if (isNum && val !== '') {
                            const n = parseFloat(val);
                            if (minVal && n < parseFloat(minVal)) { val = minVal; e.target.value = val; }
                            if (maxVal && n > parseFloat(maxVal)) { val = maxVal; e.target.value = val; }
                        }
                        f.value = val; 
                        this.onUpdate(this.state); 
                    }; row.appendChild(inp);
                }


            }
            const rem = Object.assign(document.createElement('button'), { className: 'filter-remove-btn', innerHTML: '×' });
            rem.onclick = () => { if (this.state.filters.length > 1) this.state.filters.splice(idx, 1); else this.state.filters[0] = { attrId: null, mode: null, value: [], quantityMode: 'any', quantityValue: '', availability: [] }; this.refresh(); this.onUpdate(this.state); };
            row.appendChild(rem); g2.appendChild(row);
        });
        const add = Object.assign(document.createElement('button'), { className: 'filter-add-btn', innerHTML: '+' });
        add.onclick = () => { this.state.filters.push({ attrId: null, mode: null, value: [], quantityMode: 'any', quantityValue: '', availability: [] }); this.refresh(); };
        g2.appendChild(add); container.appendChild(g2);
        if (this.state.filters.some(f => f.attrId) || this.state.groupBy) {
            const clear = Object.assign(document.createElement('button'), { className: 'filter-clear-all-btn', textContent: 'Filter zurücksetzen' });
            clear.onclick = () => { this.state.filters = [{ attrId: null, mode: null, value: [], quantityMode: 'any', quantityValue: '', availability: [] }]; this.state.groupBy = null; this.refresh(); this.onUpdate(this.state); };
            container.appendChild(clear);
        }
    }

    _createFilterDropdown(options, placeholder, onSelect, showClear = false, multiSelect = false, values = [], colored = false) {
        const wrap = Object.assign(document.createElement('div'), { className: 'dropdown-container' });
        const btn = Object.assign(document.createElement('button'), { className: 'nav-btn dropdown-btn' });
        const upd = () => {
            const c = (values || []).length;
            if (multiSelect) {
                btn.innerHTML = `<span>${c === 0 ? placeholder : (c === 1 ? (options.find(o => o.id === values[0])?.label || values[0]) : `${c} ausgewählt`)}</span> <span class="dropdown-arrow">▼</span>`;
                btn.classList.toggle('active', c > 0);
            } else {
                btn.innerHTML = `<span>${placeholder}</span> <span class="dropdown-arrow">▼</span>`;
                btn.classList.toggle('active', !['Attribut...', 'Wert...', 'Alle', 'egal'].includes(placeholder));
            }
        }; upd();
        btn.onclick = (e) => {
            e.stopPropagation(); if (this._activeMenu) { this._closeActiveMenu(); return; }
            const menu = Object.assign(document.createElement('div'), { className: 'dropdown-menu dropdown-menu-portal' });
            menu.style.cssText = 'display:flex; position:fixed; z-index:1000000;';
            options.forEach(o => {
                const item = Object.assign(document.createElement('button'), { className: 'dropdown-item', textContent: o.label });
                if (colored) {
                    const id = String(o.id).toLowerCase().replace(/\s+/g, '');
                    if (['available', 'verfügbar', 'done', 'aktiv'].includes(id)) item.classList.add('status-done', 'styled-status-item');
                    else if (['partial', 'teilweise', 'inprogress', 'in-progress'].includes(id)) item.classList.add('status-in-progress', 'styled-status-item');
                    else if (['none', 'nichtverfügbar', 'todo', 'todo', 'inaktiv'].includes(id)) item.classList.add('status-todo', 'styled-status-item');
                }
                if (multiSelect && values.includes(o.id)) item.classList.add('selected');
                item.onclick = (ev) => {
                    if (multiSelect) { ev.stopPropagation(); const i = values.indexOf(o.id); if (i === -1) values.push(o.id); else values.splice(i, 1); item.classList.toggle('selected'); upd(); onSelect(o); }
                    else { this._closeActiveMenu(); onSelect(o); }
                }; menu.appendChild(item);
            });
            document.body.appendChild(menu); this._activeMenu = menu;
            const move = () => { if (!this._activeMenu) return; const r = btn.getBoundingClientRect(); menu.style.cssText += `top:${r.bottom + 4}px; left:${r.left}px; min-width:${r.width}px;`; if (menu.getBoundingClientRect().right > window.innerWidth) menu.style.left = `${window.innerWidth - menu.offsetWidth - 20}px`; this._activeTracker = requestAnimationFrame(move); };
            move();
            const watch = (ev) => { if (!menu.contains(ev.target) && ev.target !== btn) { this._closeActiveMenu(); document.removeEventListener('mousedown', watch); } };
            setTimeout(() => document.addEventListener('mousedown', watch), 0);
        }; wrap.appendChild(btn); return wrap;
    }

    _closeActiveMenu() { if (this._activeMenu) { this._activeMenu.remove(); this._activeMenu = null; } if (this._activeTracker) { cancelAnimationFrame(this._activeTracker); this._activeTracker = null; } }
    _compare(a, b) { const nA = String(a || '').toLowerCase().replace(/\s+/g, ''); const nB = String(b || '').toLowerCase().replace(/\s+/g, ''); return nA === nB && nA !== ''; }
}
