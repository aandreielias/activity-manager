import { SUPABASE_CONFIG } from '../config.js';
import { RequestInterceptor } from './interceptors/RequestInterceptor.js';
import { ResultMapper, DataAccessError } from './mappers/ResultMapper.js';
import { CacheManager } from './cache/CacheManager.js';

/**
 * SupabaseClient — Centralized low-level HTTP client for all Supabase REST calls.
 * Now with built-in retry logic, error handling, request deduplication, and caching.
 * Maintains backward compatibility while adding robustness.
 */
export class SupabaseClient {
    static #interceptor = RequestInterceptor.getInstance();
    static #cache = CacheManager.getInstance();

    /**
     * Build standard Supabase request headers.
     * @param {Object} extra - Additional headers to merge.
     * @returns {Object}
     */
    static headers(extra = {}) {
        return {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_CONFIG.ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
            ...extra,
        };
    }

    /**
     * Build a full URL for a Supabase table endpoint.
     * @param {string} table - The Supabase table name.
     * @param {string} query - Optional query string (including leading '?').
     * @returns {string}
     */
    static url(table, query = '') {
        return `${SUPABASE_CONFIG.URL}/rest/v1/${table}${query}`;
    }

    /**
     * Perform a GET request against a Supabase table.
     * Includes caching, retry logic, and error handling.
     * @param {string} table
     * @param {string} query
     * @param {boolean} useCache - Whether to use cached results (default true)
     * @returns {Promise<Response>}
     */
    static async get(table, query = '', useCache = true) {
        const cacheKey = `GET_${table}_${query}`;

        // Check cache first
        if (useCache) {
            const cached = this.#cache.get(cacheKey);
            if (cached) {
                // Return a response-like object
                return new Response(JSON.stringify(cached), { status: 200 });
            }
        }

        const response = await this.#interceptor.execute(cacheKey, () =>
            fetch(this.url(table, query), {
                headers: this.headers(),
            })
        );

        // Cache successful responses
        if (response.ok && useCache) {
            const data = await response.clone().json();
            this.#cache.set(cacheKey, data);
        }

        return response;
    }

    /**
     * Perform a POST request (INSERT / UPSERT).
     * Includes error handling and validation.
     * @param {string} table
     * @param {Object|Array} body
     * @param {Object} extraHeaders
     * @returns {Promise<Response>}
     */
    static async post(table, body, extraHeaders = {}) {
        // Validate input
        if (!body || (Array.isArray(body) && body.length === 0)) {
            throw new DataAccessError(
                'POST request body cannot be empty',
                { table, operation: 'POST' }
            );
        }

        // Invalidate related caches
        this.#cache.invalidatePattern(`GET_${table}`);

        const cacheKey = `POST_${table}_${Date.now()}`;

        try {
            const response = await this.#interceptor.execute(cacheKey, () =>
                fetch(this.url(table), {
                    method: 'POST',
                    headers: this.headers(extraHeaders),
                    body: JSON.stringify(body),
                })
            );

            return response;
        } catch (error) {
            throw new DataAccessError(
                `POST to ${table} failed: ${error.message}`,
                { table, operation: 'POST', originalError: error }
            );
        }
    }

    /**
     * Perform a PATCH request (UPDATE).
     * Includes error handling and cache invalidation.
     * @param {string} table
     * @param {string} query - Filter query (e.g. '?id=eq.xxx').
     * @param {Object} body
     * @returns {Promise<Response>}
     */
    static async patch(table, query, body) {
        // Validate input
        if (!body || Object.keys(body).length === 0) {
            throw new DataAccessError(
                'PATCH request body cannot be empty',
                { table, operation: 'PATCH', query }
            );
        }

        // Invalidate related caches
        this.#cache.invalidatePattern(`GET_${table}`);

        const cacheKey = `PATCH_${table}_${query}_${Date.now()}`;

        try {
            const response = await this.#interceptor.execute(cacheKey, () =>
                fetch(this.url(table, query), {
                    method: 'PATCH',
                    headers: this.headers(),
                    body: JSON.stringify(body),
                })
            );

            return response;
        } catch (error) {
            throw new DataAccessError(
                `PATCH to ${table} failed: ${error.message}`,
                { table, operation: 'PATCH', query, originalError: error }
            );
        }
    }

    /**
     * Perform a DELETE request.
     * Includes error handling and cache invalidation.
     * @param {string} table
     * @param {string} query
     * @returns {Promise<Response>}
     */
    static async delete(table, query) {
        // Invalidate related caches
        this.#cache.invalidatePattern(`GET_${table}`);

        const cacheKey = `DELETE_${table}_${query}`;

        try {
            const response = await this.#interceptor.execute(cacheKey, () =>
                fetch(this.url(table, query), {
                    method: 'DELETE',
                    headers: this.headers(),
                })
            );

            return response;
        } catch (error) {
            throw new DataAccessError(
                `DELETE from ${table} failed: ${error.message}`,
                { table, operation: 'DELETE', query, originalError: error }
            );
        }
    }

    /**
     * Upload a file to a Supabase bucket.
     * @param {string} bucket - Bucket name.
     * @param {string} path - Remote path (filename).
     * @param {Blob|File} file - File content.
     * @returns {Promise<Response>}
     */
    static upload(bucket, path, file) {
        const url = `${SUPABASE_CONFIG.URL}/storage/v1/object/${bucket}/${path}`;
        const headers = {
            'apikey': SUPABASE_CONFIG.ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
            'x-upsert': 'true',
            'Content-Type': file.type || 'image/jpeg'
        };
        
        return fetch(url, {
            method: 'POST',
            headers: headers,
            body: file
        });
    }

    /**
     * Clear all caches (useful for manual refresh).
     */
    static clearCache() {
        this.#cache.clear();
    }

    /**
     * Get cache statistics.
     */
    static getCacheStats() {
        return this.#cache.getStats();
    }
}
