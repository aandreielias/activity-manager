import { DATABASE } from '../Constants.js';
import { CacheManager } from '../CacheManager.js';
import { RequestInterceptor } from './RequestInterceptor.js';
import { eventBus } from '../../events/EventBus.js';

eventBus.on('DATABASE', 'SAVE_CHANGES', async ({ changes }) => {
  if (!changes || changes.length === 0) return;
  try {
    for (const ch of changes) {
      const isSafe = await Connector.checkConcurrencyConflict(ch.table, ch.rowId, ch.timestamp);
      if (!isSafe) {
        eventBus.emit('DATABASE', 'SAVE_FAILED', {
          error: `Zeile in "${ch.table}" (ID: ${ch.rowId}) wurde von einem anderen Nutzer geändert.`
        });
        return;
      }
    }

    const ops = Connector.prepareSavePayloads(changes);

    await Connector.executeBatchOperations(ops);

    eventBus.emit('DATABASE', 'SAVE_SUCCESS', { changes });
  } catch (error) {
    eventBus.emit('DATABASE', 'SAVE_FAILED', { error: error.message });
  }
});

export class Connector {

  static #interceptor = RequestInterceptor.getInstance();
  static #cache = CacheManager.getInstance();

  /**
   * Build standard Supabase request Headers
   * @param {Object} extra - Additional headers to merge
   * @returns {Object}
   */
  static headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      'apikey': DATABASE.ANON_KEY,
      'Authorization': `Bearer ${DATABASE.ANON_KEY}`, // Immer den ANON_KEY nutzen
      ...extra,
    };
  }

  /**
   * Build full URL for Supabase API
   * @param {string} table - Supabase Table name
   * @param {string} query - Optional Query String
   * @returns {string}
   */
  static url(table, query = '') {
    let url = `${DATABASE.URL}/rest/v1/${table}`;
    if (query) {
      url += `?${query}`;
    } else if (!table.startsWith('rpc/')) {
      url += '?select=*';
    }
    return url;
  }

  /**
   * Perform a GET request against a Supabase Table
   * @param {string} table
   * @param {string} query
   * @param {boolean} useCache - whether to use cached results (default true)
   * @returns {Promise<Response>}
   */
  static async get(table, query = '', useCache = true) {
    const cacheKey = `GET_${table}_${query}`;

    if (useCache) {

      const cached = this.#cache.get(cacheKey);

      if (cached) {

        return new Response(JSON.stringify(cached), { status: 200 });
      }
    }

    const response = await this.#interceptor.execute(cacheKey, () =>

      fetch(this.url(table, query), {
        headers: this.headers(),
      })
    );

    if (response.ok && useCache) {

      try {
        const data = await response.clone().json();
        this.#cache.set(cacheKey, data);
      } catch (_) { }
    }

    return response.clone();
  }

  /**
   * Perform a POST request (INSERT / UPSERT) against a Supabase Table.
   * @param {string} table
   * @param {Object|Array} body
   * @param {Object} extraHeaders
   * @returns {Promise<Response>}
   */
  static async post(table, body, extraHeaders = {}) {

    if (!body || (Array.isArray(body) && body.length === 0)) {

      throw new DataAccessError(
        'POST request body cannot be empty',
        { table, operation: 'POST' }
      );
    }

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
      eventBus.emit('MESSAGE', 'ERROR', `[Connector#post] POST to ${table} failed: ${error.message}`);
      return;
    }
  }

  /**
   * Perform a PATCH request (UPDATE) against a Supabase Table
   * @param {string} table
   * @param {string} query - Filter query (e.g. '?id=eq.xxx').
   * @param {Object} body
   * @returns {Promise<Response>}
   */
  static async patch(table, query, body) {

    if (!body || Object.keys(body).length === 0) {

      eventBus.emit('MESSAGE', 'ERROR', `[Connector#patch] PATCH to ${table} failed: ${error.message}`);
      return;
    }

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

      eventBus.emit('MESSAGE', 'ERROR', `[Connector#delete] DELETE from ${table} failed: ${error.message}`);
      return;
    }
  }

  /**
   * Perform a DELETE request against a Supabase Table
   * @param {string} table
   * @param {string} query
   * @returns {Promise<Response>}
   */
  static async delete(table, query) {

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

      eventBus.emit('MESSAGE', 'ERROR', `[Connector#delete] DELETE from ${table} failed: ${error.message}` +
        { table, operation: 'DELETE', query, originalError: error });
      return;
    }
  }

  /**
   * Upload a file to a Supabase bucket
   * @param {string} bucket - Bucket name
   * @param {string} path - Remote path (filename)
   * @param {Blob|File} file - File content
   * @returns {Promise<Response>}
   */
  static uploadStorageFile(bucket, path, file) {

    const url = `${DATABASE.URL}/storage/v1/object/${bucket}/${path}`;
    const headers = {

      'apikey': DATABASE.ANON_KEY,
      'Authorization': `Bearer ${DATABASE.ANON_KEY}`,
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
   * Delete a file from a Supabase bucket
   * @param {string} bucket - Bucket name
   * @param {string} path - Remote path (filename)
   * @returns {Promise<Response>}
   */
  static deleteStorageFile(bucket, path) {

    const url = `${DATABASE.URL}/storage/v1/object/${bucket}/${path}`;
    const headers = {

      'apikey': DATABASE.ANON_KEY,
      'Authorization': `Bearer ${DATABASE.ANON_KEY}`
    };

    return fetch(url, {

      method: 'DELETE',
      headers: headers
    });
  }

  /**
   * Translates application change objects into exact Supabase API payloads.
   * Handles both normal parent columns and junction table many-to-many links.
   * @param {Array<Object>} changes - Changes from ChangeService
   * @returns {Array<Object>} Exact database operation payloads
   */
  static prepareSavePayloads(changes) {
    const ops = [];
    changes.forEach(ch => {
      const pkColumn = Object.keys(ch.row.data).find(k => k.endsWith('_id')) || `${ch.table}_id`;

      if (ch.field === '__ROW_ACTION__') {
        if (ch.newValue === 'ADD') {
          const insertData = { ...ch.row.data };
          delete insertData[pkColumn]; 
          Object.keys(insertData).forEach(key => {
            if (key.endsWith('_junction')) delete insertData[key];
          });
          
          ops.push({
            method: 'POST',
            table: ch.table,
            body: insertData
          });
        } else if (ch.newValue === 'DELETE') {
          ops.push({
            method: 'DELETE',
            table: ch.table,
            query: `${pkColumn}=eq.${ch.rowId}`
          });
        }
        return; 
      }

      const isJunction = ch.field.endsWith('_id') && ch.row.data[ch.field + '_junction'] !== undefined;

      if (isJunction) {

        const junctionTableName = `pt_${ch.table.split('_')[1]}_${ch.fieldMeta?.reference?.split('_')[1]}`;
        const prefixA = ch.table.substring(0, 3);
        const prefixB = ch.fieldMeta.reference.substring(0, 3);

        const colToA = `${junctionTableName.substring(0, 3)}${prefixA}id`;
        const colToB = `${junctionTableName.substring(0, 3)}${prefixB}id`;

        const oldRefId = ch.oldValue;
        const newRefId = ch.newValue;

        if (oldRefId && !newRefId) {

          ops.push({
            method: 'DELETE',
            table: junctionTableName,
            query: `${colToA}=eq.${ch.rowId}&${colToB}=eq.${oldRefId}`
          });
        } else if (!oldRefId && newRefId) {

          ops.push({
            method: 'POST',
            table: junctionTableName,
            body: { [colToA]: ch.rowId, [colToB]: newRefId }
          });
        } else if (oldRefId && newRefId && oldRefId !== newRefId) {

          ops.push({
            method: 'DELETE',
            table: junctionTableName,
            query: `${colToA}=eq.${ch.rowId}&${colToB}=eq.${oldRefId}`
          });
          ops.push({
            method: 'POST',
            table: junctionTableName,
            body: { [colToA]: ch.rowId, [colToB]: newRefId }
          });
        }
      } else {
        ops.push({
          method: 'PATCH',
          table: ch.table,
          query: `${pkColumn}=eq.${ch.rowId}`,
          body: { [ch.field]: ch.newValue }
        });
      }
    });
    return ops;
  }

  /**
   * Executes a series of database operations.
   * Halts instantly if an operation fails to prevent data corruption.
   * @param {Array<Object>} ops - List of operations from prepareSavePayloads
   * @returns {Promise<boolean>}
   */
  static async executeBatchOperations(ops) {
    const executed = [];
    try {
      for (const op of ops) {
        let res;
        if (op.method === 'PATCH') {
          res = await this.patch(op.table, op.query, op.body);
        } else if (op.method === 'POST') {
          res = await this.post(op.table, op.body);
        } else if (op.method === 'DELETE') {
          res = await this.delete(op.table, op.query);
        }
        if (!res || !res.ok) {
          throw new Error(`Execution failed on table "${op.table}" during "${op.method}" operation.`);
        }
        executed.push(op);
      }
      return true;
    } catch (error) {
      eventBus.emit('MESSAGE', 'ERROR', `[Database Save Error] ${error.message} Remaining operations aborted.`);
      throw error;
    }
  }

  /**
   * Performs an optimistic lock check to detect concurrent modification conflicts.
   * @param {string} table
   * @param {string|number} rowId
   * @param {string} loadedAtIsoString - The timestamp when the client originally loaded the row
   * @returns {Promise<boolean>} True if safe to save, false if modified by someone else
   */
  static async checkConcurrencyConflict(table, rowId, loadedAtIsoString) {
    if (String(rowId).startsWith('NEW_')) {
      return true;
    }

    const prefix = table.split('_')[0] || table.substring(0, 2);
    const primaryKeyCol = `${table}_id`;

    const res = await this.get(table, `${primaryKeyCol}=eq.${rowId}`, false);

    if (res.ok) {
      const data = await res.json();
      const serverRow = data[0];
      if (serverRow && serverRow.modified_at) {
        const serverTime = new Date(serverRow.modified_at).getTime();
        const clientTime = new Date(loadedAtIsoString).getTime();
        return serverTime <= clientTime;
      }
    }
    return true;
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