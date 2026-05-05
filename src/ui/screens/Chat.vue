<script setup>
import { ref, onMounted, nextTick, defineExpose, watch } from 'vue'
import { Agent } from '../../services/agent'
import { parseMarkdown } from '../../utils/markdown'
import { STEP_TYPES } from '../../config/constants'

import ChatShowcase from '../components/ChatShowcase.vue'
import ChatStep from '../components/ChatStep.vue'
import ChatInput from '../components/ChatInput.vue'
import HumanInputPrompt from '../components/HumanInputPrompt.vue'

const goal = ref('')
const steps = ref([])
const isRunning = ref(false)
const isGenerating = ref(false)
const agentStatus = ref('idle')
const stepsContainer = ref(null)
const pendingHumanPrompt = ref(null)
const chatInputRef = ref(null)

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
    agentStatus.value = status
    isRunning.value = (status === 'running' || status === 'thinking' || status === 'waiting_for_input')
    isGenerating.value = (status === 'thinking')
  })

  agent.onHumanInput((payload) => {
    pendingHumanPrompt.value = payload
    steps.value.push({
      type: STEP_TYPES.INTERRUPT,
      content: payload.question,
      timestamp: payload.timestamp,
    })
    scrollToBottom()
    if (payload.inputType === 'text') {
      nextTick(() => {
        chatInputRef.value?.focusInput?.()
      })
    }
  })

  if (agent.history.length > 0) {
    for (const entry of agent.history) {
      const timestamp = entry.timestamp || '-'
      if (entry._isSummary) continue

      if (entry.role === 'user') {
        steps.value.push({
          type: STEP_TYPES.USER,
          content: entry.content,
          timestamp,
          isInterruptReply: !!entry?._meta?.fromInterrupt,
          interruptTool: entry?._meta?.interruptTool || null,
          interruptQuestion: entry?._meta?.question || ''
        })
      } else if (entry.role === 'assistant' && entry.tool_calls) {
        if (entry.content) {
          steps.value.push({ type: STEP_TYPES.THOUGHT, content: entry.content, timestamp })
        }
        continue
      } else if (entry.role === 'tool' && entry._meta) {
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

function enrichStep(step) {
  const enriched = {
    ...step,
    collapsed: true,
    argsCollapsed: true,
    resultCollapsed: true
  }

  if (step.type === STEP_TYPES.SUCCESS) enriched.html = parseMarkdown(step.content)

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
    case 'human_in_the_loop': return `Waiting for user choice`
    case 'human_context': return `Waiting for user context`
    default: return `${tool}(${JSON.stringify(args)})`
  }
}

function toggleCollapse(index) {
  if (steps.value[index]) steps.value[index].collapsed = !steps.value[index].collapsed
}

function toggleArgs(index) {
  if (steps.value[index]) steps.value[index].argsCollapsed = !steps.value[index].argsCollapsed
}

function toggleResult(index) {
  if (steps.value[index]) steps.value[index].resultCollapsed = !steps.value[index].resultCollapsed
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
  if (!text.trim()) return

  if (agentStatus.value === 'waiting_for_input' && pendingHumanPrompt.value?.inputType === 'text') {
    const userReply = text
    goal.value = ''
    steps.value.push({
      type: STEP_TYPES.USER,
      content: userReply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isInterruptReply: true,
      interruptTool: 'human_context',
      interruptQuestion: pendingHumanPrompt.value?.question || ''
    })
    pendingHumanPrompt.value = null
    await agent.submitHumanInput(userReply)
    scrollToBottom()
    return
  }

  if (isRunning.value) return

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
  pendingHumanPrompt.value = null
}

const handleHumanSelection = async (option) => {
  steps.value.push({
    type: STEP_TYPES.USER,
    content: option,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isInterruptReply: true,
    interruptTool: 'human_in_the_loop',
    interruptQuestion: pendingHumanPrompt.value?.question || ''
  })
  pendingHumanPrompt.value = null
  await agent.submitHumanInput(option)
  scrollToBottom()
}

const clearHistory = async () => {
  await agent.clearHistory()
  steps.value = []
  pendingHumanPrompt.value = null
}

defineExpose({ clearHistory })
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div ref="stepsContainer" class="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4 sm:px-5">
      <ChatShowcase v-if="steps.length === 0" />

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

      <div v-if="isGenerating" class="flex w-full">
        <div class="flex max-w-full items-center gap-2 px-2.5 py-1.5 text-[13px] text-skin-muted">
          <div class="text-sm"><span class="i i-brain"></span></div>
          <div class="flex min-h-5 items-center gap-1 py-1">
            <span class="h-1.5 w-1.5 animate-typing rounded-full bg-skin-text/60 shadow-[0_0_4px_rgba(255,255,255,0.1)]"></span>
            <span class="h-1.5 w-1.5 animate-typing rounded-full bg-skin-text/60 shadow-[0_0_4px_rgba(255,255,255,0.1)] [animation-delay:-0.16s]"></span>
            <span class="h-1.5 w-1.5 animate-typing rounded-full bg-skin-text/60 shadow-[0_0_4px_rgba(255,255,255,0.1)] [animation-delay:-0.32s]"></span>
          </div>
        </div>
      </div>
    </div>

    <HumanInputPrompt
      v-if="pendingHumanPrompt && pendingHumanPrompt.inputType === 'choice'"
      :prompt="pendingHumanPrompt"
      @select="handleHumanSelection"
    />
    <ChatInput
      ref="chatInputRef"
      v-model="goal"
      :isRunning="isRunning"
      :inputEnabled="!isRunning || (agentStatus === 'waiting_for_input' && pendingHumanPrompt?.inputType === 'text')"
      @send="handleSend"
      @stop="handleStop"
    />
  </div>
</template>
