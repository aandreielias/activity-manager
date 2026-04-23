import { TextField } from './TextField.js';
import { NumberField } from './NumberField.js';
import { EnumField } from './EnumField.js';
import { PersonField } from './PersonField.js';
import { StatusField } from './StatusField.js';
import { LinkField } from './LinkField.js';
import { InventoryField } from './InventoryField.js';
import { TagField } from './TagField.js';
import { EventGamesField } from './EventGamesField.js';

import { DateField } from './DateField.js';
import { TimeField } from './TimeField.js';
import { LocationField } from './LocationField.js';

import { ConditionField } from './ConditionField.js';

export class FieldFactory {
    static fields = {
        number: NumberField,
        enum: EnumField,
        tag: TagField,
        text: TextField,
        date: DateField
    };

    static createField(params) {
        const { colDef, tableId } = params;
        const ui = colDef.ui_component;

        // 1. Priority: Metadata UI Component (The dynamic way)
        if (ui) {
            switch (ui) {
                case 'location': return new LocationField(params);
                case 'person':
                case 'responsible':
                    return new PersonField(params);
                case 'inventory':
                case 'required_items':
                    return new InventoryField(params);
                case 'tags':
                case 'tag':
                    return new TagField(params);
                case 'status': return new StatusField(params);
                case 'link': return new LinkField(params);
                case 'time': return new TimeField(params);
                case 'date': return new DateField(params);
                case 'number': return new NumberField(params);
                case 'enum': return new EnumField(params);
                case 'condition': return new ConditionField(params);
                case 'event_games': return new EventGamesField(params);
            }
        }

        // 2. Secondary: Hardcoded Fallbacks (For backward compatibility)
        switch (colDef.id) {
            case 'condition':
            case 'zustand':
                return new ConditionField(params);
            case 'location':
            case 'address':
            case 'storage_location':
            case 'st_id':
            case 'ak_st_id':
            case 'ev_st_id':
                // Only return LocationField if not explicitly set to enum in metadata
                if (ui === 'enum') return new EnumField(params);
                return new LocationField(params);
            case 'reihenfolge':
            case 'games':
                if (tableId === 'tbl_events') return new EventGamesField(params);
                break;
            case 'responsible':
            case 'pe_id':
                return new PersonField(params);
            case 'Status':
            case 'status':
                return new StatusField(params);
            case 'link':
                return new LinkField(params);
            case 'required_items':
                return new InventoryField(params);
            case 'Team':
            case 'kategorie':
            case 'pe_verantwortlich_fuer':
                return new TagField(params);
            case 'time':
                return new TimeField(params);
            case 'date':
                return new DateField(params);
        }

        // 3. Tertiary: Type-based Fallbacks
        switch (colDef.type) {
            case 'number': return new NumberField(params);
            case 'enum': return new EnumField(params);
            case 'tag':
            case 'tags': return new TagField(params);
            case 'date': return new DateField(params);
            case 'time': return new TimeField(params);
            default: return new TextField(params);
        }
    }
}
