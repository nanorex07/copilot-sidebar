import { storage } from './storage';
import { STORAGE_STORES, CONFIG_KEYS, DEFAULT_AGENT_LIMITS, DEFAULT_PAGE_EXTRACTION } from '../config/constants';

class ConfigService {
  constructor() {
    this.config = {
      agent_limits: { ...DEFAULT_AGENT_LIMITS },
      page_extraction: { ...DEFAULT_PAGE_EXTRACTION }
    };
  }

  async init() {
    const limits = await storage.get(STORAGE_STORES.SETTINGS, CONFIG_KEYS.AGENT_LIMITS);
    if (limits) this.config.agent_limits = { ...this.config.agent_limits, ...limits };

    const extraction = await storage.get(STORAGE_STORES.SETTINGS, CONFIG_KEYS.PAGE_EXTRACTION);
    if (extraction) this.config.page_extraction = { ...this.config.page_extraction, ...extraction };
  }

  get(key) {
    return this.config[key];
  }

  async save(key, value) {
    const plainValue = JSON.parse(JSON.stringify(value));
    this.config[key] = plainValue;
    await storage.set(STORAGE_STORES.SETTINGS, key, plainValue);
  }
}

export const configService = new ConfigService();
