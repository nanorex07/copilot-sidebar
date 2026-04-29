export const APP_NAME = 'Copilot Sidebar';
export const APP_VERSION = '1.0.0';

// ── Storage ──
export const STORAGE_DB_NAME = 'CopilotSidebarDB';
export const STORAGE_STORES = {
  SETTINGS: 'settings',
  HISTORY: 'history'
};

// ── LLM Providers ──
export const LLM_PROVIDERS = {
  OPENAI: 'openai'
};

export const DEFAULT_OPENAI_CONFIG = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  temperature: 0.5
};

// ── Configuration Keys ──
export const CONFIG_KEYS = {
  AGENT_LIMITS: 'agent_limits',
  PAGE_EXTRACTION: 'page_extraction'
};

// ── Agent Loop Limits ──
export const DEFAULT_AGENT_LIMITS = {
  AGENT_MAX_STEPS: 50,
  AGENT_MAX_TOOL_ERRORS: 5
};

// ── Page Extraction ──
export const DEFAULT_PAGE_EXTRACTION = {
  PAGE_TEXT_EXTRACTION_THRESHOLD: 20000,
  ACCESSIBILITY_TREE_MAX_DEPTH: 20,
  ACCESSIBILITY_TREE_MAX_NODES: 2000,
  FIND_MAX_RESULTS: 10,
  FIND_TEXT_MAX_RESULTS: 20
};

// ── UI Step Types ──
export const STEP_TYPES = {
  THOUGHT: 'thought',
  ACTION: 'action',
  TOOL_CALL: 'tool_call',
  ERROR: 'error',
  SUCCESS: 'success',
  USER: 'user'
};

// ── Content Script Message Types ──
export const CONTENT_ACTIONS = {
  READ_PAGE: 'readPage',
  GET_PAGE_TEXT: 'getPageText',
  FIND: 'find',
  FIND_TEXT: 'findText',
  EXECUTE_ACTION: 'executeAction',
  GET_PAGE_INFO: 'getPageInfo'
};
