/**
 * DataAccessError — Custom error class for data access operations.
 * Wraps Supabase errors with context about the request and retry attempts.
 */
export class DataAccessError extends Error {
    constructor(message, context = {}) {
        super(message);
        this.name = 'DataAccessError';
        this.context = {
            table: context.table || null,
            operation: context.operation || null,
            query: context.query || null,
            statusCode: context.statusCode || null,
            supabaseMessage: context.supabaseMessage || null,
            timestamp: new Date().toISOString(),
            retryAttempts: context.retryAttempts || 0,
            ...context
        };
    }

    /**
     * Get a user-friendly error message.
     */
    getUserMessage() {
        const { statusCode, operation, table } = this.context;

        if (statusCode === 401 || statusCode === 403) {
            return `Keine Berechtigung für ${operation || 'diese Operation'}.`;
        }
        if (statusCode === 404) {
            return `${table || 'Ressource'} nicht gefunden.`;
        }
        if (statusCode >= 500) {
            return 'Datenbankfehler. Bitte später versuchen.';
        }
        if (statusCode === 0) {
            return 'Verbindung zu Supabase fehlgeschlagen. Bitte Internetverbindung prüfen.';
        }

        return this.message;
    }

    /**
     * Get detailed debug information.
     */
    getDebugInfo() {
        return JSON.stringify(this.context, null, 2);
    }

    /**
     * Check if error is retriable.
     */
    isRetriable() {
        const { statusCode } = this.context;
        return statusCode >= 500 || statusCode === 0 || statusCode === null;
    }
}

/**
 * ResultMapper — Centralized response parsing and validation.
 * Ensures consistent error handling across all Supabase operations.
 */
export class ResultMapper {
    /**
     * Parse a successful response and return data.
     * @param {Response} response
     * @param {Object} context
     * @returns {Promise<any>}
     */
    static async parseSuccess(response, context = {}) {
        if (!response.ok) {
            const text = await response.text();
            let supabaseMessage = text;
            
            try {
                const json = JSON.parse(text);
                supabaseMessage = json.message || json.error || text;
            } catch {}

            throw new DataAccessError(
                `Operation failed on ${context.table || 'unknown table'}`,
                {
                    ...context,
                    statusCode: response.status,
                    supabaseMessage
                }
            );
        }

        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            return await response.text();
        } catch (e) {
            throw new DataAccessError(
                'Failed to parse response',
                {
                    ...context,
                    statusCode: response.status,
                    originalError: e.message
                }
            );
        }
    }

    /**
     * Ensure response is ok, throw descriptive error if not.
     * @param {Response} response
     * @param {Object} context
     * @returns {Promise<Response>}
     */
    static async ensureOk(response, context = {}) {
        if (!response.ok) {
            const text = await response.text();
            let supabaseMessage = text;
            
            try {
                const json = JSON.parse(text);
                supabaseMessage = json.message || json.error || text;
            } catch {}

            throw new DataAccessError(
                `API Error: ${response.status}`,
                {
                    ...context,
                    statusCode: response.status,
                    supabaseMessage
                }
            );
        }
        return response;
    }

    /**
     * Parse a response that may or may not be ok.
     * @param {Response} response
     * @param {Object} context
     * @returns {Promise<{ok: boolean, data: any, error: DataAccessError|null}>}
     */
    static async parse(response, context = {}) {
        try {
            const contentType = response.headers.get('content-type');
            const data = contentType && contentType.includes('application/json')
                ? await response.json()
                : await response.text();

            if (!response.ok) {
                const supabaseMessage = data?.message || data?.error || data;
                const error = new DataAccessError(
                    `API Error: ${response.status}`,
                    {
                        ...context,
                        statusCode: response.status,
                        supabaseMessage
                    }
                );
                return { ok: false, data: null, error };
            }

            return { ok: true, data, error: null };
        } catch (e) {
            const error = new DataAccessError(
                'Failed to parse response',
                {
                    ...context,
                    statusCode: response.status,
                    originalError: e.message
                }
            );
            return { ok: false, data: null, error };
        }
    }
}

