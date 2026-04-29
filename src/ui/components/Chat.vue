<script setup>
import { ref, onMounted, nextTick, defineExpose, watch } from 'vue'
import { Agent } from '../../services/agent'
import { parseMarkdown } from '../../utils/markdown'
import { STEP_TYPES } from '../../config/constants'

import ChatShowcase from './ChatShowcase.vue'
import ChatStep from './ChatStep.vue'
import ChatInput from './ChatInput.vue'

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

      if (entry._isSummary) continue;

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
    case 'hover': return `Hovering element [${args.target}]`
    case 'press_key': return `Pressing ${args.key}`
    case 'extract_structured': return `Extracting structured data`
    case 'wait_for': return `Waiting for ${args.condition}`
    case 'navigate': return `Navigating ${args.action}`
    case 'done': return `Task complete`
    case 'fail': return `Task failed: ${args.reason || ''}`
    default: return `${tool}(${JSON.stringify(args)})`
  }
}

function toggleCollapse(index) {
  if(steps.value[index]) steps.value[index].collapsed = !steps.value[index].collapsed
}

function toggleArgs(index) {
  if(steps.value[index]) steps.value[index].argsCollapsed = !steps.value[index].argsCollapsed
}

function toggleResult(index) {
  if(steps.value[index]) steps.value[index].resultCollapsed = !steps.value[index].resultCollapsed
}

function toggleThought(index) {
  if (steps.value[index] && steps.value[index].type === 'thought') {
    steps.value[index].expanded = !steps.value[index].expanded
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (stepsContainer.value) {
    stepsContainer.value.scrollTop = stepsContainer.value.scrollHeight
  }
}

const handleSend = async (text) => {
  if (!text.trim() || isRunning.value) return
  const userGoal = text
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
      <ChatShowcase v-if="steps.length === 0" />

      <!-- Steps -->
      <ChatStep 
        v-for="(step, index) in steps" 
        :key="index" 
        :step="step" 
        :index="index"
        @toggleCollapse="toggleCollapse"
        @toggleArgs="toggleArgs"
        @toggleResult="toggleResult"
        @toggleThought="toggleThought"
      />

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
    <ChatInput 
      v-model="goal" 
      :isRunning="isRunning" 
      @send="handleSend" 
      @stop="handleStop" 
    />
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

/* Base step styles used for the thinking indicator */
.step-wrapper {
  display: flex;
  width: 100%;
}
.step {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  word-break: break-word;
  animation: reveal-soft 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  max-width: 95%;
}
.step.thought {
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
