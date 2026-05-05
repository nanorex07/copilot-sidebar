import { getToolHandler, TERMINAL_TOOLS, INTERRUPT_TOOLS } from '../../tools/registry';
import { STEP_TYPES, HIGHLIGHTABLE_ACTIONS, CONFIG_KEYS } from '../../config/constants';
import { configService } from '../config';

export class AgentTools {
   constructor(agentContext, notifyStep, config = {}) {
      this.context = agentContext;
      this.notifyStep = notifyStep;
      this.config = config;
   }

   async executeToolCall(toolCall, contentActionSender) {
      const toolName = toolCall.function.name;
      let toolArgs = {};
      try {
         toolArgs = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
         toolArgs = {};
      }

      // 1. Handle Terminal Tools
      if (TERMINAL_TOOLS.has(toolName)) {
         await this._handleTerminalExecution(toolCall, toolName, toolArgs);
         return { success: true, terminal: true, toolName };
      }

      if (INTERRUPT_TOOLS.has(toolName)) {
         return this._handleInterruptExecution(toolCall, toolName, toolArgs);
      }

      // 2. Handle Content Script Tools
      const actionLabel = this._getToolActionLabel(toolName, toolArgs);
      this.notifyStep(STEP_TYPES.ACTION, actionLabel);

      const handler = getToolHandler(toolName);
      if (!handler) {
         await this._handleUnknownTool(toolCall, toolName, toolArgs);
         return { success: false, terminal: false };
      }

      const payload = handler.buildPayload(toolArgs);

      if (this.config.highlight && HIGHLIGHTABLE_ACTIONS.has(toolName)) {
         payload.highlight = true;
      }

      let result;
      try {
         result = await contentActionSender(handler.contentAction, payload);
      } catch (err) {
         result = { success: false, error: err.message };
      }

      const summary = handler.formatResult(result);
      this._recordToolResult(toolCall, toolName, toolArgs, result, summary);
      return { success: result.success !== false, terminal: false, toolName };
   }

   async _handleTerminalExecution(toolCall, toolName, toolArgs) {
      let toolResult;
      if (toolName === 'done') {
         toolResult = { success: true, summary: toolArgs.summary, answer: toolArgs.answer || '' };
      } else if (toolName === 'fail') {
         toolResult = { success: false, reason: toolArgs.reason };
      } else {
         toolResult = { success: false, error: 'Unknown terminal tool' };
      }

      const toolResultStr = JSON.stringify(toolResult);

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.context.addEntry({
         role: 'tool',
         tool_call_id: toolCall.id,
         content: toolResultStr,
         _meta: { toolName, toolArgs, summary: toolName === 'done' ? 'Task complete' : toolArgs.reason, result: toolResult },
         timestamp
      });

      if (toolName === 'done') {
         const answer = toolArgs.answer || toolArgs.summary || '';
         this.context.addEntry({ role: 'assistant', content: answer, timestamp });
         await this.context.persist();
         this.notifyStep(STEP_TYPES.SUCCESS, answer);
      } else if (toolName === 'fail') {
         const reason = toolArgs.reason || 'Task failed.';
         this.context.addEntry({ role: 'assistant', content: `Failed: ${reason}`, timestamp });
         await this.context.persist();
         this.notifyStep(STEP_TYPES.ERROR, reason);
      }
      return true;
   }

   async _handleUnknownTool(toolCall, toolName, toolArgs) {
      const errorResult = { success: false, error: `Unknown tool: ${toolName}` };
      this._recordToolResult(toolCall, toolName, toolArgs, errorResult, `Unknown tool: ${toolName}`);
      return false;
   }

   async _handleInterruptExecution(toolCall, toolName, toolArgs) {
      if (!this.config.requestHumanInput) {
         const result = { success: false, error: 'Human input bridge unavailable.' };
         this._recordToolResult(toolCall, toolName, toolArgs, result, result.error);
         return { success: false, terminal: false, toolName };
      }

      if (toolName === 'human_in_the_loop') {
         return this._handleHumanChoiceInterrupt(toolCall, toolArgs);
      }

      if (toolName === 'human_context') {
         return this._handleHumanTextInterrupt(toolCall, toolArgs);
      }

      const result = { success: false, error: `Unsupported interrupt tool: ${toolName}` };
      this._recordToolResult(toolCall, toolName, toolArgs, result, result.error);
      return { success: false, terminal: false, toolName };
   }

   async _handleHumanChoiceInterrupt(toolCall, toolArgs) {
      const limits = configService.get(CONFIG_KEYS.AGENT_LIMITS) || {};
      const maxOptions = Number(limits.HUMAN_IN_THE_LOOP_MAX_OPTIONS) || 4;
      const options = Array.isArray(toolArgs.options)
         ? toolArgs.options.slice(0, maxOptions).map((opt) => String(opt))
         : [];

      if (!toolArgs.question || options.length === 0) {
         const result = { success: false, error: 'Invalid human_in_the_loop payload. Requires question and non-empty options.' };
         this._recordToolResult(toolCall, 'human_in_the_loop', toolArgs, result, result.error);
         return { success: false, terminal: false, toolName: 'human_in_the_loop' };
      }

      const selection = await this.config.requestHumanInput({
         interruptTool: 'human_in_the_loop',
         inputType: 'choice',
         toolCallId: toolCall.id,
         question: String(toolArgs.question),
         options
      });

      const chosenIndex = options.findIndex((opt) => opt === selection);
      const result = { success: true, question: String(toolArgs.question), options, selectedOption: selection, selectedIndex: chosenIndex };
      this._recordToolResult(toolCall, 'human_in_the_loop', toolArgs, result, `User selected: ${selection}`);
      return { success: true, terminal: false, toolName: 'human_in_the_loop' };
   }

   async _handleHumanTextInterrupt(toolCall, toolArgs) {
      if (!toolArgs.question) {
         const result = { success: false, error: 'Invalid human_context payload. Requires question.' };
         this._recordToolResult(toolCall, 'human_context', toolArgs, result, result.error);
         return { success: false, terminal: false, toolName: 'human_context' };
      }

      const responseText = await this.config.requestHumanInput({
         interruptTool: 'human_context',
         inputType: 'text',
         toolCallId: toolCall.id,
         question: String(toolArgs.question)
      });

      const result = { success: true, question: String(toolArgs.question), response: String(responseText || '') };
      this._recordToolResult(toolCall, 'human_context', toolArgs, result, 'Received user context');
      return { success: true, terminal: false, toolName: 'human_context' };
   }

   _recordToolResult(toolCall, toolName, toolArgs, result, summary) {
      const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
      const truncatedResult = resultStr.slice(0, 30000);

      this.context.addEntry({
         role: 'tool',
         tool_call_id: toolCall.id,
         content: truncatedResult,
         _meta: { toolName, toolArgs, summary, result },
         timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      this.notifyStep(STEP_TYPES.TOOL_CALL, JSON.stringify({ tool: toolName, args: toolArgs, result, summary }));
   }

   _getToolActionLabel(tool, args) {
      switch (tool) {
         case 'read_page': return 'Reading page content...';
         case 'get_page_text': return 'Extracting text from page...';
         case 'find': return `Looking for "${args.query}"...`;
         case 'find_text': return `Searching for text "${args.query}"...`;
         case 'click': return `Clicking on [${args.target}]...`;
         case 'type': return `Typing into [${args.target}]...`;
         case 'select': return `Selecting value in [${args.target}]...`;
         case 'scroll': return `Scrolling ${args.direction}...`;
         case 'hover': return `Hovering over [${args.target}]...`;
         case 'press_key': return `Pressing ${args.key} key...`;
         case 'extract_structured': return `Extracting structured data...`;
         case 'wait_for': return `Waiting for ${args.condition}...`;
         case 'navigate': return `Navigating ${args.action}...`;
         case 'done': return 'Finishing task...';
         case 'fail': return 'Reporting failure...';
         case 'human_in_the_loop': return 'Asking user to choose next action...';
         case 'human_context': return 'Asking user for additional context...';
         default: return `Executing ${tool}...`;
      }
   }
}
