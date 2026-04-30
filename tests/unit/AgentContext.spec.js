import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentContext } from '../../src/services/agent/AgentContext';
import { historyStore } from '../../src/services/storage';
import { STEP_TYPES } from '../../src/config/constants';
import { SUMMARIZATION_PROMPT } from '../../src/config/prompts';

// Mock the storage dependency
vi.mock('../../src/services/storage', () => ({
  historyStore: {
    getSession: vi.fn(),
    saveSession: vi.fn(),
    clearSession: vi.fn(),
  }
}));

describe('AgentContext', () => {
  let context;
  const sessionId = 'test-session-123';

  beforeEach(() => {
    vi.clearAllMocks();
    context = new AgentContext(sessionId);
  });

  describe('Initialization', () => {
    it('should initialize with an empty history by default', () => {
      expect(context.history).toEqual([]);
      expect(context.sessionId).toBe(sessionId);
      expect(context.getMessagesCount()).toBe(0);
    });

    it('should load history from historyStore during init() if available', async () => {
      const mockHistory = [{ role: 'user', content: 'hello' }];
      historyStore.getSession.mockResolvedValueOnce(mockHistory);

      await context.init();

      expect(historyStore.getSession).toHaveBeenCalledWith(sessionId);
      expect(context.history).toEqual(mockHistory);
    });

    it('should remain empty if historyStore returns null', async () => {
      historyStore.getSession.mockResolvedValueOnce(null);

      await context.init();

      expect(context.history).toEqual([]);
    });
  });

  describe('Storage Operations', () => {
    it('persist() should save current history to historyStore', async () => {
      context.addEntry({ role: 'assistant', content: 'Hi' });
      await context.persist();

      expect(historyStore.saveSession).toHaveBeenCalledWith(sessionId, [
        { role: 'assistant', content: 'Hi' }
      ]);
    });

    it('clear() should empty history and clear historyStore', async () => {
      context.addEntry({ role: 'user', content: 'test' });
      await context.clear();

      expect(context.history).toEqual([]);
      expect(historyStore.clearSession).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('Message Management', () => {
    it('addEntry() should append messages', () => {
      context.addEntry({ role: 'user', content: 'msg 1' });
      context.addEntry({ role: 'assistant', content: 'msg 2' });

      expect(context.getMessagesCount()).toBe(2);
      expect(context.history[1].content).toBe('msg 2');
    });

    it('buildLLMMessages() should strip UI-specific keys and preserve required LLM structure', () => {
      context.addEntry({ role: 'user', content: 'test', ui_only_key: 'ignore_me' });
      context.addEntry({ role: 'assistant', content: null, tool_calls: [{ id: '1' }] });
      context.addEntry({ role: 'tool', content: 'result', tool_call_id: '1' });

      const llmMessages = context.buildLLMMessages();

      expect(llmMessages).toEqual([
        { role: 'user', content: 'test' },
        { role: 'assistant', content: null, tool_calls: [{ id: '1' }] },
        { role: 'tool', content: 'result', tool_call_id: '1' }
      ]);
      // Ensure ui_only_key was stripped
      expect(llmMessages[0]).not.toHaveProperty('ui_only_key');
    });

    it('buildLLMMessages() should correctly truncate history from the last summary', () => {
      context.addEntry({ role: 'user', content: 'msg 1' });
      context.addEntry({ role: 'assistant', content: 'msg 2' });
      context.addEntry({ role: 'user', content: '[CONTEXT SUMMARY]', _isSummary: true });
      context.addEntry({ role: 'user', content: 'msg 4' });

      const llmMessages = context.buildLLMMessages();

      // Should only contain the summary message and everything after it
      expect(llmMessages.length).toBe(2);
      expect(llmMessages[0].content).toBe('[CONTEXT SUMMARY]');
      expect(llmMessages[1].content).toBe('msg 4');
    });
  });

  describe('Summarization', () => {
    it('summarize() should invoke provider, add summary to history, persist, and notify', async () => {
      const providerMock = {
        chat: vi.fn().mockResolvedValue({ message: { content: 'Summary of discussion.' } })
      };
      const notifyMock = vi.fn();

      context.addEntry({ role: 'user', content: 'long conversation...' });

      await context.summarize(providerMock, 'System Prompt', notifyMock);

      // Verify Provider was called with correct payload
      expect(providerMock.chat).toHaveBeenCalledTimes(1);
      const callArgs = providerMock.chat.mock.calls[0][0];

      expect(callArgs[0]).toEqual({ role: 'system', content: 'System Prompt' });
      expect(callArgs[callArgs.length - 1]).toEqual({ role: 'user', content: SUMMARIZATION_PROMPT });

      // Verify history was updated with the summary
      expect(context.history[context.history.length - 1]._isSummary).toBe(true);
      expect(context.history[context.history.length - 1].content).toContain('Summary of discussion.');

      // Verify persistence and notification
      expect(historyStore.saveSession).toHaveBeenCalled();
      expect(notifyMock).toHaveBeenCalledWith(STEP_TYPES.ACTION, 'Context has been summarized.');
    });

    it('summarize() should catch errors gracefully without throwing', async () => {
      const providerMock = {
        chat: vi.fn().mockRejectedValue(new Error('API failure'))
      };
      const notifyMock = vi.fn();

      // Spy on console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      await context.summarize(providerMock, 'Prompt', notifyMock);

      expect(consoleSpy).toHaveBeenCalledWith('[AgentContext] Summarization failed:', expect.any(Error));
      expect(notifyMock).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
