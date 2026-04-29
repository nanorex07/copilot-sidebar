import { database } from './database';

/**
 * BaseStore — Abstract base class for domain-specific IndexedDB stores.
 *
 * Design rationale: Every domain store (settings, history, etc.) needs the same
 * CRUD operations against a specific IndexedDB object store. Instead of passing
 * magic string store names through a god-object, each subclass declares its store
 * name once, and all operations are automatically scoped to that store. This:
 *   1. Eliminates store-name typos at the call site
 *   2. Gives each domain a typed surface area for domain-specific helpers
 *   3. Centralises the serialisation concern (e.g. JSON.parse/stringify for proxies)
 */
export class BaseStore {
  constructor(storeName) {
    this.storeName = storeName;
  }

  async get(key) {
    const db = await database.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async set(key, value) {
    const db = await database.init();
    // Deep-clone to strip Vue Proxy wrappers and other non-cloneable objects
    const plain = JSON.parse(JSON.stringify(value));
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(plain, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async remove(key) {
    const db = await database.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear() {
    const db = await database.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
