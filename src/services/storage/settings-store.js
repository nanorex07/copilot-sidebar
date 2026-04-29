import { BaseStore } from './base-store';
import { STORAGE_STORES } from '../../config/constants';

/**
 * SettingsStore — Manages all application settings (LLM config, agent limits, etc.)
 *
 * Each logical settings group is stored under its own key (e.g. 'openai', 'agent_limits').
 * This store is the single point of contact for any settings persistence.
 */
class SettingsStore extends BaseStore {
  constructor() {
    super(STORAGE_STORES.SETTINGS);
  }

  async getConfig(key) {
    return await this.get(key);
  }

  async saveConfig(key, value) {
    await this.set(key, value);
  }
}

export const settingsStore = new SettingsStore();
