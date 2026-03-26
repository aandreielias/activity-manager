/**
 * TableEditor - Manages save/discard functionality and persistence
 */
export class TableEditor {
    constructor(table) {
        this.table = table;
        this.saveBarId = `save-bar-${table.id}`;
    }

    _renderSaveBar() {
        const bar = document.createElement('div');
        bar.className = 'save-bar';
        bar.id = this.saveBarId;
        bar.setAttribute('role', 'alert');
        bar.setAttribute('aria-live', 'polite');

        const msg = document.createElement('span');
        msg.className = 'save-bar-msg';
        msg.textContent = 'You have unsaved changes';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => this._handleSave(saveBtn));

        const discardBtn = document.createElement('button');
        discardBtn.className = 'discard-btn';
        discardBtn.textContent = 'Discard';
        discardBtn.addEventListener('click', () => this.hideSaveBar());

        bar.appendChild(msg);
        bar.appendChild(saveBtn);
        bar.appendChild(discardBtn);

        return bar;
    }

    async _handleSave(saveBtn) {
        saveBtn.disabled = true;
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';

        try {
            await this.saveTable();
        } catch (error) {
            console.error('Save error:', error);
            alert(`Error saving table: ${error.message}`);
        } finally {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    }

    async saveTable() {
        try {
            const tableConfig = this.table.tableConfig || {};
            const filename = tableConfig.file || `${this.table.id}.json`;

            // Save to Express.js backend API
            const { DataService } = await import('../services/DataService.js');
            await DataService.saveTable(
                this.table.id,
                filename,
                this.table.rows
            );

            // Close save bar on success
            this.hideSaveBar();
        } catch (error) {
            throw new Error(`Failed to save table: ${error.message}`);
        }
    }

    showSaveBar() {
        // Prevent duplicate save bars
        if (document.getElementById(this.saveBarId)) return;

        const saveBar = this._renderSaveBar();
        this.table.renderer.element?.appendChild(saveBar);
    }

    hideSaveBar() {
        document.getElementById(this.saveBarId)?.remove();
    }
}

