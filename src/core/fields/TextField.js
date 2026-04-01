import { Field } from './Field.js';

export class TextField extends Field {
    createEditor() {
        const textarea = document.createElement('textarea');
        textarea.className = 'cell-editor';
        textarea.style.height = 'auto';
        textarea.style.minHeight = '0';
        textarea.style.overflow = 'hidden';
        const raw = this.getRawValue();
        textarea.value = raw === '—' ? '' : raw;

        // Vertical auto-expand
        const autoExpand = () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        };
        textarea.addEventListener('input', autoExpand);
        // Instant sync
        setTimeout(autoExpand, 0);

        return textarea;
    }

    attachEditorListeners(editor, finishCallback) {
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') finishCallback(false);
            if (e.key === 'Tab') {
                e.preventDefault();
                finishCallback(true, true); // save=true, advance=true
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                finishCallback(true);
            }
        });
        editor.addEventListener('blur', () => finishCallback(true));
    }

    extractValue(editor) {
        return editor.value.trim() || '—';
    }
}
