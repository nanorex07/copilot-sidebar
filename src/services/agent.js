import { storage } from './storage';
import { createLLMProvider } from './llm';
import { SYSTEM_PROMPT } from '../sidepanel/prompts/system';
import { TOOLS } from '../tools/definitions';
import { getToolHandler, TERMINAL_TOOLS } from '../tools/registry';
import {
  LLM_PROVIDERS,
  STEP_TYPES,
  PAGE_TEXT_EXTRACTION_THRESHOLD,
  STORAGE_STORES,
  AGENT_MAX_STEPS,
  AGENT_MAX_TOOL_ERRORS,
} from '../config/constants';

/**
 * Agent Class — Orchestrates the observe → think → act loop.
 *
 * Flow:
 *   1. User sends a goal
 *   2. Agent gathers page context
 *   3. Agent calls LLM with tools
 *   4. If LLM returns tool_calls → execute them → feed results back → loop
 *   5. If LLM returns text content (or calls done/fail) → stop
 */
export class Agent {
  constructor(sessionId = 'default') {
    this.sessionId = sessionId;
    this.history = [];
    this.status = 'idle';
    this._onStep = null;
    this._onStatus = null;
    this._aborted = false;
  }

  async init() {
    const savedHistory = await storage.get(STORAGE_STORES.HISTORY, this.sessionId);
    if (savedHistory) {
      this.history = savedHistory;
    }
  }

  onStep(callback) { this._onStep = callback; }
  onStatus(callback) { this._onStatus = callback; }

  /**
   * Abort the current agent loop
   */
  abort() {
    this._aborted = true;
  }

  /**
   * Main entry point — run the agent loop for a goal.
   */
  async run(goal) {
    this.status = 'running';
    this._aborted = false;
    this._notifyStatus();

    try {
      // 1. Load provider config
      const config = await storage.get(STORAGE_STORES.SETTINGS, LLM_PROVIDERS.OPENAI);
      if (!config || !config.apiKey) {
        throw new Error('API Key not found. Please configure it in Settings.');
      }
      const provider = createLLMProvider(LLM_PROVIDERS.OPENAI, config);

      // 2. Gather initial page context
      this._notifyStep(STEP_TYPES.ACTION, 'Reading page...');
      let context = await this._getPageContext();
      if (context.text && context.text.length > PAGE_TEXT_EXTRACTION_THRESHOLD) {
        context.text = context.text.slice(0, PAGE_TEXT_EXTRACTION_THRESHOLD);
      }

      // 3. Build initial messages
      const pageInfo = `\n<page_context>\nURL: ${context.url}\nTitle: ${context.title}\nContent:\n${context.text}\n</page_context>`;
      const fullSystemPrompt = `${SYSTEM_PROMPT}\n${pageInfo}`;

      const timestamp = this._timestamp();
      this.history.push({ role: 'user', content: goal, timestamp });

      // Build conversation messages for LLM (only fields OpenAI understands)
      const messages = [
        { role: 'system', content: fullSystemPrompt },
        ...this._buildLLMMessages(),
      ];

      // 4. Agent loop
      let step = 0;
      let errorCount = 0;

      while (step < AGENT_MAX_STEPS && errorCount < AGENT_MAX_TOOL_ERRORS && !this._aborted) {
        step++;
        this._notifyStep(STEP_TYPES.THOUGHT, `Step ${step}: Thinking...`);

        // Call LLM
        let response;
        try {
          response = await provider.chatWithTools(messages, TOOLS);
        } catch (err) {
          errorCount++;
          this._notifyStep(STEP_TYPES.ERROR, `LLM call failed: ${err.message}`);
          if (errorCount >= AGENT_MAX_TOOL_ERRORS) break;
          continue;
        }

        const assistantMsg = response.message;

        // If assistant has text content (no tool calls), we're done
        if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
          const text = assistantMsg.content || '';
          messages.push({ role: 'assistant', content: text });
          this.history.push({ role: 'assistant', content: text, timestamp: this._timestamp() });
          await this._persistHistory();
          this._notifyStep(STEP_TYPES.SUCCESS, text);
          break;
        }

        // Add assistant message with tool_calls to conversation
        messages.push({
          role: 'assistant',
          content: assistantMsg.content || null,
          tool_calls: assistantMsg.tool_calls,
        });

        // Also persist the assistant tool_calls to history
        this.history.push({
          role: 'assistant',
          content: assistantMsg.content || null,
          tool_calls: assistantMsg.tool_calls,
          timestamp: this._timestamp(),
        });

        // Process each tool call
        for (const toolCall of assistantMsg.tool_calls) {
          if (this._aborted) break;

          const toolName = toolCall.function.name;
          let toolArgs = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            toolArgs = {};
          }

          // Handle terminal tools
          if (TERMINAL_TOOLS.has(toolName)) {
            const toolResult = this._handleTerminalTool(toolName, toolArgs);
            const toolResultStr = JSON.stringify(toolResult);

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResultStr,
            });

            // Persist tool result
            this.history.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResultStr,
              _meta: { toolName, toolArgs, summary: toolName === 'done' ? 'Task complete' : toolArgs.reason, result: toolResult },
              timestamp: this._timestamp(),
            });

            if (toolName === 'done') {
              const answer = toolArgs.answer || toolArgs.summary || '';
              this.history.push({ role: 'assistant', content: answer, timestamp: this._timestamp() });
              await this._persistHistory();
              this._notifyStep(STEP_TYPES.TOOL_CALL, JSON.stringify({ tool: toolName, args: toolArgs, result: toolResult, summary: 'Task complete' }));
              this._notifyStep(STEP_TYPES.SUCCESS, answer);
              this.status = 'idle';
              this._notifyStatus();
              return;
            }
            if (toolName === 'fail') {
              const reason = toolArgs.reason || 'Task failed.';
              this.history.push({ role: 'assistant', content: `Failed: ${reason}`, timestamp: this._timestamp() });
              await this._persistHistory();
              this._notifyStep(STEP_TYPES.TOOL_CALL, JSON.stringify({ tool: toolName, args: toolArgs, result: toolResult, summary: `Failed: ${reason}` }));
              this._notifyStep(STEP_TYPES.ERROR, reason);
              this.status = 'idle';
              this._notifyStatus();
              return;
            }
            continue;
          }

          // Execute tool via content script
          const handler = getToolHandler(toolName);
          if (!handler) {
            const errorResult = { success: false, error: `Unknown tool: ${toolName}` };
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(errorResult),
            });
            this.history.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(errorResult),
              _meta: { toolName, toolArgs, summary: `Unknown tool: ${toolName}`, result: errorResult },
              timestamp: this._timestamp(),
            });
            this._notifyStep(STEP_TYPES.TOOL_CALL, JSON.stringify({ tool: toolName, args: toolArgs, result: errorResult, summary: `Unknown tool: ${toolName}` }));
            errorCount++;
            continue;
          }

          const payload = handler.buildPayload(toolArgs);
          let result;
          try {
            result = await this._sendToContent(handler.contentAction, payload);
          } catch (err) {
            result = { success: false, error: err.message };
            errorCount++;
          }

          // Format summary
          const summary = handler.formatResult(result);

          // Add tool result to LLM conversation
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: resultStr.slice(0, 30000),
          });

          // Persist tool result to history
          this.history.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: resultStr.slice(0, 30000),
            _meta: { toolName, toolArgs, summary, result },
            timestamp: this._timestamp(),
          });

          // Notify UI — single combined event with args + result
          this._notifyStep(STEP_TYPES.TOOL_CALL, JSON.stringify({ tool: toolName, args: toolArgs, result, summary }));
        }

        // Persist after each batch of tool calls
        await this._persistHistory();
      }

      // Loop ended without done/fail
      if (step >= AGENT_MAX_STEPS && !this._aborted) {
        this._notifyStep(STEP_TYPES.ERROR, `Reached maximum steps (${AGENT_MAX_STEPS}). Task stopped.`);
        this.history.push({ role: 'assistant', content: 'Task stopped: max steps reached.', timestamp: this._timestamp() });
        await this._persistHistory();
      }

    } catch (error) {
      this._notifyStep(STEP_TYPES.ERROR, error.message);
      console.error('[Agent Error]', error);
    } finally {
      this.status = 'idle';
      this._notifyStatus();
    }
  }

  /**
   * Build LLM-compatible messages from history.
   * Strips our custom _meta fields and timestamps.
   */
  _buildLLMMessages() {
    return this.history.map((entry) => {
      const msg = { role: entry.role, content: entry.content || null };
      if (entry.tool_call_id) msg.tool_call_id = entry.tool_call_id;
      if (entry.tool_calls) msg.tool_calls = entry.tool_calls;
      return msg;
    });
  }

  /**
   * Handle done/fail tools directly
   */
  _handleTerminalTool(toolName, args) {
    if (toolName === 'done') {
      return { success: true, summary: args.summary, answer: args.answer || '' };
    }
    if (toolName === 'fail') {
      return { success: false, reason: args.reason };
    }
    return { success: false, error: 'Unknown terminal tool' };
  }

  /**
   * Send a message to the content script in the active tab
   */
  async _sendToContent(action, payload) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
          reject(new Error('No active tab found.'));
          return;
        }
        chrome.tabs.sendMessage(tabs[0].id, { action, payload }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    });
  }

  /**
   * Get basic page context (fallback for initial context)
   */
  async _getPageContext() {
    try {
      const result = await this._sendToContent('getPageText', { scope: 'full', maxChars: 8000 });
      return {
        url: result?.url || 'N/A',
        title: result?.title || 'N/A',
        text: result?.text || '',
      };
    } catch {
      return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve({
            url: tabs[0]?.url || 'N/A',
            title: tabs[0]?.title || 'N/A',
            text: 'Could not extract page content.',
          });
        });
      });
    }
  }

  async clearHistory() {
    this.history = [];
    await storage.remove(STORAGE_STORES.HISTORY, this.sessionId);
  }

  async _persistHistory() {
    await storage.set(STORAGE_STORES.HISTORY, this.sessionId, this.history);
  }

  _timestamp() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  _notifyStep(type, content) {
    if (this._onStep) {
      this._onStep({ type, content, timestamp: this._timestamp() });
    }
  }

  _notifyStatus() {
    if (this._onStatus) this._onStatus(this.status);
  }
}
