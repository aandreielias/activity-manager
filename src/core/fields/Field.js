export class Field {
    constructor({ rowId, colDef, value, peopleData, onChange, onEditStart }) {
        this.rowId = rowId;
        this.colDef = colDef;
        this.value = value;
        this.peopleData = peopleData;
        this.onChange = onChange;
        this.onEditStart = onEditStart;

        this.td = null;
        this.contentWrap = null;
    }

    render() {
        this.td = document.createElement('td');
        this.td.className = 'data-cell';
        this.td.dataset.colId = this.colDef.id;

        this.contentWrap = document.createElement('div');
        this.contentWrap.className = 'cell-content';

        this.updateDisplay();

        this.td.appendChild(this.contentWrap);
        this.attachCellListeners();

        return this.td;
    }

    getDisplayValue() {
        return this.getRawValue();
    }

    getRawValue() {
        return this.value ?? '—';
    }

    updateDisplay() {
        if (this.contentWrap) {
            this.contentWrap.textContent = this.getDisplayValue();
        }
    }

    attachCellListeners() {
        this.td.addEventListener('click', (e) => this.onClick(e));
        this.td.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    }

    onClick() {
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
        this.td.classList.add('editing', 'expanded');
        this.contentWrap.style.display = 'none';

        const editor = this.createEditor();
        this.td.appendChild(editor);

        editor.focus();
        if (editor.tagName === 'TEXTAREA') editor.select();

        this.onEditStart?.();

        const finish = (save) => {
            if (save) {
                this.saveEdit(editor);
            }
            this.finishEditing(editor);
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

    saveEdit(editor) {
        const newVal = this.extractValue(editor);
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
