<script setup>
import { defineProps, defineEmits, ref } from 'vue'

const props = defineProps({
  prompt: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['select'])
const selected = ref('')

const handleSelect = (option) => {
  if (selected.value) return
  selected.value = option
  emit('select', option)
}
</script>

<template>
  <div class="mx-4 mb-3 overflow-hidden rounded-[14px] border border-[#7bb7ff33] bg-[linear-gradient(160deg,rgba(82,148,226,0.22),rgba(32,38,52,0.92)_45%,rgba(24,28,38,0.98))] shadow-[0_10px_30px_rgba(19,26,39,0.35)] sm:mx-5">
    <div class="border-b border-white/10 px-3.5 py-2.5">
      <div class="flex items-center gap-2 text-[11px] uppercase tracking-[1.1px] text-[#a8ccf5]">
        <span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#9cc6ff55] bg-[#9cc6ff1f]">
          <span class="i i-user-check text-[10px]"></span>
        </span>
        <span>Human In The Loop</span>
      </div>
    </div>

    <div class="px-3.5 py-3">
      <p class="mb-3 text-[13px] leading-relaxed text-[#d9e7f7]">{{ prompt.question }}</p>

      <div class="flex flex-col gap-2">
        <button
          v-for="(option, index) in prompt.options"
          :key="`${index}-${option}`"
          class="group rounded-xl border border-white/12 bg-black/25 px-3.5 py-2.5 text-left text-[13px] text-[#dbe3ee] transition duration-150 hover:-translate-y-[1px] hover:border-[#8fc3ff80] hover:bg-[#79b4ff1f]"
          :class="selected && selected !== option ? 'opacity-55' : ''"
          :disabled="!!selected"
          @click="handleSelect(option)"
        >
          <span class="inline-flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-[#8fc3ffcc] transition group-hover:scale-125"></span>
            <span>{{ option }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
