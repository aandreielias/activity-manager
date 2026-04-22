import { EnumField } from './EnumField.js';
import { Tooltip } from '../../ui/Tooltip.js';
import { TooltipGenerator } from '../../utils/TooltipGenerator.js';

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

    render() {
        const td = super.render();
        const value = this.getRawValue();
        
        if (value !== '—' && this.peopleData) {
            const person = this.peopleData.find(p => p.id === value);
            if (person) {
                const html = TooltipGenerator.generatePersonTooltip(person);
                const condition = () => !td.classList.contains('editing');
                Tooltip.attach(td, html, 400, condition);
                td.style.cursor = 'pointer';
            }
        }
        
        return td;
    }
}
