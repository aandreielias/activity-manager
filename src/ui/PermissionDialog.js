import '../styles/PermissionDialog.css';
import { GlobalStateManager } from '../core/GlobalStateManager.js';

export class PermissionDialog {
    static async show(peopleData, tableConfigs) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'permission-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'permission-dialog dialog-window';

            const title = document.createElement('h2');
            title.textContent = 'Berechtigungen verwalten';
            dialog.appendChild(title);

            const container = document.createElement('div');
            container.className = 'permission-container';
            dialog.appendChild(container);

            let permissionsMap = JSON.parse(localStorage.getItem('app_permissions_map') || '{}');

            peopleData.forEach(person => {
                const name = `${person.vorname || ''} ${person.nachname || ''}`.trim();
                const currentPerm = permissionsMap[name] || { type: 'except_people' };
                
                const personSection = document.createElement('div');
                personSection.className = 'person-permission-section';
                
                const headerRow = document.createElement('div');
                headerRow.className = 'person-permission-header';
                headerRow.style.display = 'flex';
                headerRow.style.justifyContent = 'space-between';
                headerRow.style.alignItems = 'center';
                headerRow.style.marginBottom = '12px';
                
                const personName = document.createElement('div');
                personName.className = 'person-name';
                personName.textContent = name;
                headerRow.appendChild(personName);

                const readonlyBtn = document.createElement('button');
                readonlyBtn.className = 'permission-readonly-toggle';
                readonlyBtn.textContent = 'Nur Lesen';
                readonlyBtn.type = 'button';
                
                let isReadonly = currentPerm.type === 'readonly';
                if (isReadonly) readonlyBtn.classList.add('active');
                headerRow.appendChild(readonlyBtn);
                personSection.appendChild(headerRow);

                const typeSelect = document.createElement('select');
                typeSelect.className = 'permission-type-select';
                // Dropdown is only visible if NOT readonly (or if we want it for specific viewing types)
                typeSelect.style.display = isReadonly ? 'none' : 'block';
                
                const options = [
                    { value: 'all', text: 'Alle Tabellen bearbeiten' },
                    { value: 'except_people', text: 'Alle außer Personen' },
                    { value: 'except_inventory', text: 'Alle außer Inventar' },
                    { value: 'except_people_inventory', text: 'Alle außer Personen und Inventar' },
                    { value: 'specific', text: 'Spezifische Tabellen...' }
                ];

                options.forEach(opt => {
                    const el = document.createElement('option');
                    el.value = opt.value;
                    el.textContent = opt.text;
                    typeSelect.appendChild(el);
                });

                typeSelect.value = (currentPerm.type === 'readonly' || currentPerm.type === 'specific') ? 'specific' : currentPerm.type;
                personSection.appendChild(typeSelect);

                const tablesWrapper = document.createElement('div');
                tablesWrapper.className = 'specific-tables-wrapper';
                // Grid is visible if readonly is active OR if dropdown is set to 'specific'
                const shouldShowGrid = isReadonly || typeSelect.value === 'specific';
                tablesWrapper.style.display = shouldShowGrid ? 'block' : 'none';
                
                const groups = {
                    'System / Split-Views': [
                        { id: 'people_table', label: 'Personen (Split-View)' },
                        { id: 'tbl_people', label: 'Personen (Haupt)' },
                        { id: 'tbl_inventory', label: 'Inventar' }
                    ],
                    'Spiele': tableConfigs.filter(t => t.category === 'spiele').map(t => ({ id: t.id, label: t.title })),
                    'Sportarten': tableConfigs.filter(t => t.category === 'sportarten').map(t => ({ id: t.id, label: t.title })),
                };

                Object.entries(groups).forEach(([groupName, groupTables]) => {
                    if (groupTables.length === 0) return;

                    const groupDiv = document.createElement('div');
                    groupDiv.className = 'permission-group';
                    
                    const groupTitle = document.createElement('div');
                    groupTitle.className = 'permission-group-title';
                    groupTitle.textContent = groupName;
                    groupDiv.appendChild(groupTitle);

                    const grid = document.createElement('div');
                    grid.className = 'permission-grid';

                    groupTables.forEach(table => {
                        const label = document.createElement('label');
                        label.className = 'table-checkbox-label';
                        
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = table.id;
                        checkbox.checked = (currentPerm.type === 'specific' || currentPerm.type === 'readonly') && Array.isArray(currentPerm.tables) && currentPerm.tables.includes(table.id);
                        
                        label.appendChild(checkbox);
                        label.appendChild(document.createTextNode(table.label));
                        grid.appendChild(label);
                    });

                    groupDiv.appendChild(grid);
                    tablesWrapper.appendChild(groupDiv);
                });

                personSection.appendChild(tablesWrapper);

                const updateVisibility = () => {
                    typeSelect.style.display = isReadonly ? 'none' : 'block';
                    tablesWrapper.style.display = (isReadonly || typeSelect.value === 'specific') ? 'block' : 'none';
                };

                readonlyBtn.addEventListener('click', () => {
                    isReadonly = !isReadonly;
                    readonlyBtn.classList.toggle('active', isReadonly);
                    updateVisibility();
                });

                typeSelect.addEventListener('change', updateVisibility);
                container.appendChild(personSection);
            });

            const footer = document.createElement('div');
            footer.className = 'dialog-footer';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'footer-btn cancel';
            cancelBtn.textContent = 'Abbrechen';
            cancelBtn.onclick = () => {
                document.body.removeChild(overlay);
                resolve(null);
            };

            const saveBtn = document.createElement('button');
            saveBtn.className = 'footer-btn save';
            saveBtn.textContent = 'Speichern';
            saveBtn.onclick = () => {
                const newMap = {};
                container.querySelectorAll('.person-permission-section').forEach(section => {
                    const name = section.querySelector('.person-name').textContent;
                    const isReadonly = section.querySelector('.permission-readonly-toggle').classList.contains('active');
                    let type = section.querySelector('.permission-type-select').value;
                    const tables = [];
                    
                    if (isReadonly) {
                        type = 'readonly';
                        section.querySelectorAll('.permission-grid input[type="checkbox"]:checked').forEach(cb => {
                            tables.push(cb.value);
                        });
                    } else if (type === 'specific') {
                        section.querySelectorAll('.permission-grid input[type="checkbox"]:checked').forEach(cb => {
                            tables.push(cb.value);
                        });
                    }

                    newMap[name] = { type, tables };
                });
                
                localStorage.setItem('app_permissions_map', JSON.stringify(newMap));
                const currentUser = GlobalStateManager.getInstance().getCurrentUser();
                if (newMap[currentUser]) GlobalStateManager.getInstance().setPermissions(newMap[currentUser]);
                
                // Reload to apply all new visibility and edit restrictions globally
                window.location.reload();
                
                document.body.removeChild(overlay);
                resolve(newMap);
            };

            footer.appendChild(cancelBtn);
            footer.appendChild(saveBtn);
            dialog.appendChild(footer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
        });
    }
}
