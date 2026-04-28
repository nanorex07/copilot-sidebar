<script setup>
import { ref, onMounted, nextTick, defineExpose, watch } from 'vue'
import { Agent } from '../../services/agent'
import { parseMarkdown } from '../../services/markdown'
import { STEP_TYPES } from '../../config/constants'

const goal = ref('')
const steps = ref([])
const isRunning = ref(false)
const isGenerating = ref(false)
const stepsContainer = ref(null)

const agent = new Agent('main-session')

watch(isGenerating, (val) => {
  if (val) scrollToBottom()
})

onMounted(async () => {
  await agent.init()

  agent.onStep((step) => {
    const enriched = enrichStep(step)
    steps.value.push(enriched)
    scrollToBottom()
  })

  agent.onStatus((status) => {
    isRunning.value = (status === 'running' || status === 'thinking')
    isGenerating.value = (status === 'thinking')
  })

  // Reconstruct UI steps from persisted history
  if (agent.history.length > 0) {
    for (const entry of agent.history) {
      const timestamp = entry.timestamp || '-'

      if (entry.role === 'user') {
        steps.value.push({ type: STEP_TYPES.USER, content: entry.content, timestamp })
      } else if (entry.role === 'assistant' && entry.tool_calls) {
        // Assistant message that triggered tool calls — show content as thought if present
        if (entry.content) {
          steps.value.push({ type: STEP_TYPES.THOUGHT, content: entry.content, timestamp })
        }
        continue
      } else if (entry.role === 'tool' && entry._meta) {
        // Tool result with metadata — show as a combined tool_call step
        const meta = entry._meta
        steps.value.push({
          type: STEP_TYPES.TOOL_CALL,
          toolName: meta.toolName,
          toolArgs: meta.toolArgs,
          resultData: meta.result,
          summary: meta.summary,
          displayLabel: formatToolLabel(meta.toolName, meta.toolArgs),
          collapsed: true,
          argsCollapsed: true,
          resultCollapsed: true,
          timestamp,
        })
      } else if (entry.role === 'tool') {
        // Tool result without metadata (shouldn't happen, but be safe)
        continue
      } else if (entry.role === 'assistant') {
        steps.value.push({
          type: STEP_TYPES.SUCCESS,
          content: entry.content,
          html: parseMarkdown(entry.content),
          timestamp,
        })
      }
    }
  }
})

/**
 * Enrich a raw step emitted by the agent with parsed data for the UI
 */
function enrichStep(step) {
  const enriched = { 
    ...step, 
    collapsed: true, 
    argsCollapsed: true, 
    resultCollapsed: true 
  }

  if (step.type === STEP_TYPES.SUCCESS) {
    enriched.html = parseMarkdown(step.content)
  }

  if (step.type === STEP_TYPES.TOOL_CALL) {
    try {
      const data = JSON.parse(step.content)
      enriched.toolName = data.tool
      enriched.toolArgs = data.args
      enriched.resultData = data.result || null
      enriched.summary = data.summary || ''
      enriched.displayLabel = formatToolLabel(data.tool, data.args)
    } catch {
      enriched.displayLabel = step.content
    }
  }

  return enriched
}

/**
 * Create a human-readable label for a tool call
 */
function formatToolLabel(tool, args) {
  switch (tool) {
    case 'read_page': return `Reading page (${args.mode || 'compact'} mode)`
    case 'get_page_text': return `Extracting text (${args.scope || 'full'})`
    case 'find': return `Finding: "${args.query}"`
    case 'find_text': return `Searching text: "${args.query}"`
    case 'click': return `Clicking element [${args.target}]`
    case 'type': return `Typing "${args.text}" into [${args.target}]`
    case 'select': return `Selecting "${args.value}" in [${args.target}]`
    case 'scroll': return `Scrolling ${args.direction}`
    case 'press_key': return `Pressing ${args.key}`
    case 'done': return `Task complete`
    case 'fail': return `Task failed: ${args.reason || ''}`
    default: return `${tool}(${JSON.stringify(args)})`
  }
}

function toggleCollapse(index) {
  steps.value[index].collapsed = !steps.value[index].collapsed
}

function toggleArgs(index) {
  steps.value[index].argsCollapsed = !steps.value[index].argsCollapsed
}

function toggleResult(index) {
  steps.value[index].resultCollapsed = !steps.value[index].resultCollapsed
}

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
  steps.value.push({
    type: STEP_TYPES.USER,
    content: userGoal,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  })
  scrollToBottom()
  await agent.run(userGoal)
}

const handleStop = () => {
  agent.abort()
}

const clearHistory = async () => {
  await agent.clearHistory()
  steps.value = []
}

defineExpose({ clearHistory })
</script>

<template>
  <div class="chat-view">
    <div class="steps-container" ref="stepsContainer">
      <!-- Empty state / Showcase -->
      <div v-if="steps.length === 0" class="showcase">
        <div class="showcase-header">
          <h2>Welcome to Copilot Sidebar</h2>
          <p>I can navigate and interact with any website for you.</p>
        </div>

        <div class="showcase-demo">
          <div class="showcase-label">EXAMPLE INTERACTION</div>
          
          <div class="step-wrapper user">
            <div class="step user">
              <div class="step-content">Find the best selling product on this page.</div>
            </div>
          </div>

          <div class="step-wrapper thought">
            <div class="step thought">
              <div class="step-icon"><span class="i i-brain"></span></div>
              <div class="step-content step-inline">Analyzing page structure to identify products...</div>
            </div>
          </div>

          <div class="step-wrapper tool_call">
            <div class="step tool-call">
              <div class="tool-header">
                <span class="i i-chevron-right tool-chevron"></span>
                <span class="i i-wrench tool-icon"></span>
                <span class="tool-label">read_page(mode="compact")</span>
              </div>
              <div class="tool-summary-row">
                <span class="tool-summary">Extracted 2,450 chars of page text</span>
              </div>
            </div>
          </div>

          <div class="step-wrapper success">
            <div class="step success">
              <div class="step-header">
                <span class="step-time">demo</span>
                <span class="step-type-label"><b>answer</b></span>
              </div>
              <div class="step-content">
                The best selling product is the **SuperWidget Pro**, currently priced at $49.99.
              </div>
            </div>
          </div>

          <div class="step-wrapper error">
            <div class="step error">
              <div class="step-icon"><span class="i i-alert-circle"></span></div>
              <div class="step-content step-inline">Could not find a "Checkout" button to proceed.</div>
            </div>
          </div>
        </div>

        <div class="showcase-footer">
          Try: "Summarize this page", "Fill this form with dummy data", or "Find the pricing section".
        </div>
      </div>

      <!-- Steps -->
      <div v-for="(step, index) in steps" :key="index" class="step-wrapper" :class="step.type">

        <!-- User message -->
        <div v-if="step.type === 'user'" class="step user">
          <div class="step-content">{{ step.content }}</div>
        </div>

        <!-- Thought -->
        <div v-else-if="step.type === 'thought'" class="step thought">
          <div class="step-icon"><span class="i i-brain"></span></div>
          <div class="step-content step-inline">{{ step.content }}</div>
        </div>

        <!-- Action -->
        <div v-else-if="step.type === 'action'" class="step action">
          <div class="step-icon"><span class="i i-zap"></span></div>
          <div class="step-content step-inline">{{ step.content }}</div>
        </div>

        <!-- Tool Call (collapsible) — shows args + returned result -->
        <div v-else-if="step.type === 'tool_call'" class="step tool-call">
          <div class="tool-header" @click="toggleCollapse(index)">
            <span class="i i-chevron-right tool-chevron" :class="{ open: !step.collapsed }"></span>
            <span class="i i-wrench tool-icon"></span>
            <span class="tool-label">{{ step.displayLabel }}</span>
          </div>
          <div v-if="step.summary" class="tool-summary-row" @click="toggleCollapse(index)">
            <span class="tool-summary">{{ step.summary }}</span>
          </div>
          <div v-if="!step.collapsed" class="tool-detail">
            <!-- Arguments section -->
            <div class="tool-section">
              <div class="tool-section-header" @click="toggleArgs(index)">
                <span class="i i-chevron-right tool-chevron sm" :class="{ open: !step.argsCollapsed }"></span>
                <span class="tool-section-title">Arguments</span>
              </div>
              <pre v-if="!step.argsCollapsed">{{ JSON.stringify(step.toolArgs, null, 2) }}</pre>
            </div>
            <!-- Result section -->
            <div v-if="step.resultData" class="tool-section">
              <div class="tool-section-header" @click="toggleResult(index)">
                <span class="i i-chevron-right tool-chevron sm" :class="{ open: !step.resultCollapsed }"></span>
                <span class="tool-section-title">Result</span>
              </div>
              <pre v-if="!step.resultCollapsed">{{ typeof step.resultData === 'object' ? JSON.stringify(step.resultData, null, 2) : step.resultData }}</pre>
            </div>
          </div>
        </div>

        <!-- Success / Final Answer -->
        <div v-else-if="step.type === 'success'" class="step success">
          <div class="step-header">
            <span class="step-time">{{ step.timestamp }}</span>
            <span class="step-type-label"><b>answer</b></span>
          </div>
          <div v-if="step.html" class="step-content markdown-content" v-html="step.html"></div>
          <div v-else class="step-content">{{ step.content }}</div>
        </div>

        <!-- Error -->
        <div v-else-if="step.type === 'error'" class="step error">
          <div class="step-icon"><span class="i i-alert-circle"></span></div>
          <div class="step-content step-inline">{{ step.content }}</div>
        </div>
      </div>

      <!-- Thinking Loader -->
      <div v-if="isGenerating" class="step-wrapper thought">
        <div class="step thought">
          <div class="step-icon"><span class="i i-brain"></span></div>
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Input area -->
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
          v-if="isRunning"
          class="send-btn stop"
          @click="handleStop"
          title="Stop"
        >
          <span class="i i-stop"></span>
        </button>
        <button
          v-else
          class="send-btn"
          @click="handleSend"
          :disabled="!goal.trim()"
          title="Send"
        >
          <span class="i i-play"></span>
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
  padding: 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
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
}

.task-mascot {
  width: 64px;
  height: 64px;
  margin-bottom: 8px;
}

.prompt-cloud-title {
  font-size: 14px;
  color: rgba(211, 218, 227, 0.55);
  text-align: center;
  line-height: 1.6;
}

/* ── Showcase ── */
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

/* ── Step Wrapper ── */
.step-wrapper {
  display: flex;
  width: 100%;
}
.step-wrapper.user {
  justify-content: flex-end;
}

/* ── Base Step ── */
.step {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  word-break: break-word;
  animation: reveal-soft 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  max-width: 95%;
}

/* ── User ── */
.step.user {
  background: rgba(82, 148, 226, 0.12);
  border: 1px solid rgba(82, 148, 226, 0.2);
  border-bottom-right-radius: 2px;
  color: var(--text);
  max-width: 80%;
}

/* ── Thought / Action ── */
.step.thought, .step.action {
  background: transparent;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text2);
  max-width: 100%;
}

.step-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.step-inline {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Tool Call (combined args + result) ── */
.step.tool-call {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 10px 14px;
  max-width: 100%;
  transition: border-color 0.15s;
}

.step.tool-call:hover {
  border-color: rgba(124, 129, 140, 0.3);
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text2);
  cursor: pointer;
}

.tool-chevron {
  font-size: 10px;
  transition: transform 0.15s;
  color: rgba(211, 218, 227, 0.35);
  display: inline-block;
}
.tool-chevron.sm {
  font-size: 8px;
}
.tool-chevron.open {
  transform: rotate(90deg);
}

.tool-icon {
  font-size: 13px;
}

.tool-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-summary-row {
  margin-top: 2px;
  margin-left: 18px; /* Align with tool-label */
  cursor: pointer;
}

.tool-summary {
  font-size: 11px;
  color: var(--success);
  font-weight: 500;
  opacity: 0.9;
}

.tool-detail {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-section {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  padding: 10px 12px;
  max-height: 300px;
  overflow: auto;
}

.tool-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  user-select: none;
}

.tool-section-header:hover .tool-section-title {
  color: rgba(211, 218, 227, 0.7);
}

.tool-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: rgba(211, 218, 227, 0.45);
  margin-bottom: 0; /* Override previous margin */
}

.tool-section pre {
  font-family: var(--font-mono);
  font-size: 12px;
  color: rgba(211, 218, 227, 0.7);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  margin-top: 4px;
}

.step.success {
  background: rgba(0, 0, 0, 0.2);
  border-left: 3px solid var(--success);
  border-radius: 10px;
  max-width: 100%;
  overflow-x: auto;
}

.markdown-content {
  min-width: 0;
  width: 100%;
  overflow-x: auto;
}

.markdown-content :deep(pre),
.markdown-content :deep(table) {
  min-width: 200px;
  max-width: 100%;
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
  line-height: 1.6;
}

/* ── Error ── */
.step.error {
  background: transparent;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--error);
}

/* ── Input Area ── */
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
  background: #21252b;
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  padding: 6px 10px 0;
  color: rgba(211, 218, 227, 0.82);
  font-size: 15px;
  font-family: inherit;
  resize: none;
  height: 38px;
  outline: none;
}

.send-btn {
  background: #4b5162;
  border: none;
  color: rgba(211, 218, 227, 0.75);
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
  background: #5a6078;
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
  color: rgba(211, 218, 227, 0.35);
  text-align: center;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 4px 0;
  min-height: 20px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: var(--text);
  border-radius: 50%;
  display: inline-block;
  opacity: 0.6;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.1);
  animation: typing 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
  40% { transform: scale(1.1); opacity: 1; }
}

@keyframes reveal-soft {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
