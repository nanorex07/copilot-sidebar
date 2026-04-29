<script setup>
import { ref, defineProps, defineEmits, watch } from 'vue'

const props = defineProps({
  isRunning: Boolean,
  modelValue: String
})

const emit = defineEmits(['update:modelValue', 'send', 'stop'])

const goal = ref(props.modelValue)

watch(() => props.modelValue, (val) => {
  goal.value = val
})

watch(goal, (val) => {
  emit('update:modelValue', val)
})

const handleSend = () => {
  if (goal.value.trim() && !props.isRunning) {
    emit('send', goal.value)
  }
}

const handleStop = () => {
  emit('stop')
}
</script>

<template>
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
</template>

<style scoped>
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
</style>
