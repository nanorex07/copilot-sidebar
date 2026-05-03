<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: [Number, String], default: '' },
  min: { type: Number, default: 1 },
});

const emit = defineEmits(['update:modelValue']);

function onInput(event) {
  const value = event.target.value;
  // Convert to number if possible, otherwise keep as string
  const num = value === '' ? '' : Number(value);
  emit('update:modelValue', isNaN(num) ? value : num);
}
</script>

<template>
  <div class="input-group">
    <label class="input-label">{{ label }}</label>
    <input
      :value="modelValue"
      @input="onInput"
      type="number"
      :min="min"
      class="provider-input"
    />
  </div>
</template>

<style scoped>
.input-group {
  margin-bottom: 16px;
}
.input-label {
  display: block;
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text2);
  margin-bottom: 8px;
}
.provider-input {
  width: 100%;
  background: #1b1e23;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--text);
  padding: 10px 12px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
}
.provider-input:focus {
  border-color: var(--accent);
}
</style>
