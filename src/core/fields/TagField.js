import { Field } from './Field.js';
import { GlobalStateManager } from '../GlobalStateManager.js';
import { ColourFactory } from '../../utils/ColourFactory.js';

export class TagField extends Field {
    updateDisplay() {
        if (!this.contentWrap) return;
        this.contentWrap.innerHTML = '';

        let rawValue = this.getRawValue();
        if (rawValue === '—' || !rawValue || (Array.isArray(rawValue) && rawValue.length === 0)) {
            this.contentWrap.textContent = '—';
            return;
        }

        // Handle both comma-separated strings and real arrays
        const tags = Array.isArray(rawValue) ? rawValue : rawValue.split(',').map(t => t.trim()).filter(t => t);
        const gs = GlobalStateManager.getInstance();
        const isTeam = this.colDef.id === 'Team';
        const isResp = this.colDef.id === 'Verantwortlich für' || this.colDef.id === 'pe_verantwortlich_fuer';
        const teamColors = isTeam ? gs.getAvailableTeams() : [];

        tags.forEach(val => {
            const tag = document.createElement('span');
            tag.className = 'inventory-tag available';
            
            // Resolve ID to Title if it's a responsibility
            let displayText = val;
            if (isResp) {
                const config = gs.getTableConfig(val);
                if (config) displayText = config.t_titel || config.t_id;
            }
            tag.textContent = displayText;
            
            if (isTeam) {
                const match = teamColors.find(tc => tc.name === val);
                if (match) {
                    tag.style.backgroundColor = match.color;
                } else {
                    tag.style.backgroundColor = ColourFactory.getColorForString(val);
                }
            } else {
                tag.style.backgroundColor = ColourFactory.getColorForString(val);
            }
            
            tag.style.color = '#fff';
            tag.style.borderColor = 'transparent';
            
            this.contentWrap.appendChild(tag);
        });
    }

    startEditing() {
        this.onEditStart?.();
        this._showPicker();
    }

    async _showPicker() {
        let rawValue = this.getRawValue();
        const currentTags = (Array.isArray(rawValue)) 
            ? [...rawValue] 
            : (rawValue === '—' || !rawValue ? [] : rawValue.split(',').map(t => t.trim()).filter(t => t));

        const globalState = GlobalStateManager.getInstance();
        let availableTags = this.colDef.availableTags || [];
        const isResp = this.colDef.id === 'pe_verantwortlich_fuer' || this.colDef.id === 'Verantwortlich für';

        if (availableTags.length === 0) {
            if (isResp) {
                availableTags = globalState.getAvailableTablesForPerson(this.rowData).map(t => ({
                    name: t.t_titel || t.t_id,
                    id: t.t_id
                }));
            } else {
                const globalEnums = globalState.getEnumOptionsForColumn(this.colDef.id, this.tableId);
                if (globalEnums) availableTags = globalEnums;
                else if (this.colDef.id === 'Team') availableTags = globalState.getAvailableTeams();
            }
        }

        const rect = this.td.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownMaxHeight = 450;
        const showUpwards = spaceBelow < 250 && spaceAbove > spaceBelow;

        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.zIndex = '1000';

        const dropdown = document.createElement('div');
        dropdown.className = 'multi-select-dropdown';
        dropdown.style.position = 'absolute';
        
        if (showUpwards) {
            dropdown.style.bottom = `${window.innerHeight - (rect.top + window.scrollY)}px`;
        } else {
            dropdown.style.top = `${rect.bottom + window.scrollY}px`;
        }
        
        dropdown.style.left = `${rect.left + window.scrollX}px`;
        dropdown.style.minWidth = `280px`;
        dropdown.style.maxHeight = `${dropdownMaxHeight}px`;
        dropdown.style.overflowY = 'auto';
        dropdown.style.backgroundColor = '#fff';
        dropdown.style.border = '1px solid #ddd';
        dropdown.style.borderRadius = '12px';
        dropdown.style.boxShadow = '0 15px 35px rgba(0,0,0,0.15)';
        dropdown.style.padding = '8px 0';
        dropdown.style.zIndex = '1001';

        let internalSelected = [...currentTags];

        const renderOptions = () => {
            dropdown.innerHTML = '';
            
            if (availableTags.length === 0) {
                const empty = document.createElement('div');
                empty.style.padding = '12px 16px';
                empty.style.color = '#999';
                empty.style.fontSize = '14px';
                empty.textContent = 'Keine Optionen verfügbar';
                dropdown.appendChild(empty);
                return;
            }

            // Grouping logic for the dropdown display
            const gs = GlobalStateManager.getInstance();
            const isResp = this.colDef.id === 'pe_verantwortlich_fuer' || this.colDef.id === 'Verantwortlich für';
            let processedGroups = [];
            
            if (isResp) {
                const mapping = gs.getTeamTableMappings();
                const personTeamIds = this.rowData.teamIds || [];
                
                processedGroups = mapping.filter(group => {
                    return (group.tt_tm_id && personTeamIds.includes(group.tt_tm_id)) || 
                           (this.rowData.Team || '').toLowerCase().includes((group.tt_name || '').toLowerCase());
                });
            }

            // Fallback for simple tags (like Team selection) or if no groups found
            if (processedGroups.length === 0 && availableTags.length > 0) {
                const isTeam = this.colDef.id === 'Team';
                processedGroups.push({ 
                    tt_titel: '', 
                    tables: availableTags.map(t => {
                        const name = typeof t === 'object' ? t.name : t;
                        const id = typeof t === 'object' ? (t.id || t.name) : t;
                        return {
                            t_id: isTeam ? name : id, // Use name for Team column, ID for others
                            t_titel: name,
                            name: name
                        };
                    })
                });
            }

            processedGroups.forEach((group, gIdx) => {
                // Divider only ONCE between groups
                if (gIdx > 0) {
                    const divider = document.createElement('div');
                    divider.style.height = '1px';
                    divider.style.background = '#eee';
                    divider.style.margin = '8px 0';
                    dropdown.appendChild(divider);
                }

                group.tables.forEach((table) => {
                    const text = table.t_titel || table.t_id || table.name;
                    const value = table.t_id || table.id || table.name;
                    const isSelected = internalSelected.includes(value);
                    const groupLabel = group.tt_titel || group.tt_name || '';

                    const item = document.createElement('div');
                    item.style.padding = '6px 12px'; // Smaller spacing
                    item.style.cursor = 'pointer';
                    item.style.fontSize = '12.5px'; // Smaller text
                    item.style.display = 'flex';
                    item.style.justifyContent = 'space-between';
                    item.style.alignItems = 'center';
                    item.style.gap = '10px';
                    item.style.transition = 'all 0.1s ease';
                    
                    item.style.color = isSelected ? '#007bff' : '#444';
                    item.style.fontWeight = isSelected ? '600' : '400';
                    item.style.backgroundColor = isSelected ? 'rgba(0,123,255,0.06)' : 'transparent';

                    // Label on the left, Group on the right (more visible now)
                    item.innerHTML = `
                        <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${text}</span>
                        <span style="font-size: 10px; color: #999; font-weight: 400; text-transform: uppercase; letter-spacing: 0.3px;">${groupLabel}</span>
                        ${isSelected ? '<span style="font-size: 10px; color: #007bff; margin-left: 2px;">●</span>' : ''}
                    `;

                    item.onmouseenter = () => { 
                        item.style.backgroundColor = isSelected ? 'rgba(0,123,255,0.1)' : '#f8f9fa'; 
                    };
                    item.onmouseleave = () => { 
                        item.style.backgroundColor = isSelected ? 'rgba(0,123,255,0.06)' : 'transparent'; 
                    };

                    item.onclick = (e) => {
                        e.stopPropagation();
                        if (isSelected) {
                            internalSelected = internalSelected.filter(v => v !== value);
                        } else {
                            internalSelected.push(value);
                        }
                        renderOptions();
                        
                        this.onChange?.(this.colDef.id, internalSelected);
                        this.value = internalSelected;
                        this.updateDisplay();
                    };

                    dropdown.appendChild(item);
                });
            });
        };

        renderOptions();
        overlay.appendChild(dropdown);
        document.body.appendChild(overlay);

        const close = () => {
            overlay.remove();
            document.removeEventListener('keydown', onEsc);
        };

        const onEsc = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onEsc);
        overlay.onclick = close;
    }
}
