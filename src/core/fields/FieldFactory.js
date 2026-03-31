import { TextField } from './TextField.js';
import { NumberField } from './NumberField.js';
import { EnumField } from './EnumField.js';
import { PersonField } from './PersonField.js';
import { StatusField } from './StatusField.js';
import { LinkField } from './LinkField.js';
import { InventoryField } from './InventoryField.js';

export class FieldFactory {
    static createField(config) {
        const { colDef } = config;
        
        // Handle specific known columns that require customized logic
        switch (colDef.id) {
            case 'responsible':
                return new PersonField(config);
            case 'Status':
                return new StatusField(config);
            case 'link':
                return new LinkField(config);
            case 'required_items':
                return new InventoryField(config);
        }

        // Fallback to general data structures
        switch (colDef.type) {
            case 'number':
                return new NumberField(config);
            case 'enum':
                return new EnumField(config);
            default:
                return new TextField(config);
        }
    }
}
