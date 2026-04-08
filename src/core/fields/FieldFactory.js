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

        // Handle specific known columns that require customized logic
        switch (colDef.id) {
        case 'location':
            if (tableId === 'tbl_events') {
                return new LocationField(params);
            }
            break;
        case 'games':
            if (tableId === 'tbl_events') {
                return new EventGamesField(params);
            }
            break;
        case 'address':
            if (tableId.startsWith('tbl_sport_')) {
                return new LocationField(params);
            }
            break;
        case 'responsible':
            return new PersonField(params);
        case 'Status':
        case 'status':
            return new StatusField(params);
        case 'link':
            return new LinkField(params);
        case 'required_items':
            return new InventoryField(params);
        case 'Team':
            return new TagField(params);
        }

        // Fallback to general data structures
        switch (colDef.type) {
        case 'number':
            return new NumberField(params);
        case 'enum':
            return new EnumField(params);
        case 'tag':
            return new TagField(params);
        case 'date':
            return new DateField(params);
        case 'time':
            return new TimeField(params);
        default:
            return new TextField(params);
        }
    }
}
