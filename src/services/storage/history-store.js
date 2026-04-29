import { BaseStore } from './base-store';
import { STORAGE_STORES } from '../../config/constants';

/**
 * HistoryStore — Manages agent conversation history.
 *
 * Each session gets its own key. The store provides typed helpers
 * for loading, saving, and clearing session histories.
 */
class HistoryStore extends BaseStore {
  constructor() {
    super(STORAGE_STORES.HISTORY);
  }

  async getSession(sessionId) {
    return (await this.get(sessionId)) || [];
  }

  async saveSession(sessionId, history) {
    await this.set(sessionId, history);
  }

  async clearSession(sessionId) {
    await this.remove(sessionId);
  }
}

export const historyStore = new HistoryStore();
