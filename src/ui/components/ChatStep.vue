<script setup>
import { defineProps, defineEmits, ref } from 'vue'

const props = defineProps({
  step: Object,
  index: Number
})

defineEmits(['toggleThought', 'toggleCollapse', 'toggleArgs', 'toggleResult'])

const copied = ref(false)

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(props.step.content)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy text: ', err)
  }
}
</script>

<template>
  <div class="flex w-full" :class="step.type === 'user' ? 'justify-end' : ''">
    <div
      v-if="step.type === 'user'"
      class="max-w-[88%] rounded-xl rounded-br-[2px] border px-4 py-3 text-sm text-skin-text animate-reveal-soft sm:max-w-[80%]"
      :class="step.isInterruptReply ? 'border-skin-success/30 bg-skin-success/12' : 'border-skin-accent/20 bg-skin-accent/12'"
    >
      <div v-if="step.isInterruptReply" class="mb-1 text-[10px] uppercase tracking-[0.9px] text-skin-success/90">
        {{ step.interruptTool === 'human_context' ? 'Context Reply' : 'Selected Option' }}
      </div>
      <div>{{ step.content }}</div>
    </div>

    <div
      v-else-if="step.type === 'thought'"
      class="flex max-w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[13px] text-skin-muted transition hover:rounded-md hover:bg-white/5"
      :class="step.expanded ? 'items-start' : ''"
      @click="$emit('toggleThought', index)"
    >
      <div class="shrink-0 text-sm"><span class="i i-brain"></span></div>
      <div :class="step.expanded ? 'whitespace-pre-wrap' : 'truncate'">{{ step.content }}</div>
    </div>

    <div v-else-if="step.type === 'action'" class="flex max-w-full items-center gap-2 px-2.5 py-1.5 text-[13px] text-skin-muted">
      <div class="shrink-0 text-sm"><span class="i i-zap"></span></div>
      <div class="truncate">{{ step.content }}</div>
    </div>

    <div v-else-if="step.type === 'interrupt'" class="flex max-w-full items-center gap-2 px-2.5 py-1.5 text-[13px] text-skin-accent">
      <div class="shrink-0 text-sm"><span class="i i-user-check"></span></div>
      <div class="truncate">{{ step.content }}</div>
    </div>

    <div v-else-if="step.type === 'tool_call'" class="w-full max-w-full rounded-[10px] border border-white/5 bg-black/20 px-3.5 py-2.5 transition hover:border-skin-accent/30">
      <div class="flex cursor-pointer items-center gap-2 text-[13px] text-skin-muted" @click="$emit('toggleCollapse', index)">
        <span class="i i-chevron-right inline-block text-[10px] text-skin-text/35 transition" :class="!step.collapsed ? 'rotate-90' : ''"></span>
        <span class="i i-wrench text-[13px]"></span>
        <span class="flex-1 truncate">{{ step.displayLabel }}</span>
      </div>

      <div v-if="!step.collapsed" class="mt-2.5 flex flex-col gap-2">
        <div v-if="step.summary" class="ml-[18px] mt-0.5">
          <span class="text-[11px] font-medium text-skin-success/90">{{ step.summary }}</span>
        </div>

        <div class="max-h-[300px] overflow-auto rounded-lg bg-black/15 px-3 py-2.5">
          <div class="mb-1.5 flex cursor-pointer items-center gap-1.5 select-none" @click="$emit('toggleArgs', index)">
            <span class="i i-chevron-right inline-block text-[8px] text-skin-text/35 transition" :class="!step.argsCollapsed ? 'rotate-90' : ''"></span>
            <span class="text-[11px] font-semibold uppercase tracking-[0.8px] text-skin-text/45">Arguments</span>
          </div>
          <pre v-if="!step.argsCollapsed" class="mt-1 whitespace-pre-wrap break-all text-xs text-skin-text/70 font-mono">{{ JSON.stringify(step.toolArgs, null, 2) }}</pre>
        </div>

        <div v-if="step.resultData" class="max-h-[300px] overflow-auto rounded-lg bg-black/15 px-3 py-2.5">
          <div class="mb-1.5 flex cursor-pointer items-center gap-1.5 select-none" @click="$emit('toggleResult', index)">
            <span class="i i-chevron-right inline-block text-[8px] text-skin-text/35 transition" :class="!step.resultCollapsed ? 'rotate-90' : ''"></span>
            <span class="text-[11px] font-semibold uppercase tracking-[0.8px] text-skin-text/45">Result</span>
          </div>
          <pre v-if="!step.resultCollapsed" class="mt-1 whitespace-pre-wrap break-all text-xs text-skin-text/70 font-mono">{{ typeof step.resultData === 'object' ? JSON.stringify(step.resultData, null, 2) : step.resultData }}</pre>
        </div>
      </div>
    </div>

    <div v-else-if="step.type === 'success'" class="w-full max-w-full overflow-x-auto rounded-[10px] border-l-[3px] border-skin-success bg-black/20 px-4 py-3 animate-reveal-soft">
      <div class="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[1px] text-skin-muted">
        <div class="flex items-center gap-3">
          <span>{{ step.timestamp }}</span>
          <span><b>answer</b></span>
        </div>
        <button class="flex items-center justify-center gap-1.5 rounded px-2 py-1 text-skin-muted opacity-60 transition hover:bg-white/10 hover:text-skin-text hover:opacity-100" @click="handleCopy" :title="copied ? 'Copied!' : 'Copy to clipboard'">
          <span class="i text-xs" :class="copied ? 'i-check text-skin-success' : 'i-copy'"></span>
          <span class="text-[11px] font-medium normal-case">{{ copied ? 'Copied' : 'Copy' }}</span>
        </button>
      </div>
      <div v-if="step.html" class="markdown-content w-full min-w-0 overflow-x-auto leading-relaxed" v-html="step.html"></div>
      <div v-else class="leading-relaxed">{{ step.content }}</div>
    </div>

    <div v-else-if="step.type === 'error'" class="flex max-w-full items-center gap-2 px-2.5 py-1.5 text-[13px] text-skin-error">
      <div class="shrink-0 text-sm"><span class="i i-alert-circle"></span></div>
      <div class="truncate">{{ step.content }}</div>
    </div>
  </div>
</template>
