import { EnumField } from './EnumField.js';

export class PersonField extends EnumField {
    getDisplayValue() {
        let value = this.getRawValue();
        if (value !== '—' && this.peopleData) {
            const person = this.peopleData.find(p => p.id === value);
            if (person) {
                return person.vorname;
            }
        }
        return value;
    }
}
