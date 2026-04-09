import { BaseFilterBar } from './BaseFilterBar.js';

/**
 * FilterBar - Standard implementation of the filter bar.
 * This class now inherits all logic from BaseFilterBar.
 * Used for both individual table filters and global view filters.
 */
export class FilterBar extends BaseFilterBar {
    /**
     * @param {Object} options - Same options as BaseFilterBar
     */
    constructor(options) {
        super(options);
    }

    // This class is kept for backward compatibility and as a concrete implementation
    // of the shared logic. Future specializations can be added here if needed.
}
