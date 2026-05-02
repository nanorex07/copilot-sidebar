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
  <div class="toggle-group">
    <span v-if="label" class="toggle-label">{{ label }}</span>
    <label class="toggle-switch">
      <input 
        type="checkbox" 
        :checked="modelValue" 
        @change="$emit('update:modelValue', $event.target.checked)" 
      />
      <span class="toggle-slider"></span>
    </label>
  </div>
</template>

<style scoped>
.toggle-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.2);
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 16px;
}

.toggle-label {
  font-size: 13px;
  color: var(--text2);
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3);
  transition: .25s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 12px;
  width: 12px;
  left: 3px;
  top: 3px;
  background-color: var(--text2);
  transition: .25s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0,0,0,0.4);
}

input:checked + .toggle-slider {
  background-color: var(--accent-soft);
  border-color: var(--accent2);
}

input:checked + .toggle-slider:before {
  transform: translateX(16px);
  background-color: var(--accent);
  box-shadow: 0 0 8px rgba(82, 148, 226, 0.4);
}
</style>
