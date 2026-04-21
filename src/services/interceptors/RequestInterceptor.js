/**
 * RequestInterceptor — Centralized request/response handling.
 * Handles error management, retry logic with exponential backoff, deduplication, and logging.
 */
export class RequestInterceptor {
    static #instance = null;
    #retryConfig = {
        maxRetries: 3,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        backoffMultiplier: 2
    };
    #inflightRequests = new Map(); // key -> Promise (for deduplication)
    #requestHooks = [];
    #responseHooks = [];
    #errorHooks = [];

    constructor() {
        if (RequestInterceptor.#instance) return RequestInterceptor.#instance;
        RequestInterceptor.#instance = this;
    }

    static getInstance() {
        if (!RequestInterceptor.#instance) {
            RequestInterceptor.#instance = new RequestInterceptor();
        }
        return RequestInterceptor.#instance;
    }

    /**
     * Add a request hook (called before fetch).
     * @param {Function} hook
     */
    addRequestHook(hook) {
        this.#requestHooks.push(hook);
    }

    /**
     * Add a response hook (called after successful fetch).
     * @param {Function} hook
     */
    addResponseHook(hook) {
        this.#responseHooks.push(hook);
    }

    /**
     * Add an error hook (called on error).
     * @param {Function} hook
     */
    addErrorHook(hook) {
        this.#errorHooks.push(hook);
    }

    /**
     * Execute fetch with retry logic, deduplication, and error handling.
     * @param {string} cacheKey - Unique key for deduplication
     * @param {Function} fetchFn - async function that returns Response
     * @returns {Promise<Response>}
     */
    async execute(cacheKey, fetchFn) {
        // Check for in-flight request (deduplication)
        if (this.#inflightRequests.has(cacheKey)) {
            return this.#inflightRequests.get(cacheKey);
        }

        // Execute with retry and store promise
        const promise = this._executeWithRetry(fetchFn);
        this.#inflightRequests.set(cacheKey, promise);

        try {
            const response = await promise;
            // Call response hooks
            for (const hook of this.#responseHooks) {
                hook(response, cacheKey);
            }
            return response;
        } catch (error) {
            // Call error hooks
            for (const hook of this.#errorHooks) {
                hook(error, cacheKey);
            }
            throw error;
        } finally {
            this.#inflightRequests.delete(cacheKey);
        }
    }

    /**
     * Execute fetch with exponential backoff retry logic.
     * @private
     * @param {Function} fetchFn
     * @returns {Promise<Response>}
     */
    async _executeWithRetry(fetchFn) {
        let lastError = null;
        let delay = this.#retryConfig.initialDelayMs;

        for (let attempt = 0; attempt <= this.#retryConfig.maxRetries; attempt++) {
            try {
                // Call request hooks
                for (const hook of this.#requestHooks) {
                    hook();
                }

                const response = await fetchFn();

                // Retry on 5xx errors (server errors)
                if (response.status >= 500 && response.status < 600) {
                    if (attempt < this.#retryConfig.maxRetries) {
                        console.warn(`[RequestInterceptor] Server error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${this.#retryConfig.maxRetries})`);
                        await this._sleep(delay);
                        delay = Math.min(delay * this.#retryConfig.backoffMultiplier, this.#retryConfig.maxDelayMs);
                        lastError = new Error(`Server error: ${response.status}`);
                        continue;
                    }
                }

                return response;
            } catch (error) {
                lastError = error;
                if (attempt < this.#retryConfig.maxRetries) {
                    console.warn(`[RequestInterceptor] Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${this.#retryConfig.maxRetries}):`, error.message);
                    await this._sleep(delay);
                    delay = Math.min(delay * this.#retryConfig.backoffMultiplier, this.#retryConfig.maxDelayMs);
                }
            }
        }

        throw lastError || new Error('Request failed after retries');
    }

    /**
     * Sleep utility for delays.
     * @private
     * @param {number} ms
     * @returns {Promise<void>}
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Configure retry behavior.
     * @param {Object} config
     */
    setRetryConfig(config) {
        this.#retryConfig = { ...this.#retryConfig, ...config };
    }

    /**
     * Clear all in-flight requests (use carefully).
     */
    clearInflight() {
        this.#inflightRequests.clear();
    }

    /**
     * Get stats about interceptor state.
     */
    getStats() {
        return {
            inflightRequests: this.#inflightRequests.size,
            retryConfig: this.#retryConfig
        };
    }
}

