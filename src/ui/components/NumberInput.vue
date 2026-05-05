<script setup>
import { defineProps, defineEmits } from 'vue';

defineProps({
  label: { type: String, required: true },
  modelValue: { type: [Number, String], default: '' },
  min: { type: Number, default: 1 },
});

const emit = defineEmits(['update:modelValue']);

function onInput(event) {
  const value = event.target.value;
  const num = value === '' ? '' : Number(value);
  emit('update:modelValue', isNaN(num) ? value : num);
}
</script>

<template>
  <div class="input-group mb-4">
    <label class="mb-2 block text-[10px] uppercase tracking-[1px] text-skin-muted">{{ label }}</label>
    <input
      :value="modelValue"
      @input="onInput"
      type="number"
      :min="min"
      class="w-full rounded-lg border border-white/10 bg-[#1b1e23] px-3 py-2.5 text-[13px] text-skin-text outline-none transition focus:border-skin-accent"
    />
  </div>
</template>
