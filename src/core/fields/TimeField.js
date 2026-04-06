import { Field } from './Field.js';

/**
 * TimeField — Simplified HH:mm editor that forces 24h format.
 */
export class TimeField extends Field {
    getDisplayValue() {
        return this.getRawValue() || '18:30';
    }

    createEditor() {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'cell-editor';
        input.placeholder = '18:30';
        input.value = this.getRawValue() === '—' ? '18:30' : this.getRawValue();
        return input;
    }

    attachEditorListeners(editor, finishCallback) {
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') finishCallback(false);
            if (e.key === 'Enter') finishCallback(true);
        });
        editor.addEventListener('blur', () => finishCallback(true));
    }

    extractValue(editor) {
        let val = editor.value.trim();
        if (!val) return '18:30';

        // Parse (HH:mm)
        let hh = 18, mm = 30;
        const nums = val.split(/[:\.]/).map(s => s.trim());
        if (nums.length === 1 && nums[0].length >= 3) {
            hh = parseInt(nums[0].substring(0, 2), 10);
            mm = parseInt(nums[0].substring(2), 10);
        } else if (nums.length >= 1) {
            if (nums[0]) hh = parseInt(nums[0], 10);
            if (nums[1]) mm = parseInt(nums[1], 10);
        }

        hh = isNaN(hh) ? 18 : Math.max(0, Math.min(23, hh));
        mm = isNaN(mm) ? 30 : Math.max(0, Math.min(59, mm));

        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
}
