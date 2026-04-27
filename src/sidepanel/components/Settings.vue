<script setup>
import { ref, onMounted } from 'vue'
import { storage } from '../../services/storage'
import { LLM_PROVIDERS, DEFAULT_OPENAI_CONFIG, STORAGE_STORES } from '../../config/constants'

const apiKey = ref('')
const baseUrl = ref('')
const model = ref('')
const saveStatus = ref('')

onMounted(async () => {
  const config = await storage.get(STORAGE_STORES.SETTINGS, LLM_PROVIDERS.OPENAI) || {}
  apiKey.value = config.apiKey || ''
  baseUrl.value = config.baseUrl || DEFAULT_OPENAI_CONFIG.baseUrl
  model.value = config.model || DEFAULT_OPENAI_CONFIG.model
})

const saveSettings = async () => {
  await storage.set(STORAGE_STORES.SETTINGS, LLM_PROVIDERS.OPENAI, {
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
  <div class="settings-view">
    <div class="settings-content">
      <div class="settings-intro">
        Configure your OpenAI integration. Your API key is stored locally in your browser.
      </div>

      <div class="settings-section">
        <div class="section-header">
          <span class="i i-cpu"></span>
          <span class="section-title">OPENAI CONFIGURATION</span>
        </div>

        <div class="provider-card">
          <div class="input-group">
            <label class="input-label">API KEY</label>
            <input 
              v-model="apiKey" 
              type="password" 
              class="provider-input" 
              placeholder="sk-..."
            />
          </div>

          <div class="input-group">
            <label class="input-label">BASE URL</label>
            <input 
              v-model="baseUrl" 
              type="text" 
              class="provider-input" 
              :placeholder="DEFAULT_OPENAI_CONFIG.baseUrl"
            />
          </div>

          <div class="input-group">
            <label class="input-label">MODEL</label>
            <input 
              v-model="model" 
              type="text" 
              class="provider-input" 
              :placeholder="DEFAULT_OPENAI_CONFIG.model"
            />
          </div>

          <div class="provider-actions">
            <button class="save-btn" @click="saveSettings">
              <span class="i i-save"></span>
              <span>Save Settings</span>
            </button>
            <span v-if="saveStatus" class="status-msg">{{ saveStatus }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="view-footer">
      <div class="capability-badge">
        <span class="i i-shield"></span>
        <span>INDEXED DB STORAGE</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.settings-content {
  padding: 18px 16px 20px;
  overflow-y: auto;
  flex: 1;
}

.settings-intro {
  color: var(--text2);
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 24px;
}

.settings-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--text2);
}

.section-title {
  font-size: 11px;
  letter-spacing: 1.5px;
  font-weight: 600;
}

.provider-card {
  background: linear-gradient(180deg, #262019 0%, #211b15 100%);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
}

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
  background: #151311;
  border: 1px solid #3a3126;
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

.provider-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
}

.save-btn {
  background: rgba(212, 162, 78, 0.18);
  border: 1px solid rgba(212, 162, 78, 0.42);
  color: var(--accent);
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.save-btn:hover {
  background: rgba(212, 162, 78, 0.25);
  border-color: var(--accent);
}

.status-msg {
  font-size: 12px;
  color: var(--success);
}

.view-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.capability-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text2);
  font-size: 10px;
  letter-spacing: 1px;
  font-weight: 500;
  text-transform: uppercase;
}
</style>
