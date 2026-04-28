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

import { CONTENT_ACTIONS } from '../config/constants';

const TOOL_REGISTRY = {
  // ── Reading Tools ──

  read_page: {
    contentAction: CONTENT_ACTIONS.READ_PAGE,
    buildPayload: (args) => ({
      maxDepth: 15,
      maxNodes: 500,
      viewportOnly: args.mode === 'compact',
    }),
    formatResult: (result) => {
      const count = result?.interactiveCount || 0;
      return `Found ${count} interactive elements on the page.`;
    },
  },

  get_page_text: {
    contentAction: CONTENT_ACTIONS.GET_PAGE_TEXT,
    buildPayload: (args) => ({
      scope: args.scope || 'full',
      selector: args.selector || '',
      maxChars: 15000,
    }),
    formatResult: (result) => {
      const chars = result?.charCount || 0;
      const truncated = result?.truncated ? ' (truncated)' : '';
      return `Extracted ${chars} chars of text${truncated}.`;
    },
  },

  find: {
    contentAction: CONTENT_ACTIONS.FIND,
    buildPayload: (args) => ({
      query: args.query,
    }),
    formatResult: (result) => {
      if (Array.isArray(result)) {
        return `Found ${result.length} matching elements.`;
      }
      return 'Find completed.';
    },
  },

  find_text: {
    contentAction: CONTENT_ACTIONS.FIND_TEXT,
    buildPayload: (args) => ({
      query: args.query,
      maxResults: 20,
      scrollToFirst: true,
    }),
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
};

/**
 * Terminal tools handled directly by the agent, not dispatched to content script.
 */
export const TERMINAL_TOOLS = new Set(['done', 'fail']);

/**
 * Get the registry entry for a tool
 */
export function getToolHandler(toolName) {
  return TOOL_REGISTRY[toolName] || null;
}

/**
 * Check if a tool name is valid (either registered or terminal)
 */
export function isValidTool(toolName) {
  return toolName in TOOL_REGISTRY || TERMINAL_TOOLS.has(toolName);
}
