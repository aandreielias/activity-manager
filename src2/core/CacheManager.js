export class CacheManager {

  static #instance = null;
  #cache = new Map();

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

  set(key, data, ttlMs = 5 * 60 * 1000) {
    this.#cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  invalidate(keys) {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    keysArray.forEach(key => this.#cache.delete(key));
  }

  invalidatePattern(pattern) {
    if (typeof pattern === 'string') {

      const prefix = pattern;
      const keys = Array.from(this.#cache.keys());
      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          this.#cache.delete(key);
        }
      });
    } else if (pattern instanceof RegExp) {

      const keys = Array.from(this.#cache.keys());
      keys.forEach(key => {
        if (pattern.test(key)) {
          this.#cache.delete(key);
        }
      });
    }
  }

  clear() {
    this.#cache.clear();
  }

  getStats() {
    return {
      size: this.#cache.size,
      entries: Array.from(this.#cache.keys())
    };
  }
}