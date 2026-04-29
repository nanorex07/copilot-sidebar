<script setup>
import ChatStep from './ChatStep.vue'

const demoSteps = [
  { type: 'user', content: 'Find the best selling product on this page.'},
  { type: 'thought', content: 'Analyzing page structure to identify products...', expanded: false },
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
    content: 'The best selling product is the **SuperWidget Pro**, currently priced at $49.99.' 
  },
]
</script>

<template>
  <div class="showcase">
    <div class="showcase-header">
      <img src="/icons/icon128.png" alt="Copilot" class="showcase-icon" />
      <h2>Welcome to Copilot Sidebar</h2>
      <p>I can navigate and interact with any website for you.</p>
    </div>

    <div class="showcase-demo">
      <div class="showcase-label">EXAMPLE INTERACTION</div>
      
      <ChatStep 
        v-for="(step, index) in demoSteps" 
        :key="index" 
        :step="step" 
        :index="index" 
      />
    </div>

    <div class="showcase-footer">
      Try: "Summarize this page", "Fill this form with dummy data", or "Find the pricing section".
    </div>
  </div>
</template>

<style scoped>
.showcase {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 10px 0;
  animation: reveal-soft 0.3s ease-out;
}

.showcase-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  margin-bottom: 10px;
}
.showcase-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 8px;
  opacity: 0.9;
}

.showcase-header h2 {
  font-size: 16px;
  font-weight: 500;
  color: var(--text);
}

.showcase-header p {
  font-size: 13px;
  color: var(--text2);
}

.showcase-demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border);
  border-radius: 16px;
  opacity: 0.8;
}

.showcase-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--text2);
  margin-bottom: 4px;
}

.showcase-footer {
  font-size: 12px;
  color: var(--text2);
  text-align: center;
  font-style: italic;
  padding: 0 20px;
}

@keyframes reveal-soft {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
