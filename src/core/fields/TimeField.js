import { Field } from './Field.js';

/**
 * TimeField — Simplified HH:mm editor that forces 24h format.
 */
export class TimeField extends Field {
    getDisplayValue() {
        return this.getRawValue() || '18:30 - 21:00';
    }

    createEditor() {
        const wrapper = document.createElement('div');
        wrapper.className = 'time-range-editor';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '4px';

        const [startVal, endVal] = (this.getRawValue() || '18:30 - 21:00').split(' - ');

        const startInput = document.createElement('input');
        startInput.type = 'time';
        startInput.className = 'cell-editor time-part';
        startInput.value = startVal || '18:30';

        const separator = document.createElement('span');
        separator.textContent = '-';
        separator.style.color = 'var(--text-muted)';

        const endInput = document.createElement('input');
        endInput.type = 'time';
        endInput.className = 'cell-editor time-part';
        endInput.value = endVal || '21:00';

        wrapper.appendChild(startInput);
        wrapper.appendChild(separator);
        wrapper.appendChild(endInput);

        wrapper.startInput = startInput;
        wrapper.endInput = endInput;

        return wrapper;
    }

    attachEditorListeners(wrapper, finishCallback) {
        const start = wrapper.startInput;
        const end = wrapper.endInput;

        let finished = false;
        const wrapFinish = (success) => {
            if (finished) return;
            finished = true;
            document.removeEventListener('mousedown', onClickOutside);
            finishCallback(success);
        };

        const onKey = (e) => {
            if (e.key === 'Enter') wrapFinish(true);
            if (e.key === 'Escape') wrapFinish(false);
        };

        start.addEventListener('keydown', onKey);
        end.addEventListener('keydown', onKey);

        const onClickOutside = (e) => {
            if (!wrapper.contains(e.target)) {
                wrapFinish(true);
            }
        };

        document.addEventListener('mousedown', onClickOutside);

        const checkBlur = () => {
            setTimeout(() => {
                if (document.activeElement !== start && document.activeElement !== end && !finished) {
                    wrapFinish(true);
                }
            }, 100);
        };

        start.addEventListener('blur', checkBlur);
        end.addEventListener('blur', checkBlur);
    }

    extractValue(wrapper) {
        const start = wrapper.startInput.value || '18:30';
        const end = wrapper.endInput.value || '21:00';
        return `${start} - ${end}`;
    }
}
