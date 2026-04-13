import { SUPABASE_CONFIG } from '../config.js';

/**
 * SupabaseClient — Centralized low-level HTTP client for all Supabase REST calls.
 * Eliminates duplicated headers/URL logic across services.
 */
export class SupabaseClient {

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
     * @param {string} table
     * @param {string} query
     * @returns {Promise<Response>}
     */
    static get(table, query = '') {
        return fetch(this.url(table, query), {
            headers: this.headers(),
        });
    }

    /**
     * Perform a POST request (INSERT / UPSERT).
     * @param {string} table
     * @param {Object|Array} body
     * @param {Object} extraHeaders
     * @returns {Promise<Response>}
     */
    static post(table, body, extraHeaders = {}) {
        return fetch(this.url(table), {
            method: 'POST',
            headers: this.headers(extraHeaders),
            body: JSON.stringify(body),
        });
    }

    /**
     * Perform a PATCH request (UPDATE).
     * @param {string} table
     * @param {string} query - Filter query (e.g. '?id=eq.xxx').
     * @param {Object} body
     * @returns {Promise<Response>}
     */
    static patch(table, query, body) {
        return fetch(this.url(table, query), {
            method: 'PATCH',
            headers: this.headers(),
            body: JSON.stringify(body),
        });
    }

    /**
     * Perform a DELETE request.
     * @param {string} table
     * @param {string} query
     * @returns {Promise<Response>}
     */
    static delete(table, query) {
        return fetch(this.url(table, query), {
            method: 'DELETE',
            headers: this.headers(),
        });
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
}
