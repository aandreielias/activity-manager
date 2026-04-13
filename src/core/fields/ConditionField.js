import { EnumField } from './EnumField.js';

/**
 * ConditionField - Handles coloring for item conditions (Neu, Gut, Gebraucht, Defekt)
 */
export class ConditionField extends EnumField {
    updateDisplay() {
        if (!this.contentWrap) return;
        this.contentWrap.innerHTML = '';

        const value = this.getRawValue();
        if (!value || value === '—') {
            this.contentWrap.textContent = '—';
            return;
        }

        const tag = document.createElement('span');
        const lower = value.toLowerCase();
        
        let colorClass = 'status-neutral';
        if (lower === 'neu') colorClass = 'status-neu';
        else if (lower === 'einwandfrei') colorClass = 'status-einwandfrei';
        else if (lower === 'gut') colorClass = 'status-gut';
        else if (lower === 'gebraucht') colorClass = 'status-gebraucht';
        else if (lower === 'defekt') colorClass = 'status-defekt';

        tag.className = `inventory-tag condition-tag ${colorClass}`;
        // Ensure capitalized starting letter in display
        tag.textContent = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
        
        this.contentWrap.appendChild(tag);
    }
}
