/**
 * Tool Registry — Maps tool names to content script actions.
 *
 * Each tool entry defines:
 *   - contentAction: The message action name sent to the content script
 *   - buildPayload(args): Transforms LLM tool arguments into content script payload
 *   - formatResult(result): Produces a human-readable summary for UI display
 *
 * "Terminal" tools (done, fail) are handled directly by the agent loop
 * and are not dispatched to the content script.
 */

import {
  CONTENT_ACTIONS
} from '../config/constants';
import { configService } from '../services/config';

const TOOL_REGISTRY = {
  // ── Reading Tools ──

  read_page: {
    contentAction: CONTENT_ACTIONS.READ_PAGE,
    buildPayload: (args) => {
      const config = configService.get('page_extraction');
      return {
        maxDepth: config.ACCESSIBILITY_TREE_MAX_DEPTH,
        maxNodes: config.ACCESSIBILITY_TREE_MAX_NODES,
        viewportOnly: args.mode === 'compact',
      };
    },
    formatResult: (result) => {
      const count = result?.interactiveCount || 0;
      return `Found ${count} interactive elements on the page.`;
    },
  },

  get_page_text: {
    contentAction: CONTENT_ACTIONS.GET_PAGE_TEXT,
    buildPayload: (args) => {
      const config = configService.get('page_extraction');
      return {
        scope: args.scope || 'full',
        selector: args.selector || '',
        maxChars: config.PAGE_TEXT_EXTRACTION_THRESHOLD * 2, // Allow a bit more than threshold
      };
    },
    formatResult: (result) => {
      const chars = result?.charCount || 0;
      const truncated = result?.truncated ? ' (truncated)' : '';
      return `Extracted ${chars} chars of text${truncated}.`;
    },
  },

  find: {
    contentAction: CONTENT_ACTIONS.FIND,
    buildPayload: (args) => {
      const config = configService.get('page_extraction');
      return {
        query: args.query,
        maxResults: config.FIND_MAX_RESULTS,
      };
    },
    formatResult: (result) => {
      if (Array.isArray(result)) {
        return `Found ${result.length} matching elements.`;
      }
      return 'Find completed.';
    },
  },

  find_text: {
    contentAction: CONTENT_ACTIONS.FIND_TEXT,
    buildPayload: (args) => {
      const config = configService.get('page_extraction');
      return {
        query: args.query,
        maxResults: config.FIND_TEXT_MAX_RESULTS,
        scrollToFirst: true,
      };
    },
    formatResult: (result) => {
      const count = result?.count || 0;
      return `Found ${count} text matches for "${result?.query || ''}".`;
    },
  },

  // ── Interaction Tools ──

  click: {
    contentAction: CONTENT_ACTIONS.EXECUTE_ACTION,
    buildPayload: (args) => ({
      type: 'click',
      target: args.target,
      params: {},
    }),
    formatResult: (result) => result?.description || 'Clicked element.',
  },

  type: {
    contentAction: CONTENT_ACTIONS.EXECUTE_ACTION,
    buildPayload: (args) => ({
      type: 'type',
      target: args.target,
      params: {
        text: args.text,
        enter: args.enter || false,
      },
    }),
    formatResult: (result) => result?.description || 'Typed text.',
  },

  select: {
    contentAction: CONTENT_ACTIONS.EXECUTE_ACTION,
    buildPayload: (args) => ({
      type: 'select',
      target: args.target,
      params: { value: args.value },
    }),
    formatResult: (result) => result?.description || 'Selected option.',
  },

  scroll: {
    contentAction: CONTENT_ACTIONS.EXECUTE_ACTION,
    buildPayload: (args) => ({
      type: 'scroll',
      target: args.direction,
      params: { amount: args.amount || 500 },
    }),
    formatResult: (result) => result?.description || 'Scrolled page.',
  },

  press_key: {
    contentAction: CONTENT_ACTIONS.EXECUTE_ACTION,
    buildPayload: (args) => ({
      type: 'press_key',
      target: null,
      params: { key: args.key },
    }),
    formatResult: (result) => result?.description || `Pressed key.`,
  },

  hover: {
    contentAction: CONTENT_ACTIONS.EXECUTE_ACTION,
    buildPayload: (args) => ({
      type: 'hover',
      target: args.target,
      params: {},
    }),
    formatResult: (result) => result?.description || 'Hovered element.',
  },

  extract_structured: {
    contentAction: 'extractStructured',
    buildPayload: (args) => ({
      hint: args.hint || '',
      selector: args.selector || '',
      maxItems: args.maxItems || 30,
    }),
    formatResult: (result) => {
      const count = result?.count || 0;
      return `Extracted ${count} structured items.`;
    },
  },

  wait_for: {
    contentAction: 'waitFor',
    buildPayload: (args) => ({
      condition: args.condition,
      value: args.value,
      timeoutMs: args.timeoutMs || 10000,
    }),
    formatResult: (result) => {
      if (result.success) return `Condition "${result.condition}" met.`;
      return `Wait failed: ${result.reason || 'Timeout'}`;
    },
  },


  navigate: {
    contentAction: CONTENT_ACTIONS.EXECUTE_ACTION,
    buildPayload: (args) => ({
      type: 'navigate',
      target: null,
      params: { action: args.action },
    }),
    formatResult: (result) => result?.description || 'Navigation complete.',
  },
};

/**
 * Terminal tools handled directly by the agent, not dispatched to content script.
 */
export const TERMINAL_TOOLS = new Set(['done', 'fail']);
export const INTERRUPT_TOOLS = new Set(['human_in_the_loop', 'human_context']);

/**
 * Get the registry entry for a tool
 */
export function getToolHandler(toolName) {
  return TOOL_REGISTRY[toolName] || null;
}
