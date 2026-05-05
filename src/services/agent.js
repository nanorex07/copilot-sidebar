import { settingsStore } from './storage';
import { createLLMProvider } from './llm';
import { SYSTEM_PROMPT } from '../config/prompts';
import { TOOLS } from '../tools/definitions';
import { configService } from './config';
import { LLM_PROVIDERS, STEP_TYPES, CONFIG_KEYS } from '../config/constants';
import { AgentContext } from './agent/AgentContext';
import { AgentTools } from './agent/AgentTools';

/**
 * Agent Class — Orchestrates the observe → think → act loop.
 */
export class Agent {
   constructor(sessionId = 'default') {
      this.sessionId = sessionId;
      this.context = new AgentContext(sessionId);
      this.status = 'idle';
      this._onStep = null;
      this._onStatus = null;
      this._onHumanInput = null;
      this._aborted = false;
      this._abortController = null;
      this._pendingHumanInput = null;
   }

   async init() {
      await configService.init();
      await this.context.init();
   }

   // For backward compatibility with UI components that read history directly
   get history() {
      return this.context.history;
   }

   onStep(callback) { this._onStep = callback; }
   onStatus(callback) { this._onStatus = callback; }
   onHumanInput(callback) { this._onHumanInput = callback; }

   abort() {
      this._aborted = true;
      if (this._pendingHumanInput) {
         this._pendingHumanInput.reject(new Error('Aborted while waiting for human input.'));
         this._pendingHumanInput = null;
      }
      if (this._abortController) {
         this._abortController.abort();
      }
      this.status = 'idle';
      this._notifyStatus();
   }

   async run(goal) {
      this.status = 'thinking';
      this._aborted = false;
      this._abortController = new AbortController();
      this._notifyStatus();

      try {
         const provider = await this._getProvider();

         let systemPrompt = await this._getBaseSystemPrompt();

         // Check if we need to summarize before starting new goal
         await this._checkSummarization(provider, systemPrompt);
         if (this._aborted) {
            this.status = 'idle';
            this._notifyStatus();
            return;
         }

         this.context.addEntry({ role: 'user', content: goal, timestamp: this._timestamp() });

         let step = 0;
         let errorCount = 0;
         const agentLimits = configService.get(CONFIG_KEYS.AGENT_LIMITS);
         const userSettings = configService.get(CONFIG_KEYS.USER_SETTINGS);
         const AGENT_MAX_STEPS = agentLimits.AGENT_MAX_STEPS;
         const AGENT_MAX_TOOL_ERRORS = agentLimits.AGENT_MAX_TOOL_ERRORS;
         const agentTools = new AgentTools(this.context, this._notifyStep.bind(this), {
            highlight: userSettings.highlightActions,
            requestHumanInput: this._requestHumanInput.bind(this)
         });

         const contentActionSender = this._sendToContent.bind(this);

         while (step < AGENT_MAX_STEPS && errorCount < AGENT_MAX_TOOL_ERRORS && !this._aborted) {
            console.log('[Agent] Running step', step);

            step++;

            systemPrompt = await this._getBaseSystemPrompt();

            // Check summarization mid-loop if history gets too long
            await this._checkSummarization(provider, systemPrompt);
            if (this._aborted) break;

            // Rebuild messages in case summary happened
            const currentMessages = [
               { role: 'system', content: systemPrompt },
               ...this.context.buildLLMMessages()
            ];
            console.log('[Current Messages]', currentMessages);
            const response = await this._callLLM(provider, currentMessages);
            if (!response) {
               errorCount++;
               if (errorCount >= AGENT_MAX_TOOL_ERRORS) {
                  this._notifyStep(STEP_TYPES.ERROR, `Reached maximum tool errors (${AGENT_MAX_TOOL_ERRORS}). Task aborted.`);
                  this.context.addEntry({ role: 'assistant', content: `Task aborted: too many errors (${errorCount}).`, timestamp: this._timestamp() });
                  await this.context.persist();
                  break;
               }
               continue;
            }

            const assistantMsg = response.message;
            const isDone = await this._handleAssistantResponse(assistantMsg);
            if (isDone) break;

            // Process each tool call
            let taskFinished = false;
            if (assistantMsg.tool_calls) {
               for (const toolCall of assistantMsg.tool_calls) {
                  if (this._aborted) break;
                  const execResult = await agentTools.executeToolCall(toolCall, contentActionSender);
                  if (!execResult.success) errorCount++;
                  if (execResult.terminal) {
                     taskFinished = true;
                     this.status = 'idle';
                     this._notifyStatus();
                     break;
                  }
               }
            }

            await this.context.persist();
            if (taskFinished) break;
         }

         this._handleLoopEnd(step, errorCount, AGENT_MAX_STEPS, AGENT_MAX_TOOL_ERRORS);
      } catch (error) {
         if (error.name === 'AbortError' || this._aborted) {
            console.log('[Agent] Run aborted.');
         } else {
            this._notifyStep(STEP_TYPES.ERROR, error.message);
            console.error('[Agent Error]', error);
         }
      } finally {
         this.status = 'idle';
         this._notifyStatus();
         this._abortController = null;
      }
   }

   async _getBaseSystemPrompt() {
      const userSettings = configService.get(CONFIG_KEYS.USER_SETTINGS) || {};
      const customInstructions = userSettings.customInstructions || '';

      let systemPrompt = SYSTEM_PROMPT;
      if (customInstructions) {
         systemPrompt += `\n\nUSER'S INSTRUCTIONS and CONTEXT:\n${customInstructions}`;
      }

      try {
         const tabs = await new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, resolve);
         });
         if (tabs && tabs[0]) {
            systemPrompt += `\n\nCURRENT TAB CONTEXT:\nURL: ${tabs[0].url || 'N/A'}\nTitle: ${tabs[0].title || 'N/A'}`;
         }
      } catch (err) {
         console.warn('[Agent] Could not get current tab context', err);
      }

      return systemPrompt;
   }

   async _checkSummarization(provider, systemPrompt) {
      const agentLimits = configService.get(CONFIG_KEYS.AGENT_LIMITS);
      const summarizeLimit = agentLimits.TRIGGER_CONTEXT_SUMMARIZE_AFTER || 100;

      // We also check if we are already past the limit since the last summary
      const messagesSinceSummary = this.context.buildLLMMessages().length;
      if (messagesSinceSummary >= summarizeLimit) {
         await this.context.summarize(provider, systemPrompt, this._notifyStep.bind(this), { signal: this._abortController?.signal });
      }
   }

   async _getProvider() {
      const config = await settingsStore.getConfig(LLM_PROVIDERS.OPENAI);
      return createLLMProvider(LLM_PROVIDERS.OPENAI, config);
   }

   async _callLLM(provider, messages) {
      try {
         this._notifyStatus('thinking');
         const response = await provider.chat(messages, TOOLS, { signal: this._abortController?.signal });
         this._notifyStatus('running');
         return response;
      } catch (err) {
         this._notifyStep(STEP_TYPES.ERROR, `LLM call failed: ${err.message}`);
         return null;
      }
   }

   async _handleAssistantResponse(assistantMsg) {
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
         const text = assistantMsg.content || '';
         this.context.addEntry({ role: 'assistant', content: text, timestamp: this._timestamp() });
         await this.context.persist();
         this._notifyStep(STEP_TYPES.SUCCESS, text);
         return true;
      }
      this.context.addEntry({
         role: 'assistant',
         content: assistantMsg.content || null,
         tool_calls: assistantMsg.tool_calls,
         timestamp: this._timestamp(),
      });
      if (assistantMsg.content) {
         this._notifyStep(STEP_TYPES.THOUGHT, assistantMsg.content);
      }

      return false;
   }

   _handleLoopEnd(step, errorCount, maxSteps, maxErrors) {
      if (step >= maxSteps && !this._aborted) {
         this._notifyStep(STEP_TYPES.ERROR, `Reached maximum steps (${maxSteps}). Task stopped.`);
         this.context.addEntry({ role: 'assistant', content: `Task stopped: reached maximum steps (${maxSteps}).`, timestamp: this._timestamp() });
         this.context.persist();
      } else if (errorCount >= maxErrors && !this._aborted) {
         this._notifyStep(STEP_TYPES.ERROR, `Reached maximum tool errors (${maxErrors}). Task aborted.`);
         this.context.addEntry({ role: 'assistant', content: `Task aborted: too many errors (${errorCount}).`, timestamp: this._timestamp() });
         this.context.persist();
      }
   }

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

   _sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
   }

   async clearHistory() {
      await this.context.clear();
   }

   _timestamp() {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
   }

   _notifyStep(type, content) {
      if (this._onStep) {
         this._onStep({ type, content, timestamp: this._timestamp() });
      }
   }

   _notifyStatus(status = null) {
      if (status) this.status = status;
      if (this._onStatus) this._onStatus(this.status);
   }

   async _requestHumanInput(payload) {
      if (!this._onHumanInput) {
         throw new Error('No human input handler registered.');
      }

      this.status = 'waiting_for_input';
      this._notifyStatus();

      return new Promise((resolve, reject) => {
         this._pendingHumanInput = { resolve, reject, payload };
         this._onHumanInput({
            ...payload,
            timestamp: this._timestamp(),
         });
      });
   }

   async submitHumanInput(selection) {
      if (!this._pendingHumanInput) return;
      const pending = this._pendingHumanInput;
      this._pendingHumanInput = null;

      const inputText = String(selection ?? '');
      this.context.addEntry({
         role: 'user',
         content: inputText,
         _meta: {
            fromInterrupt: true,
            interruptTool: pending.payload?.interruptTool || 'human_input',
            question: pending.payload?.question || ''
         },
         timestamp: this._timestamp()
      });
      await this.context.persist();

      pending.resolve(selection);
      this.status = 'running';
      this._notifyStatus();
   }
}
