import { Field } from './Field.js';

export class TextField extends Field {
    createEditor() {
        const textarea = document.createElement('textarea');
        textarea.className = 'cell-editor';
        const raw = this.getRawValue();
        textarea.value = raw === '—' ? '' : raw;
        return textarea;
    }

    attachEditorListeners(editor, finishCallback) {
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') finishCallback(false);
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
