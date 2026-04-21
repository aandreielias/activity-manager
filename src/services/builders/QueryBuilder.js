/**
 * QueryBuilder — Safe Supabase query construction to prevent injection vulnerabilities.
 * Builds SELECT, PATCH, DELETE queries with proper parameter encoding.
 */
export class QueryBuilder {
    constructor(table) {
        this.table = table;
        this.selects = [];
        this.filters = [];
        this.order = null;
        this.limit = null;
    }

    /**
     * Specify which columns to select.
     * @param {string|Array<string>} cols
     * @returns {QueryBuilder}
     */
    select(cols = '*') {
        if (Array.isArray(cols)) {
            this.selects = cols;
        } else {
            this.selects = [cols];
        }
        return this;
    }

    /**
     * Add a filter condition.
     * @param {string} column
     * @param {string} operator - 'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'is.null', etc.
     * @param {any} value - Will be automatically encoded
     * @returns {QueryBuilder}
     */
    where(column, operator, value) {
        this.filters.push({ column, operator, value });
        return this;
    }

    /**
     * Add an 'in' filter for arrays.
     * @param {string} column
     * @param {Array} values
     * @returns {QueryBuilder}
     */
    whereIn(column, values) {
        if (!Array.isArray(values)) {
            throw new Error('whereIn requires an array of values');
        }
        const encoded = values.map(v => this._encodeValue(v)).join(',');
        this.filters.push({ column, operator: 'in', value: `(${encoded})`, raw: true });
        return this;
    }

    /**
     * Add an ordering clause.
     * @param {string} column
     * @param {string} direction - 'asc' or 'desc'
     * @returns {QueryBuilder}
     */
    orderBy(column, direction = 'asc') {
        this.order = `${column}.${direction}`;
        return this;
    }

    /**
     * Add a limit clause.
     * @param {number} count
     * @returns {QueryBuilder}
     */
    take(count) {
        this.limit = count;
        return this;
    }

    /**
     * Build the query string for Supabase REST API.
     * @returns {string}
     */
    build() {
        const parts = [];

        // SELECT clause
        if (this.selects.length > 0) {
            parts.push(`select=${this.selects.join(',')}`);
        }

        // WHERE clauses
        this.filters.forEach(f => {
            if (f.raw) {
                // Pre-encoded value (e.g., from whereIn)
                parts.push(`${f.column}=${f.operator}.${f.value}`);
            } else {
                const encoded = this._encodeValue(f.value);
                parts.push(`${f.column}=${f.operator}.${encoded}`);
            }
        });

        // ORDER clause
        if (this.order) {
            parts.push(`order=${this.order}`);
        }

        // LIMIT clause
        if (this.limit !== null) {
            parts.push(`limit=${this.limit}`);
        }

        return parts.length > 0 ? `?${parts.join('&')}` : '';
    }

    /**
     * Safely encode a value for Supabase query parameters.
     * @private
     * @param {any} value
     * @returns {string}
     */
    _encodeValue(value) {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (typeof value === 'string') {
            return `"${value.replace(/"/g, '\\"')}"`;
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (typeof value === 'number') {
            return value.toString();
        }
        // Fallback for complex types
        return `"${JSON.stringify(value).replace(/"/g, '\\"')}"`;
    }

    /**
     * Build a filter query string for use in REST API calls.
     * Useful when you need just the filter part for PATCH/DELETE operations.
     * @returns {string}
     */
    buildFilterOnly() {
        if (this.filters.length === 0) return '';
        
        const parts = this.filters.map(f => {
            if (f.raw) {
                return `${f.column}=${f.operator}.${f.value}`;
            }
            const encoded = this._encodeValue(f.value);
            return `${f.column}=${f.operator}.${encoded}`;
        });
        
        return `?${parts.join('&')}`;
    }
}

/**
 * Factory for creating QueryBuilders.
 */
export class QueryBuilderFactory {
    static create(table) {
        return new QueryBuilder(table);
    }
}

