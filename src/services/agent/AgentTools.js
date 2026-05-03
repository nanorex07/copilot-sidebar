import { getToolHandler, TERMINAL_TOOLS } from '../../tools/registry';
import { STEP_TYPES, HIGHLIGHTABLE_ACTIONS } from '../../config/constants';

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
         default: return `Executing ${tool}...`;
      }
   }
}
