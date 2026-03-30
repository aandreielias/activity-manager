import { TextField } from './TextField.js';

export class LinkField extends TextField {
    onClick(e) {
        if (this.td.classList.contains('editing')) return;
        
        const val = this.getRawValue();
        if (val && val !== '—') {
            window.open(val, '_blank');
            return;
        }

        super.onClick(e);
    }
}
