import { Field } from './Field.js';

export class DateField extends Field {
    getDisplayValue() {
        if (!this.value) return '—';
        try {
            const date = new Date(this.value);
            if (isNaN(date.getTime())) return this.value;
            
            // If the row has a separate time column, hide time here to avoid redundancy
            const hasSeparateTime = this.rowData && (this.rowData.time !== undefined || this.rowData.uhrzeit !== undefined);
            
            const options = {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            };
            
            if (!hasSeparateTime) {
                options.hour = '2-digit';
                options.minute = '2-digit';
                options.hour12 = false;
            }
            
            return date.toLocaleString('de-DE', options);
        } catch (e) {
            return this.value;
        }
    }

    createEditor() {
        const wrapper = document.createElement('div');
        wrapper.className = 'date-editor-wrapper';
        wrapper.style.display = 'flex';
        wrapper.style.gap = '4px';
        wrapper.style.alignItems = 'center';

        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.className = 'cell-editor date-part';
        
        const timeInput = document.createElement('input');
        timeInput.type = 'text';
        timeInput.placeholder = '18:30';
        timeInput.className = 'cell-editor time-part';
        
        if (this.value) {
            try {
                const date = new Date(this.value);
                // Date part: YYYY-MM-DD
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                dateInput.value = `${y}-${m}-${d}`;
                
                // Time part: HH:mm (24h)
                const hh = String(date.getHours()).padStart(2, '0');
                const mm = String(date.getMinutes()).padStart(2, '0');
                timeInput.value = `${hh}:${mm}`;
            } catch (e) {
                dateInput.value = '';
                timeInput.value = '';
            }
        } else {
            // Default to today at 18:30 as requested before
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            dateInput.value = `${y}-${m}-${d}`;
            timeInput.value = '18:30';
        }

        wrapper.appendChild(dateInput);
        wrapper.appendChild(timeInput);
        
        // Expose for extractValue
        wrapper.dateInput = dateInput;
        wrapper.timeInput = timeInput;

        return wrapper;
    }

    attachEditorListeners(wrapper, finishCallback) {
        const di = wrapper.dateInput;
        const ti = wrapper.timeInput;

        const onKey = (e) => {
            if (e.key === 'Enter') finishCallback(true);
            if (e.key === 'Escape') finishCallback(false);
        };

        di.addEventListener('keydown', onKey);
        ti.addEventListener('keydown', onKey);

        // Blurs: only finish if both are lost? 
        // Actually, set a tiny timeout to check if the new active element is the other input
        const checkBlur = () => {
            setTimeout(() => {
                if (document.activeElement !== di && document.activeElement !== ti) {
                    finishCallback(true);
                }
            }, 50);
        };

        di.addEventListener('blur', checkBlur);
        ti.addEventListener('blur', checkBlur);
    }

    extractValue(wrapper) {
        const dv = wrapper.dateInput.value;
        const tvRaw = wrapper.timeInput.value.trim();
        if (!dv) return null;
        
        // Default values
        let hh = 18, mm = 30;
        
        // Try parsing the text input (handles 18:30, 18.30, 1830, etc.)
        const nums = tvRaw.split(/[:\.]/).map(s => s.trim());
        if (nums.length === 1 && nums[0].length >= 3) { // Case "1830"
            hh = parseInt(nums[0].substring(0, 2), 10);
            mm = parseInt(nums[0].substring(2), 10);
        } else if (nums.length >= 1) {
            if (nums[0]) hh = parseInt(nums[0], 10);
            if (nums[1]) mm = parseInt(nums[1], 10);
        }

        // Clamp to valid ranges
        hh = isNaN(hh) ? 18 : Math.max(0, Math.min(23, hh));
        mm = isNaN(mm) ? 30 : Math.max(0, Math.min(59, mm));
        
        const [y, m, d] = dv.split('-').map(Number);
        const date = new Date(y, m - 1, d, hh, mm);
        return isNaN(date.getTime()) ? null : date.toISOString();
    }
}
