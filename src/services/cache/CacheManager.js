/**
 * CacheManager — Request-level caching with TTL and invalidation.
 * Reduces redundant fetches to Supabase, improving performance and reducing quota usage.
 */
export class CacheManager {
    static #instance = null;
    #cache = new Map(); // key -> { data, timestamp, ttl }

    constructor() {
        if (CacheManager.#instance) return CacheManager.#instance;
        CacheManager.#instance = this;
    }

    static getInstance() {
        if (!CacheManager.#instance) {
            CacheManager.#instance = new CacheManager();
        }
        return CacheManager.#instance;
    }

    /**
     * Get a cached value if it exists and hasn't expired.
     * @param {string} key
     * @returns {any|null}
     */
    get(key) {
        if (!this.#cache.has(key)) return null;

        const entry = this.#cache.get(key);
        const now = Date.now();
        
        if (now - entry.timestamp > entry.ttl) {
            this.#cache.delete(key);
            return null;
        }

        return entry.data;
    }

    /**
     * Store a value in cache with TTL.
     * @param {string} key
     * @param {any} data
     * @param {number} ttlMs - Time-to-live in milliseconds (default 5 minutes)
     */
    set(key, data, ttlMs = 5 * 60 * 1000) {
        this.#cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMs
        });
    }

    /**
     * Invalidate a specific cache entry.
     * @param {string|Array<string>} keys - Key or array of keys to invalidate
     */
    invalidate(keys) {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(key => this.#cache.delete(key));
    }

    /**
     * Invalidate all cache entries matching a pattern.
     * @param {RegExp|string} pattern - RegExp or string prefix to match
     */
    invalidatePattern(pattern) {
        if (typeof pattern === 'string') {
            // Match by prefix
            const prefix = pattern;
            const keys = Array.from(this.#cache.keys());
            keys.forEach(key => {
                if (key.startsWith(prefix)) {
                    this.#cache.delete(key);
                }
            });
        } else if (pattern instanceof RegExp) {
            // Match by regex
            const keys = Array.from(this.#cache.keys());
            keys.forEach(key => {
                if (pattern.test(key)) {
                    this.#cache.delete(key);
                }
            });
        }
    }

    /**
     * Clear all cached data.
     */
    clear() {
        this.#cache.clear();
    }

    /**
     * Get cache statistics (for debugging).
     */
    getStats() {
        return {
            size: this.#cache.size,
            entries: Array.from(this.#cache.keys())
        };
    }
}

