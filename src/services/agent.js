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
      this.status = 'thinking';
      this._aborted = false;
      this._notifyStatus();

      try {
         const provider = await this._getProvider();
         const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...this._buildLLMMessages(),
            { role: 'user', content: goal }
         ];

         this.history.push({ role: 'user', content: goal, timestamp: this._timestamp() });

         let step = 0;
         let errorCount = 0;

         while (step < AGENT_MAX_STEPS && errorCount < AGENT_MAX_TOOL_ERRORS && !this._aborted) {
            step++;

            const response = await this._callLLM(provider, messages);
            if (!response) {
               errorCount++;
               if (errorCount >= AGENT_MAX_TOOL_ERRORS) {
                  this._notifyStep(STEP_TYPES.ERROR, `Reached maximum tool errors (${AGENT_MAX_TOOL_ERRORS}). Task aborted.`);
                  this.history.push({ role: 'assistant', content: `Task aborted: too many errors (${errorCount}).`, timestamp: this._timestamp() });
                  await this._persistHistory();
                  break;
               }
               continue;
            }

            const assistantMsg = response.message;
            const isDone = await this._handleAssistantResponse(assistantMsg, messages);
            if (isDone) break;

            // Process each tool call
            let taskFinished = false;
            if (assistantMsg.tool_calls) {
               for (const toolCall of assistantMsg.tool_calls) {
                  if (this._aborted) break;
                  const execResult = await this._executeToolCall(toolCall, messages);
                  if (!execResult.success) errorCount++;
                  if (execResult.terminal) {
                     taskFinished = true;
                     break;
                  }
               }
            }

            await this._persistHistory();
            if (taskFinished) break;
         }

         this._handleLoopEnd(step, errorCount);
      } catch (error) {
         this._notifyStep(STEP_TYPES.ERROR, error.message);
         console.error('[Agent Error]', error);
      } finally {
         this.status = 'idle';
         this._notifyStatus();
      }
   }

   async _getProvider() {
      const config = await storage.get(STORAGE_STORES.SETTINGS, LLM_PROVIDERS.OPENAI);
      return createLLMProvider(LLM_PROVIDERS.OPENAI, config);
   }

   async _callLLM(provider, messages) {
      try {
         this._notifyStatus('thinking');
         const response = await provider.chat(messages, TOOLS);
         this._notifyStatus('running');
         return response;
      } catch (err) {
         this._notifyStep(STEP_TYPES.ERROR, `LLM call failed: ${err.message}`);
         return null;
      }
   }

   async _handleAssistantResponse(assistantMsg, messages) {
      // If no tool calls, it's a direct response
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
         const text = assistantMsg.content || '';
         messages.push({ role: 'assistant', content: text });
         this.history.push({ role: 'assistant', content: text, timestamp: this._timestamp() });
         await this._persistHistory();
         this._notifyStep(STEP_TYPES.SUCCESS, text);
         return true;
      }

      // Add assistant message with tool_calls to conversation
      messages.push({
         role: 'assistant',
         content: assistantMsg.content || null,
         tool_calls: assistantMsg.tool_calls,
      });

      // Notify UI of reasoning if present
      if (assistantMsg.content) {
         this._notifyStep(STEP_TYPES.THOUGHT, assistantMsg.content);
      }

      this.history.push({
         role: 'assistant',
         content: assistantMsg.content || null,
         tool_calls: assistantMsg.tool_calls,
         timestamp: this._timestamp(),
      });

      return false;
   }

   async _executeToolCall(toolCall, messages) {
      const toolName = toolCall.function.name;
      let toolArgs = {};
      try {
         toolArgs = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
         toolArgs = {};
      }

      // 1. Handle Terminal Tools
      if (TERMINAL_TOOLS.has(toolName)) {
         await this._handleTerminalExecution(toolCall, toolName, toolArgs, messages);
         return { success: true, terminal: true };
      }

      // 2. Handle Content Script Tools
      const actionLabel = this._getToolActionLabel(toolName, toolArgs);
      this._notifyStep(STEP_TYPES.ACTION, actionLabel);

      const handler = getToolHandler(toolName);
      if (!handler) {
         await this._handleUnknownTool(toolCall, toolName, toolArgs, messages);
         return { success: false, terminal: false };
      }

      const payload = handler.buildPayload(toolArgs);
      let result;
      try {
         result = await this._sendToContent(handler.contentAction, payload);
      } catch (err) {
         result = { success: false, error: err.message };
      }

      const summary = handler.formatResult(result);
      this._recordToolResult(toolCall, toolName, toolArgs, result, summary, messages);
      return { success: result.success !== false, terminal: false };
   }

   async _handleTerminalExecution(toolCall, toolName, toolArgs, messages) {
      const toolResult = this._handleTerminalTool(toolName, toolArgs);
      const toolResultStr = JSON.stringify(toolResult);

      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResultStr });
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
         this._notifyStep(STEP_TYPES.SUCCESS, answer);
         this.status = 'idle';
         this._notifyStatus();
      } else if (toolName === 'fail') {
         const reason = toolArgs.reason || 'Task failed.';
         this.history.push({ role: 'assistant', content: `Failed: ${reason}`, timestamp: this._timestamp() });
         await this._persistHistory();
         this._notifyStep(STEP_TYPES.ERROR, reason);
         this.status = 'idle';
         this._notifyStatus();
      }
      return true;
   }

   async _handleUnknownTool(toolCall, toolName, toolArgs, messages) {
      const errorResult = { success: false, error: `Unknown tool: ${toolName}` };
      this._recordToolResult(toolCall, toolName, toolArgs, errorResult, `Unknown tool: ${toolName}`, messages);
      return false;
   }

   _recordToolResult(toolCall, toolName, toolArgs, result, summary, messages) {
      const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
      const truncatedResult = resultStr.slice(0, 30000);

      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: truncatedResult });
      this.history.push({
         role: 'tool',
         tool_call_id: toolCall.id,
         content: truncatedResult,
         _meta: { toolName, toolArgs, summary, result },
         timestamp: this._timestamp(),
      });

      this._notifyStep(STEP_TYPES.TOOL_CALL, JSON.stringify({ tool: toolName, args: toolArgs, result, summary }));
   }

   _handleLoopEnd(step, errorCount) {
      if (step >= AGENT_MAX_STEPS && !this._aborted) {
         this._notifyStep(STEP_TYPES.ERROR, `Reached maximum steps (${AGENT_MAX_STEPS}). Task stopped.`);
         this.history.push({ role: 'assistant', content: `Task stopped: reached maximum steps (${AGENT_MAX_STEPS}).`, timestamp: this._timestamp() });
         this._persistHistory();
      } else if (errorCount >= AGENT_MAX_TOOL_ERRORS && !this._aborted) {
         this._notifyStep(STEP_TYPES.ERROR, `Reached maximum tool errors (${AGENT_MAX_TOOL_ERRORS}). Task aborted.`);
         this.history.push({ role: 'assistant', content: `Task aborted: too many errors (${errorCount}).`, timestamp: this._timestamp() });
         this._persistHistory();
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
    * Get the active tab ID
    */
   async _getActiveTabId() {
      return new Promise((resolve, reject) => {
         chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) {
               reject(new Error('No active tab found.'));
            } else {
               resolve(tabs[0].id);
            }
         });
      });
   }

   /**
    * Send a message to the content script in the active tab.
    * If the content script is not available (page navigated, not yet injected, etc.),
    * automatically re-injects it and retries once.
    *
    * Pattern from reference project: detect "Receiving end does not exist" →
    * chrome.scripting.executeScript → wait → retry.
    */
   async _sendToContent(action, payload) {
      const tabId = await this._getActiveTabId();

      try {
         const response = await this._trySendMessage(tabId, action, payload);
         return response;
      } catch (err) {
         const msg = String(err?.message || err);
         const needsInjection =
            msg.includes('Receiving end does not exist') ||
            msg.includes('Could not establish connection');

         if (needsInjection) {
            console.log('[Agent] Content script not available, re-injecting...');
            try {
               await chrome.scripting.executeScript({
                  target: { tabId },
                  files: ['content.js'],
               });
               // Wait for script to initialize
               await this._sleep(300);
               const retryResponse = await this._trySendMessage(tabId, action, payload);
               return retryResponse;
            } catch (injectErr) {
               throw new Error(`Content script injection failed: ${injectErr.message}`);
            }
         }

         throw err;
      }
   }

   /**
    * Low-level message send wrapped in a promise.
    */
   _trySendMessage(tabId, action, payload) {
      return new Promise((resolve, reject) => {
         chrome.tabs.sendMessage(tabId, { action, payload }, (response) => {
            if (chrome.runtime.lastError) {
               reject(new Error(chrome.runtime.lastError.message));
            } else {
               resolve(response ?? { success: false, error: 'Empty response from content script' });
            }
         });
      });
   }

   /**
    * Simple sleep utility
    */
   _sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
   }

   /**
    * Get basic page context (fallback for initial context)
    */
   async _getPageContext() {
      try {
         const result = await this._sendToContent('getPageText', {
            scope: 'full',
            maxChars: PAGE_TEXT_EXTRACTION_THRESHOLD
         });
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

   _getToolActionLabel(tool, args) {
      switch (tool) {
         case 'read_page': return 'Reading page content...';
         case 'get_page_text': return 'Extracting text from page...';
         case 'find': return `Looking for "${args.query}"...`;
         case 'find_text': return `Searching for text "${args.query}"...`;
         case 'click': return `Clicking on [${args.target}]...`;
         case 'type': return `Typing into [${args.target}]...`;
         case 'select': return `Selecting value in [${args.target}]...`;
         case 'scroll': return `Scrolling ${args.direction}...`;
         case 'hover': return `Hovering over [${args.target}]...`;
         case 'press_key': return `Pressing ${args.key} key...`;
         case 'extract_structured': return `Extracting structured data...`;
         case 'wait_for': return `Waiting for ${args.condition}...`;
         case 'navigate': return `Navigating ${args.action}...`;
         case 'done': return 'Finishing task...';
         case 'fail': return 'Reporting failure...';
         default: return `Executing ${tool}...`;
      }
   }
}
