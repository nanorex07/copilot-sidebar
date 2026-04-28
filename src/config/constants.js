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
  model: 'gpt-4o'
};

// ── Agent Loop Limits ──
export const AGENT_MAX_STEPS = 25;
export const AGENT_MAX_TOOL_ERRORS = 5;

// ── Page Extraction ──
export const PAGE_TEXT_EXTRACTION_THRESHOLD = 8000;
export const PAGE_TEXT_MAX_CHARS = 15000;
export const ACCESSIBILITY_TREE_MAX_DEPTH = 15;
export const ACCESSIBILITY_TREE_MAX_NODES = 500;
export const FIND_MAX_RESULTS = 10;
export const FIND_TEXT_MAX_RESULTS = 20;

// ── UI Step Types ──
export const STEP_TYPES = {
  THOUGHT: 'thought',
  ACTION: 'action',
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  ERROR: 'error',
  SUCCESS: 'success',
  USER: 'user'
};

// ── UI Status ──
export const UI_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  ERROR: 'error',
  SUCCESS: 'success'
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
