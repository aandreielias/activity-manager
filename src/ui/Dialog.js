import '../styles/Dialog.css';

export class Dialog {
    static async confirm({ message, confirmText = 'Bestätigen', confirmStyle = 'warning' }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'custom-dialog';

            const msgSpan = document.createElement('span');
            msgSpan.className = 'unsaved-msg';
            msgSpan.textContent = message;

            // Using the exact styles from the unsaved-banner for the popup
            const confirmBtn = document.createElement('button');
            confirmBtn.className = confirmStyle === 'warning' ? 'discard-btn-header' : 'save-btn-header';
            confirmBtn.textContent = confirmText;

            const cancelBtn = document.createElement('button');
            // If primary action is warning (discard/delete), make cancel neutral/success.
            // To stick strictly to "same style as the save changes banner", we reuse its button classes.
            cancelBtn.className = confirmStyle === 'warning' ? 'save-btn-header' : 'discard-btn-header';
            cancelBtn.textContent = 'Abbrechen';
            
            // Ensure focus is trapped / managed
            const cleanup = () => {
                overlay.remove();
                document.removeEventListener('keydown', onKeydown);
            };

            const onKeydown = (e) => {
                if (e.key === 'Enter') {
                    cleanup();
                    resolve(true);
                }
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                }
            };

            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            document.addEventListener('keydown', onKeydown);

            dialog.appendChild(msgSpan);
            // Swapping order. Usually "Cancel" is left or right depending on OS. Let's put Cancel then Confirm.
            dialog.appendChild(cancelBtn);
            dialog.appendChild(confirmBtn);
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            // Focus cancel by default for destructive actions, or confirm for positive actions
            if (confirmStyle === 'warning') {
                cancelBtn.focus();
            } else {
                confirmBtn.focus();
            }
        });
    }

    static async prompt({ message, confirmText = 'Speichern', type = 'text', placeholder = '' }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'custom-dialog prompt-dialog';

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
            
            const cleanup = () => {
                overlay.remove();
                document.removeEventListener('keydown', onKeydown);
            };

            const onKeydown = (e) => {
                if (e.key === 'Enter') {
                    cleanup();
                    resolve(input.value);
                }
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                }
            };

            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(input.value);
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });

            document.addEventListener('keydown', onKeydown);

            dialog.appendChild(msgSpan);
            dialog.appendChild(input);
            dialog.appendChild(cancelBtn);
            dialog.appendChild(confirmBtn);
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            setTimeout(() => input.focus(), 50);
        });
    }

    static async alert({ message, title = 'Info' }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'custom-dialog';

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
            
            const cleanup = () => {
                overlay.remove();
                document.removeEventListener('keydown', onKeydown);
            };

            const onKeydown = (e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    cleanup();
                    resolve();
                }
            };

            okBtn.addEventListener('click', () => {
                cleanup();
                resolve();
            });

            document.addEventListener('keydown', onKeydown);

            dialog.appendChild(titleEl);
            dialog.appendChild(msgSpan);
            dialog.appendChild(okBtn);
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            okBtn.focus();
        });
    }

    static async showAddColumnDialog(tableId, availableEnums = []) {
        console.log(`[Dialog] showAddColumnDialog ${tableId}`, availableEnums);
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay';
            overlay.style.zIndex = '10000';

            const dialog = document.createElement('div');
            dialog.className = 'custom-dialog';
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

            const cleanup = () => overlay.remove();

            cancelBtn.onclick = () => { cleanup(); resolve(null); };
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

                cleanup();
                resolve(result);
            };

            actions.appendChild(cancelBtn);
            actions.appendChild(confirmBtn);
            dialog.appendChild(actions);

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            setTimeout(() => nameInput.focus(), 50);
        });
    }
}
