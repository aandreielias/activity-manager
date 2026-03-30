import { TextField } from './TextField.js';

export class NumberField extends TextField {
    extractValue(editor) {
        const val = super.extractValue(editor);
        return parseInt(val) || 0;
    }
}
