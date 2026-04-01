import { EnumField } from './EnumField.js';

export class StatusField extends EnumField {
    updateDisplay() {
        if (!this.contentWrap) return;
        this.contentWrap.innerHTML = '';
        
        const value = this.getRawValue();
        if (!value || value === '—') {
            this.contentWrap.textContent = '—';
            return;
        }

        const tag = document.createElement('span');
        tag.className = `inventory-tag status-${value.toLowerCase()}`;
        tag.textContent = value;
        this.contentWrap.appendChild(tag);
        
        if (this.td) {
            this.td.classList.remove('status-cell-aktiv', 'status-cell-inaktiv');
            const lowerVal = value.toLowerCase();
            if (lowerVal === 'aktiv' || lowerVal === 'inaktiv') {
                this.td.classList.add(`status-cell-${lowerVal}`);
            }
        }
    }
}
