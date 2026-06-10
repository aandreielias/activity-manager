export class RequestInterceptor {
  static #instance = null;

  #retryConfig = {
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2
  }
  #inflightRequests = new Map();

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

  addRequestHook(hook) {
    this.#requestHooks.push(hook);
  }

  addResponseHook(hook) {
    this.#responseHooks.push(hook);
  }

  addErrorHook(hook) {
    this.#errorHooks.push(hook);
  }

  async execute(cacheKey, fetchFn) {

    if (this.#inflightRequests.has(cacheKey)) {
      return this.#inflightRequests.get(cacheKey);
    }

    const promise = this._executeWithRetry(fetchFn);
    this.#inflightRequests.set(cacheKey, promise);

    try {
      const response = await promise;

      for (const hook of this.#responseHooks) {
        hook(response, cacheKey);
      }
      return response;
    } catch (error) {

      for (const hook of this.#errorHooks) {
        hook(error, cacheKey);
      }
      throw error;
    } finally {
      this.#inflightRequests.delete(cacheKey);
    }
  }

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

        if (response.status >= 500 && response.status < 600) {
          if (attempt < this.#retryConfig.maxRetries) {
            console.warn(`[RequestInterceptor#_executeWithRetry] Server error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${this.#retryConfig.maxRetries})`);
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
          console.warn(`[RequestInterceptor#_executeWithRetry] Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${this.#retryConfig.maxRetries}):`, error.message);
          await this._sleep(delay);
          delay = Math.min(delay * this.#retryConfig.backoffMultiplier, this.#retryConfig.maxDelayMs);
        }
      }
    }

    throw lastError || new Error('[RequestInterceptor#_executeWithRetry] Request failed after retries');
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setRetryConfig(config) {
    this.#retryConfig = { ...this.#retryConfig, ...config };
  }

  clearInflight() {
    this.#inflightRequests.clear();
  }

  getStats() {
    return {
      inflightRequests: this.#inflightRequests.size,
      retryConfig: this.#retryConfig
    };
  }
}