import { GlobalStateManager } from '../core/GlobalStateManager.js';

/**
 * InventoryService — Centralized logic for parsing inventory strings and validating availability.
 * Decouples parsing/validation from both UI components and Data persistence.
 */
export class InventoryService {

    /**
     * Parses a comma-separated inventory string like "Sessel (3), Tisch"
     * into an array of objects: [{ name: 'Sessel', quantity: '3' }, { name: 'Tisch', quantity: '' }]
     */
    static parseInventoryString(str) {
        if (!str || str === '—' || !str.trim()) return [];

        return str.split(',').map(s => {
            const match = s.trim().match(/(.+?)\s*\((.+?)\)/);
            if (match) {
                return { name: match[1].trim(), quantity: match[2].trim() };
            }
            return { name: s.trim(), quantity: '' };
        }).filter(item => item.name);
    }

    /**
     * Formats an array of item objects back into a standard comma-separated string.
     */
    static formatInventoryString(items) {
        if (!items || items.length === 0) return '—';
        return items
            .map(i => {
                const q = (i.quantity || '').toString().trim();
                return q ? `${i.name} (${q})` : i.name;
            })
            .join(', ');
    }

    /**
     * Checks the availability/status of requested items against the current inventory.
     * @returns {Object} { status: 'available'|'warning'|'unavailable', message: string }
     */
    static validateAvailability(requestedName, requestedQuantity) {
        const inventory = GlobalStateManager.getInstance().getInventory();
        const invRow = inventory.find(r => (r.data?.name || '').toLowerCase() === requestedName.toLowerCase());
        
        if (!invRow) {
            return { status: 'unavailable', message: '! Nicht im Inventar' };
        }

        const invQuantity = parseInt(invRow.data?.quantity || 0, 10);
        const requestedNum = parseInt(requestedQuantity || 0, 10);

        if (!isNaN(requestedNum) && requestedNum > invQuantity) {
            return { status: 'warning', message: '! Nicht genug im Inventar' };
        }

        return { status: 'available', message: '' };
    }
}
