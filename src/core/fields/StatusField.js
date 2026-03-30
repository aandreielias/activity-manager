import { EnumField } from './EnumField.js';

export class StatusField extends EnumField {
    updateDisplay() {
        super.updateDisplay();
        const value = this.getRawValue();
        
        // Remove both classes safely before appending the correct state
        if (this.td) {
            this.td.classList.remove('status-aktiv', 'status-inaktiv');
            if (value === 'aktiv' || value === 'inaktiv') {
                this.td.classList.add(`status-${value}`);
            }
        }
    }
}
