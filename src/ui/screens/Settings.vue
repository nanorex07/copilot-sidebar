<script setup>
import { ref, onMounted } from 'vue'
import { settingsStore } from '../../services/storage'
import { LLM_PROVIDERS, DEFAULT_OPENAI_CONFIG } from '../../config/constants'

const apiKey = ref('')
const baseUrl = ref('')
const model = ref('')
const saveStatus = ref('')

onMounted(async () => {
  const config = await settingsStore.getConfig(LLM_PROVIDERS.OPENAI) || {}
  apiKey.value = config.apiKey || ''
  baseUrl.value = config.baseUrl || DEFAULT_OPENAI_CONFIG.baseUrl
  model.value = config.model || DEFAULT_OPENAI_CONFIG.model
})

const saveSettings = async () => {
  await settingsStore.saveConfig(LLM_PROVIDERS.OPENAI, {
    apiKey: apiKey.value,
    baseUrl: baseUrl.value,
    model: model.value
  })
  saveStatus.value = 'Settings saved!'
  setTimeout(() => {
    saveStatus.value = ''
  }, 2000)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="flex-1 overflow-y-auto px-4 pt-4 pb-5 sm:px-5">
      <div class="mb-6 text-[13px] leading-relaxed text-skin-muted">
        Configure OpenAI integration. API key stored locally in browser.
      </div>

      <div class="settings-section mb-6">
        <div class="mb-3 flex items-center gap-2 text-skin-muted">
          <span class="i i-cpu"></span>
          <span class="section-title text-[11px] font-semibold tracking-[1.5px]">OPENAI CONFIGURATION</span>
        </div>

        <div class="rounded-[10px] border border-white/5 bg-[#21252b] p-4">
          <div class="mb-4">
            <label class="mb-2 block text-[10px] uppercase tracking-[1px] text-skin-muted">API KEY</label>
            <input v-model="apiKey" type="password" class="w-full rounded-lg border border-white/10 bg-[#1b1e23] px-3 py-2.5 text-[13px] text-skin-text outline-none transition focus:border-skin-accent" placeholder="sk-..." />
          </div>

          <div class="mb-4">
            <label class="mb-2 block text-[10px] uppercase tracking-[1px] text-skin-muted">BASE URL</label>
            <input v-model="baseUrl" type="text" class="w-full rounded-lg border border-white/10 bg-[#1b1e23] px-3 py-2.5 text-[13px] text-skin-text outline-none transition focus:border-skin-accent" :placeholder="DEFAULT_OPENAI_CONFIG.baseUrl" />
          </div>

          <div class="mb-4">
            <label class="mb-2 block text-[10px] uppercase tracking-[1px] text-skin-muted">MODEL</label>
            <input v-model="model" type="text" class="w-full rounded-lg border border-white/10 bg-[#1b1e23] px-3 py-2.5 text-[13px] text-skin-text outline-none transition focus:border-skin-accent" :placeholder="DEFAULT_OPENAI_CONFIG.model" />
          </div>

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <button class="inline-flex items-center gap-2 rounded-md border border-skin-accent/40 bg-skin-accent/18 px-3.5 py-2 text-xs text-skin-accent transition hover:border-skin-accent hover:bg-skin-accent/25" @click="saveSettings">
              <span class="i i-save"></span>
              <span>Save Settings</span>
            </button>
            <span v-if="saveStatus" class="status-msg text-xs text-skin-success">{{ saveStatus }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
