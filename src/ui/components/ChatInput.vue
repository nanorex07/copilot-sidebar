<script setup>
import { ref, defineProps, defineEmits, watch, defineExpose } from 'vue'

const props = defineProps({
  isRunning: Boolean,
  modelValue: String,
  inputEnabled: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'send', 'stop'])

const goal = ref(props.modelValue)
const inputRef = ref(null)

watch(() => props.modelValue, (val) => {
  goal.value = val
})

watch(goal, (val) => {
  emit('update:modelValue', val)
})

const handleSend = () => {
  if (goal.value.trim() && props.inputEnabled) {
    emit('send', goal.value)
  }
}

const handleStop = () => {
  emit('stop')
}

const focusInput = () => {
  if (inputRef.value) inputRef.value.focus()
}

defineExpose({ focusInput })
</script>

<template>
  <div class="shrink-0 border-t border-skin-border bg-skin-bg px-4 pt-3 pb-2 sm:px-5">
    <div class="flex items-stretch gap-3 rounded-2xl border border-white/10 bg-[#21252b] px-3 py-2">
      <div class="min-w-0 flex-1">
        <textarea
          ref="inputRef"
          v-model="goal"
          placeholder="Ask copilot here..."
          class="h-10 w-full resize-none border-none bg-transparent px-2.5 pt-1.5 text-[15px] text-skin-text/80 outline-none placeholder:text-skin-muted/60"
          @keydown.enter.prevent="handleSend"
          :disabled="!inputEnabled"
        ></textarea>
      </div>
      <button
        v-if="isRunning"
        class="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-[10px] bg-skin-error/15 text-skin-error transition"
        @click="handleStop"
        title="Stop"
      >
        <span class="i i-stop"></span>
      </button>
      <button
        v-else
        class="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-[10px] bg-[#4b5162] text-skin-text/75 transition hover:bg-[#5a6078] hover:text-skin-text disabled:cursor-not-allowed disabled:opacity-50"
        @click="handleSend"
        :disabled="!goal.trim() || !inputEnabled"
        title="Send"
      >
        <span class="i i-play"></span>
      </button>
    </div>
    <div class="mt-2 text-center text-xs text-skin-text/35">Copilot Sidebar can make mistakes. Please double-check responses.</div>
  </div>
</template>
