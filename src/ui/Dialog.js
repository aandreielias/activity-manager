import '../styles/Dialog.css';
import { BaseDialog } from './BaseDialog.js';

export class Dialog {
    static async confirm({ message, confirmText = 'Bestätigen', confirmStyle = 'warning' }) {
        return BaseDialog.show({
            onEscapeValue: false,
            render: (dialog, overlay, resolve, cleanup) => {
                const msgSpan = document.createElement('span');
                msgSpan.className = 'unsaved-msg';
                msgSpan.textContent = message;

                const confirmBtn = document.createElement('button');
                confirmBtn.className = confirmStyle === 'warning' ? 'discard-btn-header' : 'save-btn-header';
                confirmBtn.textContent = confirmText;

                const cancelBtn = document.createElement('button');
                cancelBtn.className = confirmStyle === 'warning' ? 'save-btn-header' : 'discard-btn-header';
                cancelBtn.textContent = 'Abbrechen';

                confirmBtn.addEventListener('click', () => resolve(true));
                cancelBtn.addEventListener('click', () => resolve(false));

                dialog.appendChild(msgSpan);
                dialog.appendChild(cancelBtn);
                dialog.appendChild(confirmBtn);

                if (confirmStyle === 'warning') {
                    cancelBtn.focus();
                } else {
                    confirmBtn.focus();
                }
            },
            onKeydown: (e, dialog, overlay, resolve) => {
                if (e.key === 'Enter') resolve(true);
            }
        });
    }

    static async prompt({ message, confirmText = 'Speichern', type = 'text', placeholder = '' }) {
        return BaseDialog.show({
            dialogClassName: 'custom-dialog prompt-dialog',
            onEscapeValue: null,
            render: (dialog, overlay, resolve, cleanup) => {
                const msgSpan = document.createElement('div');
                msgSpan.className = 'unsaved-msg';
                msgSpan.textContent = message;
                msgSpan.style.marginBottom = '12px';

                const input = document.createElement('input');
                input.type = type;
                input.placeholder = placeholder;
                input.className = 'dialog-input';
                input.style.display = 'block';
                input.style.width = '100%';
                input.style.marginBottom = '16px';

                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'save-btn-header';
                confirmBtn.textContent = confirmText;

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'discard-btn-header';
                cancelBtn.textContent = 'Abbrechen';

                confirmBtn.addEventListener('click', () => resolve(input.value));
                cancelBtn.addEventListener('click', () => resolve(null));

                dialog.appendChild(msgSpan);
                dialog.appendChild(input);
                dialog.appendChild(cancelBtn);
                dialog.appendChild(confirmBtn);

                setTimeout(() => input.focus(), 50);
            },
            onKeydown: (e, dialog, overlay, resolve) => {
                if (e.key === 'Enter') resolve(dialog.querySelector('input').value);
            }
        });
    }

    static async alert({ message, title = 'Info' }) {
        return BaseDialog.show({
            onEscapeValue: undefined,
            render: (dialog, overlay, resolve, cleanup) => {
                const titleEl = document.createElement('div');
                titleEl.className = 'unsaved-msg';
                titleEl.style.fontWeight = '700';
                titleEl.style.marginBottom = '8px';
                titleEl.textContent = title;

                const msgSpan = document.createElement('div');
                msgSpan.className = 'unsaved-msg';
                msgSpan.innerHTML = message.replace(/\n/g, '<br>');
                msgSpan.style.marginBottom = '16px';
                msgSpan.style.fontSize = '13px';
                msgSpan.style.lineHeight = '1.5';

                const okBtn = document.createElement('button');
                okBtn.className = 'save-btn-header';
                okBtn.textContent = 'OK';
                okBtn.style.margin = '0 auto';
                okBtn.style.display = 'block';

                okBtn.addEventListener('click', () => resolve());

                dialog.appendChild(titleEl);
                dialog.appendChild(msgSpan);
                dialog.appendChild(okBtn);

                okBtn.focus();
            },
            onKeydown: (e, dialog, overlay, resolve) => {
                if (e.key === 'Enter') resolve();
            }
        });
    }

    static async showAddColumnDialog(tableId, availableEnums = []) {
        return BaseDialog.show({
            onEscapeValue: null,
            render: (dialog, overlay, resolve, cleanup) => {
                overlay.style.zIndex = '10000';

                dialog.style.flexDirection = 'column';
                dialog.style.width = '460px'; // Slightly wider for row layout
                dialog.style.alignItems = 'stretch';
                dialog.style.gap = '16px';

                const title = document.createElement('div');
                title.className = 'unsaved-msg';
                title.style.fontWeight = '700';
                title.style.marginBottom = '8px';
                title.textContent = 'Neue Spalte hinzufügen';
                dialog.appendChild(title);

                const createRow = (labelText, inputEl) => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.justifyContent = 'space-between';
                    row.style.gap = '16px';

                    const lbl = document.createElement('div');
                    lbl.className = 'unsaved-msg';
                    lbl.style.fontSize = '13px';
                    lbl.style.whiteSpace = 'nowrap';
                    lbl.textContent = labelText;

                    inputEl.style.width = '240px';
                    inputEl.style.marginBottom = '0'; // Override previous default

                    row.appendChild(lbl);
                    row.appendChild(inputEl);
                    return row;
                };

                // Name
                const nameInput = document.createElement('input');
                nameInput.className = 'dialog-input';
                dialog.appendChild(createRow('Name der Spalte:', nameInput));

                // Type
                const typeSelect = document.createElement('select');
                typeSelect.className = 'dialog-input';
                ['text', 'int', 'number', 'date', 'time', 'boolean', 'enum'].forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t;
                    opt.textContent = t;
                    typeSelect.appendChild(opt);
                });
                dialog.appendChild(createRow('Datentyp:', typeSelect));

                // --- Enum Section ---
                const enumSelectionRowWrap = document.createElement('div');
                enumSelectionRowWrap.style.display = 'none';
                const enumSelect = document.createElement('select');
                enumSelect.className = 'dialog-input';

                const populateEnums = () => {
                    enumSelect.innerHTML = '';
                    const baseOpt = document.createElement('option');
                    baseOpt.value = '';
                    baseOpt.textContent = '-- Bestehenden Enum wählen --';
                    enumSelect.appendChild(baseOpt);

                    availableEnums.forEach(e => {
                        const opt = document.createElement('option');
                        opt.value = e;
                        opt.textContent = e;
                        enumSelect.appendChild(opt);
                    });

                    const newOpt = document.createElement('option');
                    newOpt.value = 'CREATE_NEW';
                    newOpt.textContent = '+ Neuen Enum erstellen...';
                    enumSelect.appendChild(newOpt);
                };
                populateEnums();
                enumSelectionRowWrap.appendChild(createRow('Welcher Enum?', enumSelect));
                dialog.appendChild(enumSelectionRowWrap);

                // New Enum Creation Section (Hidden initially)
                const newEnumInputs = document.createElement('div');
                newEnumInputs.style.display = 'none';
                newEnumInputs.style.flexDirection = 'column';
                newEnumInputs.style.gap = '12px';
                newEnumInputs.style.padding = '12px';
                newEnumInputs.style.background = 'var(--bg-secondary)';
                newEnumInputs.style.borderRadius = 'var(--radius-sm)';
                newEnumInputs.style.marginTop = '4px';

                const newEnumNameInput = document.createElement('input');
                newEnumNameInput.className = 'dialog-input';
                newEnumNameInput.placeholder = 'z.B. parkplatz_enum';
                newEnumInputs.appendChild(createRow('Enum-Name (DB):', newEnumNameInput));

                const newEnumOptionsInput = document.createElement('input');
                newEnumOptionsInput.className = 'dialog-input';
                newEnumOptionsInput.placeholder = 'Option A, Option B, ...';
                newEnumInputs.appendChild(createRow('Optionen:', newEnumOptionsInput));
                dialog.appendChild(newEnumInputs);

                typeSelect.onchange = () => {
                    const isEnum = typeSelect.value === 'enum';
                    enumSelectionRowWrap.style.display = isEnum ? 'block' : 'none';
                    if (!isEnum) newEnumInputs.style.display = 'none';
                };

                enumSelect.onchange = () => {
                    newEnumInputs.style.display = enumSelect.value === 'CREATE_NEW' ? 'flex' : 'none';
                };

                const actions = document.createElement('div');
                actions.style.display = 'flex';
                actions.style.justifyContent = 'flex-end';
                actions.style.gap = '12px';
                actions.style.marginTop = '8px';

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'discard-btn-header';
                cancelBtn.textContent = 'Abbrechen';

                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'save-btn-header';
                confirmBtn.textContent = 'Hinzufügen';

                cancelBtn.onclick = () => { resolve(null); };
                confirmBtn.onclick = () => {
                    const nameValue = nameInput.value.trim();
                    const typeValue = typeSelect.value;
                    if (!nameValue) return; // Flash handled by caller or simple return

                    let result = { name: nameValue, type: typeValue };

                    if (typeValue === 'enum') {
                        if (enumSelect.value === 'CREATE_NEW') {
                            const newName = newEnumNameInput.value.trim();
                            const options = newEnumOptionsInput.value.split(',').map(o => o.trim()).filter(o => o);
                            if (!newName || options.length === 0) return alert('Name und Optionen für neuen Enum erforderlich');
                            result.newEnum = { name: newName, options };
                            result.type = newName;
                        } else if (enumSelect.value) {
                            result.type = enumSelect.value;
                        } else {
                            return alert('Bitte einen Enum wählen');
                        }
                    }

                    resolve(result);
                };

                actions.appendChild(cancelBtn);
                actions.appendChild(confirmBtn);
                dialog.appendChild(actions);

                setTimeout(() => nameInput.focus(), 50);
            }
        });
    }

    static async showConflictDialog(conflictCount) {
        return BaseDialog.show({
            onEscapeValue: 'cancel',
            render: (dialog, overlay, resolve, cleanup) => {
                const msgSpan = document.createElement('span');
                msgSpan.className = 'unsaved-msg';
                msgSpan.textContent = `${conflictCount} Zeile(n) wurden von einem anderen Benutzer bearbeitet.`;

                const overwriteBtn = document.createElement('button');
                overwriteBtn.className = 'discard-btn-header';
                overwriteBtn.textContent = 'Überschreiben';

                const reloadBtn = document.createElement('button');
                reloadBtn.className = 'save-btn-header';
                reloadBtn.textContent = 'Neu laden';

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'discard-btn-header';
                cancelBtn.textContent = 'Abbrechen';

                overwriteBtn.addEventListener('click', () => resolve('overwrite'));
                reloadBtn.addEventListener('click', () => resolve('reload'));
                cancelBtn.addEventListener('click', () => resolve('cancel'));

                dialog.appendChild(msgSpan);
                dialog.appendChild(cancelBtn);
                dialog.appendChild(reloadBtn);
                dialog.appendChild(overwriteBtn);

                reloadBtn.focus();
            },
            onKeydown: (e, dialog, overlay, resolve) => {
                if (e.key === 'Enter') resolve('reload');
            }
        });
    }
}
