/**
 * LLMProvider — Strategy interface for LLM completions.
 *
 * Design rationale: The Strategy pattern lets the Agent swap providers without
 * changing its own code. The base class enforces the contract:
 *   1. `chat()` is the public API — it validates config, then delegates to `_execute()`
 *   2. `_execute()` is the protected hook that each concrete provider implements
 *   3. `validateConfig()` is also a hook — each provider defines what constitutes valid config
 *
 * This is the Template Method variant of Strategy: the base class controls
 * the flow (validate → execute) while subclasses supply the implementation.
 */
export class LLMProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * Public API — validates config and delegates to provider-specific implementation.
   *
   * @param {Array} messages - Chat messages array
   * @param {Array} tools - Tool/function definitions
   * @param {object} options - Optional parameters like AbortSignal
   * @returns {{ message: object, usage: object }}
   */
  async chat(messages, tools, options = {}) {
    this.validateConfig();
    return this._execute(messages, tools, options);
  }

  /**
   * Provider-specific completion logic. Must be overridden.
   * @abstract
   */
  async _execute(messages, tools) {
    throw new Error(`_execute() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Provider-specific config validation. Must be overridden.
   * @abstract
   */
  validateConfig() {
    throw new Error(`validateConfig() must be implemented by ${this.constructor.name}`);
  }
}
