import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configService } from '../../src/services/config';
import { settingsStore } from '../../src/services/storage';
import { CONFIG_KEYS, DEFAULT_AGENT_LIMITS, DEFAULT_PAGE_EXTRACTION, DEFAULT_USER_SETTINGS } from '../../src/config/constants';

// Mock the settingsStore
vi.mock('../../src/services/storage', () => ({
  settingsStore: {
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
  }
}));

describe('ConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset config service internal state to test initialisation cleanly
    configService._initialised = false;
    configService.config = {
      [CONFIG_KEYS.AGENT_LIMITS]: { ...DEFAULT_AGENT_LIMITS },
      [CONFIG_KEYS.PAGE_EXTRACTION]: { ...DEFAULT_PAGE_EXTRACTION },
      [CONFIG_KEYS.USER_SETTINGS]: { ...DEFAULT_USER_SETTINGS }
    };
  });

  describe('init()', () => {
    it('should initialize with defaults if storage is empty', async () => {
      settingsStore.getConfig.mockResolvedValue(null);

      await configService.init();

      expect(settingsStore.getConfig).toHaveBeenCalledTimes(3);
      expect(configService.get(CONFIG_KEYS.AGENT_LIMITS)).toEqual(DEFAULT_AGENT_LIMITS);
      expect(configService.get(CONFIG_KEYS.PAGE_EXTRACTION)).toEqual(DEFAULT_PAGE_EXTRACTION);
      expect(configService.get(CONFIG_KEYS.USER_SETTINGS)).toEqual(DEFAULT_USER_SETTINGS);
      expect(configService._initialised).toBe(true);
    });

    it('should merge saved configurations with defaults', async () => {
      // Mock some partial configurations
      settingsStore.getConfig.mockImplementation((key) => {
        if (key === CONFIG_KEYS.AGENT_LIMITS) return { AGENT_MAX_STEPS: 999 }; // override one key
        if (key === CONFIG_KEYS.USER_SETTINGS) return { customInstructions: 'Test instruction' };
        return null;
      });

      await configService.init();

      // Ensure the override was applied but defaults remain for other properties
      const limits = configService.get(CONFIG_KEYS.AGENT_LIMITS);
      expect(limits.AGENT_MAX_STEPS).toBe(999);
      expect(limits.AGENT_MAX_TOOL_ERRORS).toBe(DEFAULT_AGENT_LIMITS.AGENT_MAX_TOOL_ERRORS);

      const userSettings = configService.get(CONFIG_KEYS.USER_SETTINGS);
      expect(userSettings.customInstructions).toBe('Test instruction');
    });

    it('should not re-initialize if already initialised', async () => {
      configService._initialised = true;
      
      await configService.init();

      expect(settingsStore.getConfig).not.toHaveBeenCalled();
    });
  });

  describe('save()', () => {
    it('should update in-memory cache and write through to settingsStore', async () => {
      const newLimits = { AGENT_MAX_STEPS: 10 };
      
      await configService.save(CONFIG_KEYS.AGENT_LIMITS, newLimits);

      // Verify memory cache updated
      expect(configService.get(CONFIG_KEYS.AGENT_LIMITS)).toEqual(newLimits);
      
      // Verify store updated with deep clone
      expect(settingsStore.saveConfig).toHaveBeenCalledWith(CONFIG_KEYS.AGENT_LIMITS, newLimits);
    });

    it('should perform deep cloning to prevent reference leaks', async () => {
      const payload = { nested: { array: [1, 2, 3] } };
      
      await configService.save('test_key', payload);
      
      const savedCallArg = settingsStore.saveConfig.mock.calls[0][1];
      expect(savedCallArg).toEqual(payload);
      expect(savedCallArg).not.toBe(payload); // Must be a separate instance
    });
  });
});
