<script setup>
import { defineProps, defineEmits, ref } from 'vue'

const props = defineProps({
  step: Object,
  index: Number
})

const emit = defineEmits(['toggleThought', 'toggleCollapse', 'toggleArgs', 'toggleResult'])

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
  <div class="step-wrapper" :class="step.type">
    <!-- User message -->
    <div v-if="step.type === 'user'" class="step user">
      <div class="step-content">{{ step.content }}</div>
    </div>

    <!-- Thought -->
    <div v-else-if="step.type === 'thought'" class="step thought" :class="{ expanded: step.expanded }" @click="$emit('toggleThought', index)">
      <div class="step-icon"><span class="i i-brain"></span></div>
      <div class="step-content" :class="{ 'step-inline': !step.expanded }">{{ step.content }}</div>
    </div>

    <!-- Action -->
    <div v-else-if="step.type === 'action'" class="step action">
      <div class="step-icon"><span class="i i-zap"></span></div>
      <div class="step-content step-inline">{{ step.content }}</div>
    </div>

    <!-- Tool Call -->
    <div v-else-if="step.type === 'tool_call'" class="step tool-call">
      <div class="tool-header" @click="$emit('toggleCollapse', index)">
        <span class="i i-chevron-right tool-chevron" :class="{ open: !step.collapsed }"></span>
        <span class="i i-wrench tool-icon"></span>
        <span class="tool-label">{{ step.displayLabel }}</span>
      </div>
      <div v-if="!step.collapsed" class="tool-detail">
        <div v-if="step.summary" class="tool-summary-row">
          <span class="tool-summary">{{ step.summary }}</span>
        </div>
        <div class="tool-section">
          <div class="tool-section-header" @click="$emit('toggleArgs', index)">
            <span class="i i-chevron-right tool-chevron sm" :class="{ open: !step.argsCollapsed }"></span>
            <span class="tool-section-title">Arguments</span>
          </div>
          <pre v-if="!step.argsCollapsed">{{ JSON.stringify(step.toolArgs, null, 2) }}</pre>
        </div>
        <div v-if="step.resultData" class="tool-section">
          <div class="tool-section-header" @click="$emit('toggleResult', index)">
            <span class="i i-chevron-right tool-chevron sm" :class="{ open: !step.resultCollapsed }"></span>
            <span class="tool-section-title">Result</span>
          </div>
          <pre v-if="!step.resultCollapsed">{{ typeof step.resultData === 'object' ? JSON.stringify(step.resultData, null, 2) : step.resultData }}</pre>
        </div>
      </div>
    </div>

    <!-- Success -->
    <div v-else-if="step.type === 'success'" class="step success">
      <div class="step-header">
        <div class="step-header-left">
          <span class="step-time">{{ step.timestamp }}</span>
          <span class="step-type-label"><b>answer</b></span>
        </div>
        <button class="copy-btn" @click="handleCopy" :title="copied ? 'Copied!' : 'Copy to clipboard'">
          <span class="i" :class="copied ? 'i-check' : 'i-copy'"></span>
          <span class="copy-text">{{ copied ? 'Copied' : 'Copy' }}</span>
        </button>
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
</template>

<style scoped>
.step-wrapper {
  display: flex;
  width: 100%;
}
.step-wrapper.user {
  justify-content: flex-end;
}

.step {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  word-break: break-word;
  animation: reveal-soft 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  max-width: 95%;
}

.step.user {
  background: rgba(82, 148, 226, 0.12);
  border: 1px solid rgba(82, 148, 226, 0.2);
  border-bottom-right-radius: 2px;
  color: var(--text);
  max-width: 80%;
}

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

.step.thought {
  cursor: pointer;
  transition: background 0.2s, border-radius 0.2s;
}

.step.thought:hover {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.step.thought.expanded {
  align-items: flex-start;
}

.step.thought.expanded .step-content {
  white-space: pre-wrap;
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
  margin-left: 18px;
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
  margin-bottom: 0;
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
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.step-header-left {
  display: flex;
  gap: 12px;
  align-items: center;
}

.copy-btn {
  background: transparent;
  border: none;
  color: var(--text2);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
  opacity: 0.6;
}

.copy-text {
  font-size: 11px;
  font-weight: 500;
  text-transform: capitalize;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
  opacity: 1;
}

.copy-btn .i {
  font-size: 12px;
}

.copy-btn .i-check {
  color: var(--success);
}

.step-content {
  line-height: 1.6;
}

.step.error {
  background: transparent;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--error);
}

@keyframes reveal-soft {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
