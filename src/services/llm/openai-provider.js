import OpenAI from 'openai';
import { BaseProvider } from './base-provider';
import { DEFAULT_OPENAI_CONFIG } from '../../config/constants';

/**
 * OpenAI Provider — supports both plain chat and tool/function calling.
 */
export class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || DEFAULT_OPENAI_CONFIG.baseUrl,
      dangerouslyAllowBrowser: true,
    });
  }
  /**
   * Chat completion with tool/function calling support.
   * Returns the raw message object including tool_calls.
   *
   * @param {Array} messages - OpenAI messages array
   * @param {Array} tools - OpenAI tool definitions
   * @returns {{ message: object, usage: object }}
   */
  async chat(messages, tools) {
    this.validateConfig();
    const response = await this.client.chat.completions.create({
      model: this.config.model || DEFAULT_OPENAI_CONFIG.model,
      temperature: this.config.temperature !== undefined ? this.config.temperature : DEFAULT_OPENAI_CONFIG.temperature,
      messages,
      tools,
    });
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
