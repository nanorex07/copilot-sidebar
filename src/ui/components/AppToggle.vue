<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: ''
  }
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="mb-4 flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3.5 py-3">
    <span v-if="label" class="text-[13px] text-skin-muted">{{ label }}</span>
    <label class="relative inline-block h-5 w-9 shrink-0">
      <input
        type="checkbox"
        :checked="modelValue"
        class="peer sr-only"
        @change="$emit('update:modelValue', $event.target.checked)"
      />
      <span class="absolute inset-0 rounded-full border border-white/10 bg-black/30 transition peer-checked:border-skin-accent/40 peer-checked:bg-skin-accent/15"></span>
      <span class="absolute left-[3px] top-[3px] h-3 w-3 rounded-full bg-skin-muted shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition peer-checked:translate-x-4 peer-checked:bg-skin-accent peer-checked:shadow-[0_0_8px_rgba(82,148,226,0.4)]"></span>
    </label>
  </div>
</template>
