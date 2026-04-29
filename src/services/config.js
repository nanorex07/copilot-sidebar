import { settingsStore } from './storage';
import { CONFIG_KEYS, DEFAULT_AGENT_LIMITS, DEFAULT_PAGE_EXTRACTION } from '../config/constants';

/**
 * ConfigService — In-memory cache for dynamic application configuration.
 *
 * Design rationale: Tools and the agent loop need synchronous access to config
 * values during execution. This service loads persisted overrides from the
 * SettingsStore on init and merges them over hardcoded defaults. The `save()`
 * method writes through to both the in-memory cache and the store.
 */
class ConfigService {
  constructor() {
    this._initialised = false;
    this.config = {
      [CONFIG_KEYS.AGENT_LIMITS]: { ...DEFAULT_AGENT_LIMITS },
      [CONFIG_KEYS.PAGE_EXTRACTION]: { ...DEFAULT_PAGE_EXTRACTION }
    };
  }

  async init() {
    if (this._initialised) return;

    const limits = await settingsStore.getConfig(CONFIG_KEYS.AGENT_LIMITS);
    if (limits) this.config[CONFIG_KEYS.AGENT_LIMITS] = { ...this.config[CONFIG_KEYS.AGENT_LIMITS], ...limits };

    const extraction = await settingsStore.getConfig(CONFIG_KEYS.PAGE_EXTRACTION);
    if (extraction) this.config[CONFIG_KEYS.PAGE_EXTRACTION] = { ...this.config[CONFIG_KEYS.PAGE_EXTRACTION], ...extraction };

    this._initialised = true;
  }

  get(key) {
    return this.config[key];
  }

  async save(key, value) {
    const plainValue = JSON.parse(JSON.stringify(value));
    this.config[key] = plainValue;
    await settingsStore.saveConfig(key, plainValue);
  }
}

export const configService = new ConfigService();
