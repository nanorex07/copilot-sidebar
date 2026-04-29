import { STORAGE_DB_NAME, STORAGE_STORES } from '../../config/constants';

/**
 * Database — Thin singleton managing the IndexedDB connection.
 *
 * Design rationale: The connection and schema setup are a separate concern from
 * domain-level store operations. All domain stores delegate their raw transactions
 * through this single shared connection.
 */
class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(STORAGE_DB_NAME, 2);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        Object.values(STORAGE_STORES).forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        });
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(`IndexedDB error: ${event.target.errorCode}`);
      };
    });
  }
}

export const database = new Database();
