import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getToolHandler, TERMINAL_TOOLS, INTERRUPT_TOOLS } from '../../src/tools/registry';
import { CONTENT_ACTIONS } from '../../src/config/constants';
import { configService } from '../../src/services/config';

// Mock configService since registry relies on it for limits
vi.mock('../../src/services/config', () => ({
  configService: {
    get: vi.fn()
  }
}));

describe('Tool Registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementation for config values
    configService.get.mockImplementation((key) => {
      if (key === 'page_extraction') {
        return {
          ACCESSIBILITY_TREE_MAX_DEPTH: 20,
          ACCESSIBILITY_TREE_MAX_NODES: 2000,
          PAGE_TEXT_EXTRACTION_THRESHOLD: 10000,
          FIND_MAX_RESULTS: 10,
          FIND_TEXT_MAX_RESULTS: 20
        };
      }
      return {};
    });
  });

  describe('getToolHandler()', () => {
    it('should return null for unknown tools', () => {
      expect(getToolHandler('non_existent_tool')).toBeNull();
    });

    it('should correctly expose TERMINAL_TOOLS', () => {
      expect(TERMINAL_TOOLS.has('done')).toBe(true);
      expect(TERMINAL_TOOLS.has('fail')).toBe(true);
      expect(TERMINAL_TOOLS.has('click')).toBe(false);
    });

    it('should correctly expose INTERRUPT_TOOLS', () => {
      expect(INTERRUPT_TOOLS.has('human_in_the_loop')).toBe(true);
      expect(INTERRUPT_TOOLS.has('human_context')).toBe(true);
      expect(INTERRUPT_TOOLS.has('done')).toBe(false);
    });
  });

  describe('read_page tool', () => {
    const handler = getToolHandler('read_page');

    it('should map to READ_PAGE action', () => {
      expect(handler.contentAction).toBe(CONTENT_ACTIONS.READ_PAGE);
    });

    it('should build payload with config limits and mode', () => {
      const payload = handler.buildPayload({ mode: 'compact' });
      expect(payload).toEqual({
        maxDepth: 20,
        maxNodes: 2000,
        viewportOnly: true
      });
      
      const fullPayload = handler.buildPayload({ mode: 'full' });
      expect(fullPayload.viewportOnly).toBe(false);
    });

    it('should format result correctly', () => {
      expect(handler.formatResult({ interactiveCount: 42 })).toBe('Found 42 interactive elements on the page.');
      expect(handler.formatResult(null)).toBe('Found 0 interactive elements on the page.');
    });
  });

  describe('type tool', () => {
    const handler = getToolHandler('type');

    it('should build payload for executeAction', () => {
      const payload = handler.buildPayload({ target: 5, text: 'Hello', enter: true });
      expect(payload).toEqual({
        type: 'type',
        target: 5,
        params: { text: 'Hello', enter: true }
      });
    });

    it('should default enter to false if not provided', () => {
      const payload = handler.buildPayload({ target: 5, text: 'World' });
      expect(payload.params.enter).toBe(false);
    });

    it('should format result correctly', () => {
      expect(handler.formatResult({ description: 'Typed Hello' })).toBe('Typed Hello');
      expect(handler.formatResult(null)).toBe('Typed text.');
    });
  });

  describe('scroll tool', () => {
    const handler = getToolHandler('scroll');

    it('should map directions correctly with default amount', () => {
      const payload = handler.buildPayload({ direction: 'down' });
      expect(payload).toEqual({
        type: 'scroll',
        target: 'down',
        params: { amount: 500 }
      });
    });

    it('should accept custom scroll amount', () => {
      const payload = handler.buildPayload({ direction: 'up', amount: 800 });
      expect(payload.params.amount).toBe(800);
    });
  });

  describe('find_text tool', () => {
    const handler = getToolHandler('find_text');

    it('should map to FIND_TEXT action with config limits', () => {
      const payload = handler.buildPayload({ query: 'login' });
      expect(payload).toEqual({
        query: 'login',
        maxResults: 20,
        scrollToFirst: true
      });
    });

    it('should format text matches correctly', () => {
      expect(handler.formatResult({ count: 5, query: 'login' })).toBe('Found 5 text matches for "login".');
    });
  });
});
