/**
 * Tool Definitions — OpenAI Function Calling Schemas
 *
 * Each tool is a JSON schema sent to the LLM via `tools` parameter.
 * The LLM responds with tool_calls[] containing the tool name and arguments.
 *
 * Tools are grouped by purpose:
 *   - Reading: Observe the page state
 *   - Interaction: Click, type, scroll on elements
 *   - Completion: Signal task done/failed
 */

export const TOOLS = [
  // ── Reading & Observation ──

  {
    type: 'function',
    function: {
      name: 'read_page',
      description: 'Get the accessibility tree of the current page. Returns interactive elements labeled by [id]. Use this to understand the page structure and find elements to interact with.',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['compact', 'full'],
            description: '"compact" (default): flat list of interactive elements only. "full": complete accessibility tree.',
          },
        },
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_page_text',
      description: 'Get text content from the page. Supports full-page, viewport-only, or CSS-selector scoped extraction.',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['full', 'viewport', 'selector'],
            description: 'Extraction scope: full page (default), only visible viewport, or specific CSS selector.',
          },
          selector: {
            type: 'string',
            description: 'CSS selector used when scope=selector.',
          },
        },
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'find',
      description: 'Find interactive elements on the page using a natural language description. Returns matching elements with their agent IDs, sorted by relevance. Example: find("search button"), find("email input").',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language description of the element to find.',
          },
        },
        required: ['query'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'find_text',
      description: 'Search for plain text on the current page (Ctrl+F style). Returns count and snippets. NOTE: Returned matches do NOT have agent IDs and CANNOT be clicked. Use find() or read_page() to get element IDs for interaction.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Text to search for on the page.',
          },
        },
        required: ['query'],
      },
    },
  },

  // ── Interaction ──

  {
    type: 'function',
    function: {
      name: 'click',
      description: 'Click on an element identified by its agent [id] from read_page or find. Scrolls element into view first.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'integer',
            description: 'The agent ID number [N] of the element to click.',
          },
        },
        required: ['target'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'type',
      description: 'Type text into an input field identified by its agent [id]. Clears existing value and types new text. Optionally press Enter after typing.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'integer',
            description: 'The agent ID number [N] of the input element.',
          },
          text: {
            type: 'string',
            description: 'Text to type into the element.',
          },
          enter: {
            type: 'boolean',
            description: 'If true, press Enter after typing to submit.',
          },
        },
        required: ['target', 'text'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'select',
      description: 'Select a value from a dropdown/select element.',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'integer',
            description: 'The agent ID of the select element.',
          },
          value: {
            type: 'string',
            description: 'The option value to select.',
          },
        },
        required: ['target', 'value'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'scroll',
      description: 'Scroll the page up or down.',
      parameters: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['up', 'down'],
            description: 'Scroll direction.',
          },
          amount: {
            type: 'integer',
            description: 'Pixels to scroll (default 500).',
          },
        },
        required: ['direction'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'press_key',
      description: 'Press a keyboard key. Use for Enter, Tab, Escape, ArrowDown, etc.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Key name: Enter, Tab, Escape, Backspace, ArrowDown, ArrowUp, etc.',
          },
        },
        required: ['key'],
      },
    },
  },

  // ── Completion ──

  {
    type: 'function',
    function: {
      name: 'done',
      description: 'Mark the task as completed successfully. For information tasks, put the extracted answer in "answer". Always provide a summary.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Summary of what was accomplished.',
          },
          answer: {
            type: 'string',
            description: 'The extracted answer or result data.',
          },
        },
        required: ['summary'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'fail',
      description: 'Mark the task as failed — cannot be completed.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Why the task failed.',
          },
        },
        required: ['reason'],
      },
    },
  },
];

/**
 * Lookup a tool definition by name
 */
export function getToolByName(name) {
  return TOOLS.find((t) => t.function.name === name);
}
