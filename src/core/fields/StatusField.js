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
        const sanitizedValue = value.toLowerCase().replace(/\s+/g, '-');
        tag.className = `inventory-tag status-${sanitizedValue}`;
        tag.textContent = value;
        this.contentWrap.appendChild(tag);
        
        if (this.td) {
            // Clear existing status-cell classes
            this.td.classList.forEach(cls => {
                if (cls.startsWith('status-cell-')) this.td.classList.remove(cls);
            });
            const sanitizedValue = value.toLowerCase().replace(/\s+/g, '-');
            this.td.classList.add(`status-cell-${sanitizedValue}`);
        }
    }
}
