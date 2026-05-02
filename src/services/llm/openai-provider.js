import OpenAI from 'openai';
import { LLMProvider } from './base-provider';
import { DEFAULT_OPENAI_CONFIG } from '../../config/constants';

/**
 * OpenAIProvider — Concrete Strategy for OpenAI-compatible chat completions.
 *
 * Supports tool/function calling via the OpenAI SDK.
 * Config shape: { apiKey, baseUrl?, model?, temperature? }
 */
export class OpenAIProvider extends LLMProvider {
  constructor(config) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || DEFAULT_OPENAI_CONFIG.baseUrl,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Execute the chat completion via OpenAI SDK.
   * @param {Array} messages
   * @param {Array} tools
   * @param {object} options
   * @returns {{ message: object, usage: object }}
   */
  async _execute(messages, tools, options = {}) {
    const payload = {
      model: this.config.model || DEFAULT_OPENAI_CONFIG.model,
      temperature: this.config.temperature !== undefined ? this.config.temperature : DEFAULT_OPENAI_CONFIG.temperature,
      messages,
    };
    if (tools && tools.length > 0) {
      payload.tools = tools;
    }
    const response = await this.client.chat.completions.create(payload, { signal: options.signal });
    const message = response.choices[0].message;
    return {
      message,
      usage: response.usage,
    };
  }

  validateConfig() {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API Key is required');
    }
  }
}
