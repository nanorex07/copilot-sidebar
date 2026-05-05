<script setup>
import ChatStep from './ChatStep.vue'
import { parseMarkdown } from '../../utils/markdown'

const demoSteps = [
  { type: 'user', content: 'Find best selling product on this page.'},
  { type: 'thought', content: 'Analyzing page structure to identify products...', expanded: false },
  { type: 'action', content: 'Context has been summarized', expanded: false },
  {
    type: 'tool_call',
    displayLabel: 'read_page(mode="compact")',
    summary: 'Extracted 2,450 chars of page text',
    collapsed: true,
    argsCollapsed: true,
    resultCollapsed: true
  },
  {
    type: 'success',
    timestamp: '10:34 AM',
    html: parseMarkdown('Best selling product is `SuperWidget Pro`, currently priced at **$49.99.**')
  },
]
</script>

<template>
  <div class="animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-5 py-2">
    <div class="mb-2 flex flex-col items-center gap-2 text-center">
      <img src="/icons/icon128.png" alt="Copilot" class="mb-2 size-16 opacity-90" />
      <h2 class="text-base font-medium text-skin-text">Welcome to Copilot Sidebar</h2>
      <p class="text-[13px] text-skin-muted">I can navigate and interact with any website for you.</p>
    </div>

    <div class="flex flex-col gap-3 rounded-2xl border border-skin-border bg-black/15 p-4 opacity-85">
      <div class="text-[10px] font-semibold tracking-[1px] text-skin-muted">EXAMPLE INTERACTION</div>
      <ChatStep
        v-for="(step, index) in demoSteps"
        :key="index"
        :step="step"
        :index="index"
      />
    </div>

    <div class="px-5 text-center text-xs italic text-skin-muted">
      Try: "Summarize this page", "Fill this form with dummy data", or "Find pricing section".
    </div>
  </div>
</template>
