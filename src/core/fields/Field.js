import { GlobalStateManager } from '../GlobalStateManager.js';
import { Tooltip } from '../../ui/Tooltip.js';
import { TooltipGenerator } from '../../utils/TooltipGenerator.js';
import { CATEGORIES } from '../Constants.js';

export class Field {
    constructor({ rowId, rowData, colDef, value, peopleData, tableId, onChange, onEditStart, onTab }) {
        this.rowId = rowId;
        this.rowData = rowData;
        this.colDef = colDef;
        this.value = value;
        this.peopleData = peopleData;
        this.tableId = tableId;
        this.onChange = onChange;
        this.onEditStart = onEditStart;
        this.onTab = onTab;

        this.td = null;
        this.contentWrap = null;
    }

    render() {
        this.td = document.createElement('td');
        this.td.className = 'data-cell';
        this.td.dataset.colId = this.colDef.id;
        this.td.dataset.type = this.colDef.type || 'text';

        this.contentWrap = document.createElement('div');
        this.contentWrap.className = 'cell-content';

        this.updateDisplay();

        this.td.appendChild(this.contentWrap);
        this.attachCellListeners();

        // Automatic tooltips for fields referencing entities (People, Inventory)
        this._attachAutomaticTooltips();

        return this.td;
    }

    _attachAutomaticTooltips() {
        const val = this.getDisplayValue();
        if (!val || val === '—') return;

        // Skip if this is already an InventoryField or PersonField which handles its own
        // We check the class name or type to avoid double attachments
        if (this.constructor.name === 'InventoryField' || this.constructor.name === 'PersonField') {
            return;
        }

        const gs = GlobalStateManager.getInstance();
        
        // 1. Check for Person match
        if (this.peopleData) {
            const person = this.peopleData.find(p => {
                const fullName = `${p.vorname || ''} ${p.nachname || ''}`.trim();
                return p.id === val || fullName === val || p.vorname === val;
            });
            
            if (person) {
                const html = TooltipGenerator.generatePersonTooltip(person);
                const condition = () => !this.td.classList.contains('editing');
                Tooltip.attach(this.td, html, 400, condition);
                this.td.style.cursor = 'pointer';
                return;
            }
        }

        // 2. Check for Inventory match
        const inventory = gs.getInventory();
        if (inventory) {
            const item = inventory.find(i => (i.data?.name || '').toLowerCase() === String(val).toLowerCase());
            if (item) {
                const html = TooltipGenerator.generateInventoryTooltip(item.data);
                const condition = () => !this.td.classList.contains('editing');
                Tooltip.attach(this.td, html, 400, condition);
                this.td.style.cursor = 'pointer';
                return;
            }
        }

        // 3. Check for Location match
        const tables = gs.getTables();
        const ortTable = tables['tbl_ort'] || tables['ort'];
        if (ortTable && ortTable.instance && this.tableId !== 'tbl_ort' && this.tableId !== 'ort') {
            const loc = ortTable.instance.rows.find(r => 
                r.id === val || 
                (r.data?.title || '').toLowerCase() === String(val).toLowerCase()
            );
            if (loc) {
                const html = TooltipGenerator.generateLocationTooltip(loc.data);
                const condition = () => !this.td.classList.contains('editing');
                Tooltip.attach(this.td, html, 400, condition);
                this.td.style.cursor = 'pointer';
                return;
            }
        }

        // 4. Check for Game match
        for (const [id, tableInfo] of Object.entries(tables)) {
            if (tableInfo.config.category !== CATEGORIES.SPIELE && tableInfo.config.category !== CATEGORIES.SPORTARTEN) continue;
            if (this.tableId === id) continue; // Skip if this is the game's own table

            const game = tableInfo.instance.rows.find(r => 
                (r.data?.name || '').toLowerCase() === String(val).toLowerCase()
            );
            if (game) {
                const html = TooltipGenerator.generateGameTooltip(game.data, tableInfo.config.title);
                const condition = () => !this.td.classList.contains('editing');
                Tooltip.attach(this.td, html, 400, condition);
                this.td.style.cursor = 'pointer';
                return;
            }
        }
    }

    getDisplayValue() {
        return this.getRawValue();
    }

    getRawValue() {
        return this.value ?? '—';
    }

    updateDisplay() {
        if (this.contentWrap) {
            const val = this.getDisplayValue();
            if (this._isLink(val)) {
                const trimmed = val.trim();
                const href = trimmed.toLowerCase().startsWith('www.') ? `https://${trimmed}` : trimmed;
                this.contentWrap.innerHTML = `<a href="${href}" target="_blank" rel="noopener noreferrer" class="cell-link">${val}</a>`;
            } else {
                this.contentWrap.textContent = val;
            }
        }
    }

    _isLink(val) {
        if (!val || typeof val !== 'string' || val === '—') return false;
        const v = val.trim().toLowerCase();
        return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('www.');
    }

    attachCellListeners() {
        this.td.addEventListener('click', (e) => this.onClick(e));
        this.td.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    }

    onClick(e) {
        if (e.target.tagName === 'A') return;
        if (this.td.classList.contains('editing')) return;
        const isExpanded = this.td.classList.contains('expanded');
        document.querySelectorAll('.data-cell.expanded')
            .forEach(el => el.classList.remove('expanded'));
        if (!isExpanded) this.td.classList.add('expanded');
    }

    onDoubleClick(e) {
        e.stopPropagation();
        if (this.td.classList.contains('editing')) return;
        this.startEditing();
    }

    startEditing() {
        this.td.classList.add('editing');
        this.td.classList.remove('expanded'); // Remove expanded state on double-click/editing
        this.contentWrap.style.display = 'none';

        const editor = this.createEditor();
        this.td.appendChild(editor);

        editor.focus();
        if (editor.tagName === 'TEXTAREA') {
            editor.select();
        }

        this.onEditStart?.();

        let isFinishing = false;
        const finish = (save, advance = false) => {
            if (isFinishing) return;
            isFinishing = true;

            if (save) {
                this.saveEdit(editor);
            }
            this.finishEditing(editor);

            if (advance && this.onTab) {
                this.onTab(this.colDef.id);
            }
        };

        this.attachEditorListeners(editor, finish);
    }

    createEditor() {
        throw new Error('createEditor must be implemented in subclass');
    }

    attachEditorListeners(editor, finishCallback) {
        throw new Error('attachEditorListeners must be implemented in subclass');
    }

    extractValue(editor) {
        throw new Error('extractValue must be implemented in subclass');
    }

    saveEdit(editorOrValue) {
        const newVal = (editorOrValue?.tagName || editorOrValue?.nodeName)
            ? this.extractValue(editorOrValue)
            : editorOrValue;

        if (newVal === this.value) {
            return; // No change, do nothing
        }
        this.value = newVal;
        this.updateDisplay();
        this.onChange?.(this.colDef.id, newVal);
    }

    finishEditing(editor) {
        editor.remove();
        this.contentWrap.style.display = '';
        this.td.classList.remove('editing');
    }
}
