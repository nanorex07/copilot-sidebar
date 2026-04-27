import { LLM_PROVIDERS } from '../../config/constants';
import { OpenAIProvider } from './openai-provider';

/**
 * LLM Factory to handle multiple providers
 */
export const createLLMProvider = (type, config) => {
  switch (type) {
    case LLM_PROVIDERS.OPENAI:
      return new OpenAIProvider(config);
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
};
