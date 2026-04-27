import { storage } from './storage';
import { createLLMProvider } from './llm';
import { SYSTEM_PROMPT } from '../sidepanel/prompts/system';
import { 
  LLM_PROVIDERS, 
  STEP_TYPES, 
  PAGE_TEXT_EXTRACTION_THRESHOLD,
  STORAGE_STORES
} from '../config/constants';

/**
 * Agent Class - Orchestrates context gathering, LLM interaction, and session management.
 */
export class Agent {
  constructor(sessionId = 'default') {
    this.sessionId = sessionId;
    this.history = [];
    this.status = 'idle';
    this._onStep = null;
    this._onStatus = null;
  }

  /**
   * Initialize the agent by loading history from storage
   */
  async init() {
    const savedHistory = await storage.get(STORAGE_STORES.HISTORY, this.sessionId);
    if (savedHistory) {
      this.history = savedHistory;
    }
  }

  /**
   * Set callbacks for UI updates
   */
  onStep(callback) { this._onStep = callback; }
  onStatus(callback) { this._onStatus = callback; }

  /**
   * Run a single interaction loop
   */
  async run(goal) {
    this.status = 'running';
    this._notifyStatus();

    try {
      // 1. Gather Context
      this._notifyStep(STEP_TYPES.ACTION, 'Reading page context...');
      let context = await this._getPageContext();
      
      // Large-page extraction threshold
      if (context.text && context.text.length > PAGE_TEXT_EXTRACTION_THRESHOLD) {
        context.text = context.text.slice(0, PAGE_TEXT_EXTRACTION_THRESHOLD);
      }

      // 2. Prepare Provider
      const config = await storage.get(STORAGE_STORES.SETTINGS, LLM_PROVIDERS.OPENAI);
      if (!config || !config.apiKey) {
        throw new Error('API Key not found. Please check settings.');
      }

      const provider = createLLMProvider(LLM_PROVIDERS.OPENAI, config);
      
      // 3. Construct Context-Aware System Message
      const pageInfo = `
<page_context>
URL: ${context.url}
Title: ${context.title}
Content:
${context.text}
</page_context>`;

      const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n${pageInfo}`;

      // 4. Update local history
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.history.push({ role: 'user', content: goal, timestamp });
      
      // 5. Call LLM
      this._notifyStep(STEP_TYPES.THOUGHT, 'Processing...');
      const messages = this.history.map(({ role, content }) => ({ role, content }));
      const conversationMessages = [
        { role: 'system', content: fullSystemPrompt },
        ...messages
      ];

      const response = await provider.chat(conversationMessages);

      // 6. Update local history with assistant response
      const assistantTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.history.push({ role: 'assistant', content: response.text, timestamp: assistantTimestamp });
      
      // 7. Persist history
      await storage.set(STORAGE_STORES.HISTORY, this.sessionId, this.history);

      this._notifyStep(STEP_TYPES.SUCCESS, response.text);
      
    } catch (error) {
      this._notifyStep(STEP_TYPES.ERROR, error.message);
      console.error('[Agent Error]', error);
    } finally {
      this.status = 'idle';
      this._notifyStatus();
    }
  }

  /**
   * Communicates with content script to get current page info
   */
  async _getPageContext() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
          resolve({ url: 'N/A', title: 'N/A', text: 'No active tab found.' });
          return;
        }

        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTEXT' }, (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            resolve({ 
              url: tabs[0].url, 
              title: tabs[0].title, 
              text: 'Could not extract page content.' 
            });
          } else {
            resolve(response.data);
          }
        });
      });
    });
  }

  /**
   * Clear session history
   */
  async clearHistory() {
    this.history = [];
    await storage.remove(STORAGE_STORES.HISTORY, this.sessionId);
    this._notifyStep(STEP_TYPES.ACTION, 'Conversation history cleared.');
  }

  _notifyStep(type, content) {
    if (this._onStep) {
      this._onStep({ 
        type, 
        content, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      });
    }
  }

  _notifyStatus() {
    if (this._onStatus) this._onStatus(this.status);
  }
}
