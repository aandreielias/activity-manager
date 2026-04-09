/**
 * FilterEngine - Provides utility methods to filter rows based on filter state.
 */
import { GlobalStateManager } from '../core/GlobalStateManager.js';

export class FilterEngine {
    /**
     * Test if a row matches all active filters.
     */
    static matchesFilters(row, filters) {
        if (!filters || filters.length === 0) return true;

        const activeFilters = filters.filter(f => {
            if (!f.attrId || !f.mode) return false;
            const hasValue = Array.isArray(f.value) ? f.value.length > 0 : (f.value !== undefined && f.value !== null && f.value !== '');
            const hasAvailability = Array.isArray(f.availability) && f.availability.length > 0;
            return hasValue || hasAvailability;
        });

        if (activeFilters.length === 0) return true;

        return activeFilters.every(f => {
            let rawValue = row.data[f.attrId];
            if (rawValue === undefined && f.attrId) {
                const lowerId = f.attrId.toLowerCase();
                const actualKey = Object.keys(row.data).find(k => k.toLowerCase() === lowerId);
                if (actualKey) rawValue = row.data[actualKey];
            }
            
            const filterValue = f.value;
            const isInventory = f.attrId?.toLowerCase()?.includes('gegenstände') || f.attrId === 'required_items';

            // 1. Inventory Logic
            if (isInventory) {
                const itemsInRow = this._parseInventory(rawValue);
                
                if (Array.isArray(f.availability) && f.availability.length > 0) {
                    const gs = GlobalStateManager.getInstance();
                    const inventory = gs.getInventory();
                    let rowStatus = 'available';
                    if (itemsInRow.length > 0) {
                        const statuses = itemsInRow.map(req => {
                            const invItem = inventory.find(i => this._compareStrings(i.data?.name || i.name, req.name));
                            const invQty = invItem ? (parseFloat(invItem.data?.quantity || invItem.quantity) || 0) : 0;
                            const reqQty = parseFloat(req.quantity) || 0;
                            if (invQty >= reqQty) return 'full';
                            if (invQty > 0) return 'partial';
                            return 'none';
                        });
                        if (statuses.some(s => s === 'none')) rowStatus = 'none';
                        else if (statuses.some(s => s === 'partial')) rowStatus = 'partial';
                        else rowStatus = 'available';
                    }
                    if (!f.availability.includes(rowStatus)) return false;
                }

                if (Array.isArray(filterValue) && filterValue.length > 0) {
                    const isAnyMatch = filterValue.some(sel => {
                        const found = itemsInRow.find(i => this._compareStrings(i.name, sel));
                        if (!found) return false;
                        if (f.quantityMode && f.quantityMode !== 'any' && f.quantityValue !== '') {
                            const target = parseFloat(f.quantityValue);
                            const actual = parseFloat(found.quantity) || 0;
                            if (!isNaN(target)) {
                                switch (f.quantityMode) {
                                    case 'equals': return Math.abs(actual - target) < 0.001;
                                    case 'greater': return actual > target;
                                    case 'less': return actual < target;
                                }
                            }
                        }
                        return true;
                    });
                    return f.mode === 'is' ? isAnyMatch : !isAnyMatch;
                }
                return true;
            }

            // 2. Enum/Array Logic
            if (Array.isArray(filterValue)) {
                if (filterValue.length === 0) return true;
                const rowValStr = this._normalizeValue(rawValue);
                const isAnyMatch = filterValue.some(v => this._compareStrings(rowValStr, v));
                return f.mode === 'is' ? isAnyMatch : !isAnyMatch;
            }

            // 3. Scalar Logic
            if (filterValue === '' || filterValue === null) return true;
            const val = this._normalizeValue(rawValue);
            const fVal = String(filterValue).toLowerCase();

            switch (f.mode) {
                case 'contains': return val.includes(fVal);
                case 'not_contains': return !val.includes(fVal);
                case 'equals': return val === fVal;
                case 'greater': return parseFloat(rawValue) > parseFloat(filterValue);
                case 'less': return parseFloat(rawValue) < parseFloat(filterValue);
                case 'after': {
                    const rowDate = new Date(rawValue);
                    const filterDate = new Date(filterValue);
                    return !isNaN(rowDate) && !isNaN(filterDate) && rowDate > filterDate;
                }
                case 'before': {
                    const rowDate = new Date(rawValue);
                    const filterDate = new Date(filterValue);
                    return !isNaN(rowDate) && !isNaN(filterDate) && rowDate < filterDate;
                }
                default: return true;
            }
        });
    }

    /**
     * Robust helper to compare two strings regardless of casing or internal spacing.
     * Handles "To Do" vs "todo" vs "to do".
     */
    static _compareStrings(a, b) {
        if (a === b) return true;
        const normA = String(a || '').toLowerCase().replace(/\s+/g, '');
        const normB = String(b || '').toLowerCase().replace(/\s+/g, '');
        return normA === normB && normA !== '';
    }

    static _normalizeValue(val) {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') {
            return String(val.label || val.title || val.name || val.id || JSON.stringify(val)).toLowerCase();
        }
        return String(val).toLowerCase();
    }

    static _parseInventory(str) {
        if (!str || typeof str !== 'string' || str === '—') return [];
        return str.split(',').map(part => {
            const match = part.trim().match(/^(.+?)\s*\(\s*(\d+\.?\d*)\s*\)$/);
            if (match) return { name: match[1].trim(), quantity: match[2] };
            return { name: part.trim(), quantity: '1' };
        });
    }

    /**
     * Groups rows by a given attribute ID.
     * Returns an object mapping group names to arrays of rows.
     */
    static groupRows(rows, groupByAttrId) {
        if (!groupByAttrId || !rows || rows.length === 0) return { 'Alle': rows };

        const groups = {};
        rows.forEach(row => {
            let rawValue = row.data[groupByAttrId];
            // Case-insensitive key lookup fallback
            if (rawValue === undefined) {
                const lowerId = groupByAttrId.toLowerCase();
                const actualKey = Object.keys(row.data).find(k => k.toLowerCase() === lowerId);
                if (actualKey) rawValue = row.data[actualKey];
            }

            let groupName;
            if (rawValue === null || rawValue === undefined || rawValue === '') {
                groupName = '(Leer)';
            } else if (typeof rawValue === 'object') {
                groupName = rawValue.label || rawValue.title || rawValue.name || JSON.stringify(rawValue);
            } else {
                groupName = String(rawValue);
            }

            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(row);
        });
        return groups;
    }
}
