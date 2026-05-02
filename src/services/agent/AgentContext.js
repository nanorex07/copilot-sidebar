import { historyStore } from '../storage';
import { STEP_TYPES } from '../../config/constants';
import { SUMMARIZATION_PROMPT } from '../../config/prompts';

export class AgentContext {
   constructor(sessionId) {
      this.sessionId = sessionId;
      this.history = [];
   }

   async init() {
      const savedHistory = await historyStore.getSession(this.sessionId);
      if (savedHistory && savedHistory.length > 0) {
         this.history = savedHistory;
      }
   }

   async persist() {
      await historyStore.saveSession(this.sessionId, this.history);
   }

   async clear() {
      this.history = [];
      await historyStore.clearSession(this.sessionId);
   }

   addEntry(entry) {
      this.history.push(entry);
   }

   getMessagesCount() {
      return this.history.length;
   }

   buildLLMMessages() {
      let startIndex = 0;
      for (let i = this.history.length - 1; i >= 0; i--) {
         if (this.history[i]._isSummary) {
            startIndex = i;
            break;
         }
      }

      const recentHistory = this.history.slice(startIndex);
      
      return recentHistory.map((entry) => {
         const msg = { role: entry.role, content: entry.content || null };
         if (entry.tool_call_id) msg.tool_call_id = entry.tool_call_id;
         if (entry.tool_calls) msg.tool_calls = entry.tool_calls;
         return msg;
      });
   }

   async summarize(provider, baseSystemPrompt, notifyStep, options = {}) {
      
      const messagesToSummarize = [
         { role: 'system', content: baseSystemPrompt },
         ...this.buildLLMMessages(),
         { role: 'user', content: SUMMARIZATION_PROMPT }
      ];
      
      try {
         const response = await provider.chat(messagesToSummarize, [], { signal: options.signal }); // omit tools so it doesn't call tools
         const summaryText = response?.message?.content || 'Context summarized.';
         
         this.history.push({
            role: 'user',
            content: `[CONTEXT SUMMARY]\n${summaryText}`,
            _isSummary: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
         });
         await this.persist();
         notifyStep(STEP_TYPES.ACTION, 'Context has been summarized.');
      } catch (err) {
         console.error('[AgentContext] Summarization failed:', err);
      }
   }
}
