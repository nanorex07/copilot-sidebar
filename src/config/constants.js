export const APP_NAME = 'Copilot Sidebar';
export const APP_VERSION = '1.0.0';

export const STORAGE_DB_NAME = 'CopilotSidebarDB';
export const STORAGE_STORES = {
  SETTINGS: 'settings',
  HISTORY: 'history'
};

export const LLM_PROVIDERS = {
  OPENAI: 'openai'
};

export const DEFAULT_OPENAI_CONFIG = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o'
};

export const UI_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  ERROR: 'error',
  SUCCESS: 'success'
};

export const STEP_TYPES = {
  THOUGHT: 'thought',
  ACTION: 'action',
  ERROR: 'error',
  SUCCESS: 'success'
};

export const PAGE_TEXT_EXTRACTION_THRESHOLD = 8000;
