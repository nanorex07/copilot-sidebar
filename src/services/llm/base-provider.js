/**
 * Base LLM Provider Interface
 */
export class BaseProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * Abstract method for chat completions
   * @param {Array} messages 
   */
  async chat(messages) {
    throw new Error('chat() must be implemented by provider');
  }

  /**
   * Validate provider configuration
   */
  validateConfig() {
    throw new Error('validateConfig() must be implemented');
  }
}
