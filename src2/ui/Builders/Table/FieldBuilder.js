import { TableNavigator } from './TableNavigator.js';
import { eventBus } from '../../../events/EventBus.js';
import { Authenticator } from '../../../core/Database/Authenticator.js';

export class FieldBuilder {
    constructor(field, row, options = {}) {
        this.field = field;
        this.row = row;

        const hasWriteAccess = Authenticator.canWriteField(this.row.table.id, this.field.id, this.row.table.groupId);
        this.options = { isEditable: hasWriteAccess, ...options };
    }

    build() {
        const td = document.createElement('td');
        td.classList.add('table-field');
        td.dataset.fieldName = this.field.name;
        td.dataset.fieldType = this.field.type;

        this.renderDisplay(td);

        if (this.options.isEditable) {

            if (this.isBooleanType()) {
                td.addEventListener('click', () => this.toggleBoolean(td));
                td.classList.add('field-pointer');
            } else {
                td.addEventListener('click', () => this.handleEdit(td));
            }
        }

        eventBus.on('TABLE', 'FIELD_UPDATED', (data) => {
            if (data.row === this.row && data.fieldName === this.field.name) {

                if (data.initiator === 'input' && td.classList.contains('is-editing')) {
                    return;
                }
                if (td.classList.contains('is-editing')) {
                    td._discardEdit = true;
                    td.classList.remove('is-editing');
                }
                this.renderDisplay(td);
            } else if (this.field.reference && data.row && data.row.table && data.row.table.name === this.field.reference) {
                if (!td.classList.contains('is-editing')) {
                    this.renderDisplay(td);
                }
            }
        });

        eventBus.on('UI', 'CELL_REVERTED', (data) => {
            if (data.row === this.row && data.fieldName === this.field.name) {
                if (td.classList.contains('is-editing')) {
                    td._discardEdit = true;
                    td.classList.remove('is-editing');
                }
                this.renderDisplay(td);
            } else if (this.field.reference && data.row && data.row.table && data.row.table.name === this.field.reference) {
                if (!td.classList.contains('is-editing')) {
                    this.renderDisplay(td);
                }
            }
        });

        return td;
    }

    renderDisplay(td) {
        const value = this.field.name ? this.row.getCellValue(this.field.name) : null;

        if (this.isJunctionField()) {
            const junctionTableName = this.field.reference;
            const junctionTable = this.row.table.dataLoader?.getTable(junctionTableName);

            let count = 0;
            let displayText = 'Keine Daten';

            if (junctionTable) {
                const sourceRefField = junctionTable.fields.find(f => f.reference === this.row.table.name);
                const otherRefField = junctionTable.fields.find(f => f.reference && f.reference !== this.row.table.name);

                if (sourceRefField) {
                    const filteredRows = (junctionTable.rows || []).filter(r => r.data[sourceRefField.name] === this.row.id);
                    count = filteredRows.length;

                    if (count > 0) {
                        const firstRow = filteredRows[0];
                        const firstLabel = firstRow.getLabel();

                        if (count === 1) {
                            displayText = firstLabel;
                        } else {
                            displayText = `${firstLabel} (+${count - 1})`;
                        }
                    }
                }
            }

            td.innerHTML = `
                <div class="junction-chip" title="Klicken, um relationen zu bearbeiten">
                    <span class="junction-label">${displayText}</span>
                </div>
            `;
            return;
        }



        if (this.isBooleanType()) {
            td.textContent = (value === true || value === 'true' || value === 1) ? 'True' : 'False';

        } else if (this.isKeyType() && this.field.referenceData) {
            const rawVal = value !== null && value !== undefined ? String(value) : '';
            if (rawVal.trim() !== '') {

                const selectedIds = rawVal.split(',').map(s => s.trim());
                const count = selectedIds.length;
                const firstId = selectedIds[0];

                const matchedRef = this.field.referenceData.find(ref => String(ref.id) === String(firstId));
                let displayText = '';

                if (matchedRef) {
                    const firstLabel = matchedRef.label || matchedRef.name || matchedRef.id;
                    displayText = count === 1 ? firstLabel : `${firstLabel} (+${count - 1})`;
                } else {
                    displayText = count === 1 ? firstId : `${firstId} (+${count - 1})`;
                }

                td.innerHTML = `
                    <div class="junction-chip" title="Ausgewählte IDs: ${selectedIds.join(',')}">
                        <span class="junction-label">${displayText}</span>
                    </div>
                `;
            } else {
                td.textContent = '';
            }

        } else if (this.field.referenceData && this.field.referenceData.length > 0) {
            const rawVal = value !== null && value !== undefined ? String(value) : '';
            if (rawVal.trim() !== '') {

                const matchedRef = this.field.referenceData.find(ref => String(ref.id) === rawVal);
                if (matchedRef) {
                    td.textContent = matchedRef.textValue !== undefined ? matchedRef.textValue : (matchedRef.label || rawVal);
                } else {
                    td.textContent = rawVal;
                }
            } else {
                const refTableName = this.field.reference;
                const refTable = this.row.table.dataLoader?.getTable(refTableName);

                if (refTable) {
                    const sourceRefField = refTable.fields.find(f => f.reference === this.row.table.name);
                    if (sourceRefField) {
                        const filteredRows = (refTable.rows || []).filter(r => r.data[sourceRefField.name] === this.row.id);
                        if (filteredRows.length > 0) {
                            const fieldName = this.field.name;
                            const texts = filteredRows.map(r => {
                                if (fieldName) {
                                    return r.data[fieldName] !== undefined && r.data[fieldName] !== null ? r.data[fieldName] : '';
                                } else {
                                    return r.getLabel();
                                }
                            }).filter(t => t !== undefined && t !== null && t !== '');

                            td.textContent = texts.join(', ');
                            return;
                        }
                    }
                }

                td.textContent = '';
            }
        } else {
            td.textContent = value !== undefined && value !== null ? value : '';
        }
    }

    toggleBoolean(td) {
        const currentValue = this.row.getCellValue(this.field.name);
        const isCurrentlyTrue = currentValue === true || currentValue === 'true' || currentValue === 1;

        this.row.updateValue(this.field.name, !isCurrentlyTrue);
        this.renderDisplay(td);
    }

    handleEdit(td) {

        const baseUrl = import.meta.env.BASE_URL;
        const targetName = this.row.table.titel || this.row.table.name;
        const newUrl = `${baseUrl}${encodeURIComponent(targetName)}@${encodeURIComponent(this.row.id)}#${encodeURIComponent(this.field.name)}`;
        window.history.replaceState(window.history.state, '', newUrl);


        if (td.classList.contains('is-editing')) return;

        if (this.isJunctionField()) {
            import('../../Widgets/Modal/RelationModal.js').then(module => {
                const modal = new module.RelationModal(this.field, this.row, td);
                modal.open();
            });

            return;
        }

        if (this.isKeyType()) {
            import('../../Widgets/Modal/KeyModal.js').then(module => {
                const modal = new module.KeyModal(this.field, this.row, td);
                modal.open();
            });
            return;
        }

        td.classList.add('is-editing');
        let currentValue = this.row.getCellValue(this.field.name);
        const currentText = td.textContent;
        td.innerHTML = ``;

        let isReverseLookup = false;
        let reverseRows = [];
        let targetFieldName = this.field.name;

        if ((currentValue === null || currentValue === undefined || currentValue === '') && this.field.reference) {
            const refTableName = this.field.reference;
            const refTable = this.row.table.dataLoader?.getTable(refTableName);

            if (refTable) {
                const sourceRefField = refTable.fields.find(f => f.reference === this.row.table.name);

                if (sourceRefField) {
                    reverseRows = (refTable.rows || []).filter(r => r.data[sourceRefField.name] === this.row.id);

                    if (reverseRows.length > 0) {
                        isReverseLookup = true;
                        currentValue = reverseRows[0].data[targetFieldName] || '';
                    }
                }
            }
        }

        const placeholder = document.createElement('span');
        placeholder.textContent = currentText;
        placeholder.classList.add('field-placeholder-hidden');
        td.appendChild(placeholder);

        const editor = this.createEditorElement(currentValue);

        editor.addEventListener('input', () => {
            if (isReverseLookup && reverseRows.length > 0) {
                reverseRows.forEach(r => r.updateValue(targetFieldName, editor.value));
            } else {
                this.row.updateValue(this.field.name, editor.value);
            }
        });

        const save = () => {
            if (td._discardEdit) {
                delete td._discardEdit;
                return;
            }
            const newValue = editor.value;

            if (isReverseLookup && reverseRows.length > 0) {
                reverseRows.forEach(r => r.updateValue(targetFieldName, newValue));
            } else {
                this.row.updateValue(this.field.name, newValue);
            }

            td.classList.remove('is-editing');
            this.renderDisplay(td);
        };

        const cancel = () => {
            td._discardEdit = true;
            td.classList.remove('is-editing');
            this.renderDisplay(td);
        };

        editor.addEventListener('blur', save);
        editor.addEventListener('keydown', (e) => {

            if (e.key === 'Enter' && editor.tagName !== 'TEXTAREA') {
                e.preventDefault();
                save();
                TableNavigator.navigateFrom(td, 'ArrowDown', false);
                return;
            }

            if (e.key === 'Escape') {
                cancel();
                return;
            }

            const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'PageUp', 'PageDown'].includes(e.key);

            if (isNavKey) {

                if (editor.tagName === 'INPUT' && editor.type === 'text') {

                    if (e.key === 'ArrowLeft' && editor.selectionStart > 0) return;
                    if (e.key === 'ArrowRight' && editor.selectionEnd < editor.value.length) return;
                }

                if (editor.tagName === 'SELECT' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    return;
                }

                if (editor.tagName === 'INPUT' && editor.type === 'number' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    return;
                }

                e.preventDefault();

                save();

                TableNavigator.navigateFrom(td, e.key, e.shiftKey);
            }
        });
        td.appendChild(editor);
        editor.focus();
    }

    createEditorElement(currentValue) {
        const type = this.field.type ? this.field.type.toLowerCase() : 'text';

        if (type.includes('enum')) {
            const select = document.createElement('select');
            select.classList.add('field-editor', 'editor-enum');

            const options = this.field.enumValues || [currentValue];

            options.forEach(opt => {
                const optionEl = document.createElement('option');
                optionEl.value = opt;
                optionEl.textContent = opt;
                if (opt == currentValue) optionEl.selected = true;
                select.appendChild(optionEl);
            });
            return select;
        }

        if (this.isKeyType()) {
            const select = document.createElement('select');
            select.classList.add('field-editor', 'editor-key');

            const refData = this.field.referenceData || [];
            const defaultOpt = document.createElement('option');

            defaultOpt.value = '';
            defaultOpt.textContent = 'Select...';

            select.appendChild(defaultOpt);

            refData.forEach(item => {
                const optionEl = document.createElement('option');

                optionEl.value = item.id;
                optionEl.textContent = item.label;

                if (item.id == currentValue) optionEl.selected = true;
                select.appendChild(optionEl);
            });
            return select;
        }

        const input = document.createElement('input');
        input.size = 1;

        if (type.includes('number')) {
            input.type = 'number';
            input.classList.add('field-editor', 'editor-number');
        } else if (type.includes('date')) {
            input.type = 'date';
            input.classList.add('field-editor', 'editor-date');
        } else {
            input.type = 'text';
            input.classList.add('field-editor', 'editor-text');
        }

        input.value = currentValue || '';

        return input;
    }


    isJunctionField() {
        const type = this.field.type ? String(this.field.type).toLowerCase() : '';
        return type.includes('junction');
    }
    isBooleanType() {
        const type = this.field.type ? this.field.type.toLowerCase() : '';
        return type.includes('boolean');
    }
    isKeyType() {
        const type = this.field.type ? String(this.field.type).toLowerCase() : '';

        if (type.includes('text') || type.includes('number') || type.includes('date') || type.includes('enum') || type.includes('junction')) {
            return false;
        }

        return type.includes('key') || type.includes('fk') || type.includes('uuid') || this.field.reference != null;
    }
}
