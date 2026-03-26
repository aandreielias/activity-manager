export const FieldType = {

    TEXT:          'text',
    NUMBER:        'number',
    DATE:          'date',
    BOOLEAN:       'boolean',
    ENUM:          'enum',
    RELATION:      'relation',
    RELATION_MANY: 'relation[]',
};

export class Field {

    constructor({ id, label, type, accepts = [], options = [] }) {

        this.id      = id;
        this.label   = label;
        this.type    = type;
        this.accepts = accepts;
        this.options = options;
    }

    canAccept(otherField) {

        return this.type === otherField.type || this.accepts.includes(otherField.type);
    }
}