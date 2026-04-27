<script setup>
import { ref, onMounted, nextTick, defineExpose } from 'vue'
import { Agent } from '../../services/agent'
import { parseMarkdown } from '../../services/markdown'

const goal = ref('')
const steps = ref([])
const isRunning = ref(false)
const stepsContainer = ref(null)

// Initialize Agent
const agent = new Agent('main-session')

onMounted(async () => {
  await agent.init()
  
  // Connect agent events to UI
  agent.onStep((step) => {
    steps.value.push({
      ...step,
      html: step.type === 'success' ? parseMarkdown(step.content) : null
    })
    scrollToBottom()
  })
  
  agent.onStatus((status) => {
    isRunning.value = (status === 'running')
  })

  // Show previous history if available
  if (agent.history.length > 0) {
    agent.history.forEach(msg => {
      const timestamp = msg.timestamp || '-'
      if (msg.role === 'user') {
        steps.value.push({
          type: 'user',
          content: msg.content,
          timestamp: timestamp
        })
      } else {
        steps.value.push({
          type: 'success',
          content: msg.content,
          html: parseMarkdown(msg.content),
          timestamp: timestamp
        })
      }
    })
  }
})

const scrollToBottom = async () => {
  await nextTick()
  if (stepsContainer.value) {
    stepsContainer.value.scrollTop = stepsContainer.value.scrollHeight
  }
}

const handleSend = async () => {
  if (!goal.value.trim() || isRunning.value) return
  
  const userGoal = goal.value
  goal.value = ''
  
  // Add user message to UI immediately
  steps.value.push({
    type: 'user',
    content: userGoal,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })
  scrollToBottom()
  
  await agent.run(userGoal)
}

const clearHistory = async () => {
  await agent.clearHistory()
  steps.value = []
}

// Expose clearHistory to parent
defineExpose({ clearHistory })
</script>

<template>
  <div class="chat-view">
    <div class="steps-container" ref="stepsContainer">
      <div v-if="steps.length === 0" class="empty-state">
        <div class="prompt-cloud">
          <img class="task-mascot" src="/icons/icon128.png" alt="Mascot">
          <div class="prompt-cloud-title">I'll read the current page and help you.</div>
        </div>
      </div>
      
      <div v-for="(step, index) in steps" :key="index" class="step-wrapper" :class="step.type">
        <div class="step" :class="step.type">
          <div class="step-header">
            <span class="step-type-label">{{ step.type }}</span>
            <span class="step-time">{{ step.timestamp }}</span>
          </div>
          <div v-if="step.html" class="step-content markdown-content" v-html="step.html"></div>
          <div v-else class="step-content">{{ step.content }}</div>
        </div>
      </div>
    </div>

    <div class="input-area">
      <div class="input-row">
        <div class="input-main">
          <textarea 
            v-model="goal" 
            placeholder="Describe your goal..."
            @keydown.enter.prevent="handleSend"
          ></textarea>
        </div>
        <button 
          class="send-btn" 
          :class="{ stop: isRunning }" 
          @click="handleSend"
          :disabled="!goal.trim() && !isRunning"
        >
          <span v-if="isRunning" class="i i-stop"></span>
          <span v-else class="i i-play"></span>
        </button>
      </div>
      <div class="task-footer-note">Copilot Sidebar can make mistakes. Please double-check responses.</div>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.steps-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  padding: 0 20px;
  justify-content: center;
  align-items: center;
  min-height: 100%;
}

.prompt-cloud {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.task-mascot {
  width: 64px;
  height: 64px;
  margin-bottom: 8px;
}

.prompt-cloud-title {
  font-size: 14px;
  color: rgba(223, 206, 179, 0.62);
  text-align: center;
}

.step-wrapper {
  display: flex;
  width: 100%;
}

.step-wrapper.user {
  justify-content: flex-end;
}

.step {
  padding: 14px 18px;
  border-radius: 12px;
  font-size: 14px;
  word-break: break-word;
  animation: reveal-soft 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  max-width: 90%;
}

.step.user {
  background: var(--surface2);
  border-bottom-right-radius: 2px;
  border-left: none;
  color: var(--text);
}

.step.thought {
  background: var(--surface);
  border-left: 3px solid var(--accent);
}

.step.action {
  background: var(--surface2);
  border-left: 3px solid var(--success);
}

.step.success {
  background: rgba(110, 148, 96, 0.1);
  border-left: 3px solid var(--success);
  max-width: 100%;
  overflow-x: auto; /* Enable horizontal scrolling */
}

.step.success .step-content {
  white-space: nowrap; /* Prevent wrapping for success content as requested */
}

.step.success .markdown-content :deep(*) {
  white-space: normal; /* Allow normal wrapping inside markdown elements like paragraphs */
}

.step.success .markdown-content :deep(pre),
.step.success .markdown-content :deep(code) {
  white-space: pre; /* Keep code blocks from wrapping */
}

.step.error {
  background: rgba(225, 112, 85, 0.1);
  border-left: 3px solid var(--error);
}

.step-header {
  font-size: 11px;
  color: var(--text2);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 1px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.step-content {
  white-space: pre-wrap;
  line-height: 1.6;
}

.input-area {
  padding: 12px 16px 10px;
  background: var(--bg);
  flex-shrink: 0;
  border-top: 1px solid var(--border);
}

.input-row {
  display: flex;
  gap: 12px;
  align-items: stretch;
  background: linear-gradient(180deg, #1d1b18 0%, #1a1815 100%);
  border: 1px solid rgba(223, 206, 179, 0.16);
  border-radius: 14px;
  padding: 10px 12px 8px;
}

.input-main {
  flex: 1;
  min-width: 0;
}

textarea {
  width: 100%;
  background: transparent;
  border: none;
  padding: 8px 10px 0;
  color: rgba(223, 206, 179, 0.82);
  font-size: 15px;
  font-family: inherit;
  resize: none;
  height: 38px;
  outline: none;
}

.send-btn {
  background: #34312d;
  border: none;
  color: rgba(223, 206, 179, 0.75);
  width: 38px;
  height: 38px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  align-self: center;
  transition: all 0.2s;
}

.send-btn:hover:not(:disabled) {
  background: #3c3934;
  color: var(--text);
}

.send-btn.stop {
  background: rgba(225, 112, 85, 0.15);
  color: var(--error);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.task-footer-note {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(223, 206, 179, 0.42);
  text-align: center;
}

@keyframes reveal-soft {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
