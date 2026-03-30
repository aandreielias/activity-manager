/**
 * GlobalStateManager - Manages global application state (unsaved changes, etc.)
 */
export class GlobalStateManager {
    static #instance = null;

    constructor() {
        if (GlobalStateManager.#instance) {
            return GlobalStateManager.#instance;
        }

        this.unsavedTables = new Set();
        this.callbacks = {
            onUnsavedChange: new Set()
        };

        GlobalStateManager.#instance = this;
    }

    static getInstance() {
        if (!GlobalStateManager.#instance) {
            GlobalStateManager.#instance = new GlobalStateManager();
        }
        return GlobalStateManager.#instance;
    }

    markTableAsUnsaved(tableId) {
        this.unsavedTables.add(tableId);
        this._notifyUnsavedChange();
    }

    markTableAsSaved(tableId) {
        this.unsavedTables.delete(tableId);
        this._notifyUnsavedChange();
    }

    clearAllUnsaved() {
        this.unsavedTables.clear();
        this._notifyUnsavedChange();
    }

    hasUnsavedChanges() {
        return this.unsavedTables.size > 0;
    }

    getUnsavedTableIds() {
        return Array.from(this.unsavedTables);
    }

    onUnsavedChangeCallback(callback) {
        this.callbacks.onUnsavedChange.add(callback);
        // Return an unregister function just in case
        return () => this.callbacks.onUnsavedChange.delete(callback);
    }

    _notifyUnsavedChange() {
        const hasUnsaved = this.hasUnsavedChanges();
        this.callbacks.onUnsavedChange.forEach(cb => cb(hasUnsaved));
    }
}

