import OpenAI from 'openai';
import { BaseProvider } from './base-provider';
import { DEFAULT_OPENAI_CONFIG } from '../../config/constants';

/**
 * OpenAI implementation using official SDK
 */
export class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || DEFAULT_OPENAI_CONFIG.baseUrl,
      dangerouslyAllowBrowser: true
    });
  }

  async chat(messages) {
    this.validateConfig();
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model || DEFAULT_OPENAI_CONFIG.model,
        messages: messages,
      });
      
      return {
        text: response.choices[0].message.content,
        usage: response.usage
      };
    } catch (error) {
      console.error('OpenAI Provider Error:', error);
      throw error;
    }
  }

  validateConfig() {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API Key is required');
    }
  }
}
