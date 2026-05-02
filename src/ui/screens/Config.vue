<script setup>
import { ref, onMounted } from 'vue';
import { configService } from '../../services/config';
import { DEFAULT_AGENT_LIMITS, DEFAULT_PAGE_EXTRACTION, DEFAULT_USER_SETTINGS, CONFIG_KEYS } from '../../config/constants';
import AppToggle from '../components/AppToggle.vue';

const limits = ref({});
const extraction = ref({});
const userSettings = ref({});

const limitsOpen = ref(true);
const extractionOpen = ref(true);
const userOpen = ref(true);

const saveLimitsStatus = ref('');
const saveExtractionStatus = ref('');
const saveUserStatus = ref('');

onMounted(async () => {
  await configService.init();
  limits.value = { ...configService.get(CONFIG_KEYS.AGENT_LIMITS) };
  extraction.value = { ...configService.get(CONFIG_KEYS.PAGE_EXTRACTION) };
  userSettings.value = { ...configService.get(CONFIG_KEYS.USER_SETTINGS) };
});

const validateInput = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num) || num <= 0) return false;
  return true;
};

const saveLimits = async () => {
  for (const key in limits.value) {
    if (!validateInput(limits.value[key])) {
      saveLimitsStatus.value = `Invalid input for ${key}`;
      return;
    }
    limits.value[key] = parseInt(limits.value[key], 10);
  }
  await configService.save(CONFIG_KEYS.AGENT_LIMITS, limits.value);
  saveLimitsStatus.value = 'Saved successfully!';
  setTimeout(() => saveLimitsStatus.value = '', 2000);
};

const restoreLimits = async () => {
  limits.value = { ...DEFAULT_AGENT_LIMITS };
  await saveLimits();
};

const saveExtraction = async () => {
  for (const key in extraction.value) {
    if (!validateInput(extraction.value[key])) {
      saveExtractionStatus.value = `Invalid input for ${key}`;
      return;
    }
    extraction.value[key] = parseInt(extraction.value[key], 10);
  }
  await configService.save(CONFIG_KEYS.PAGE_EXTRACTION, extraction.value);
  saveExtractionStatus.value = 'Saved successfully!';
  setTimeout(() => saveExtractionStatus.value = '', 2000);
};

const restoreExtraction = async () => {
  extraction.value = { ...DEFAULT_PAGE_EXTRACTION };
  await saveExtraction();
};

const saveUser = async () => {
  await configService.save(CONFIG_KEYS.USER_SETTINGS, userSettings.value);
  saveUserStatus.value = 'Saved successfully!';
  setTimeout(() => saveUserStatus.value = '', 2000);
};

const restoreUser = async () => {
  userSettings.value = { ...DEFAULT_USER_SETTINGS };
  await saveUser();
};
</script>

<template>
  <div class="config-view">
    <div class="settings-content">
      <div class="settings-intro">
        Manage advanced Agent logic constraints and page extraction thresholds.
      </div>

      <!-- User Settings Section -->
      <div class="settings-section">
        <div class="section-header collapsible" @click="userOpen = !userOpen">
          <span class="i i-user"></span>
          <span class="section-title">USER SETTINGS</span>
          <span class="i i-chevron-right chevron" :class="{ open: userOpen }"></span>
        </div>

        <div v-show="userOpen" class="provider-card">
          <div class="input-group">
            <label class="input-label">Custom Instructions</label>
            <textarea 
              v-model="userSettings.customInstructions" 
              class="provider-input provider-textarea" 
              placeholder="E.g. Always explain code concisely, or prefer using the scroll tool before clicking..."
              rows="4"
            ></textarea>
          </div>

          <AppToggle 
            v-model="userSettings.highlightActions" 
            label="Highlight actions on page (1s delay)" 
          />

          <div class="provider-actions">
            <button class="save-btn" @click="saveUser">
              <span class="i i-save"></span>
              <span>Save</span>
            </button>
            <button class="default-btn" @click="restoreUser">
              Restore Defaults
            </button>
            <span v-if="saveUserStatus" class="status-msg" :class="{ success: saveUserStatus.includes('Saved'), error: !saveUserStatus.includes('Saved') }">{{ saveUserStatus }}</span>
          </div>
        </div>
      </div>


      <!-- Agent Loop Limits Section -->
      <div class="settings-section">
        <div class="section-header collapsible" @click="limitsOpen = !limitsOpen">
          <span class="i i-list-checks"></span>
          <span class="section-title">AGENT LOOP LIMITS</span>
          <span class="i i-chevron-right chevron" :class="{ open: limitsOpen }"></span>
        </div>

        <div v-show="limitsOpen" class="provider-card">
          <div class="input-group" v-for="(val, key) in limits" :key="key">
            <label class="input-label">{{ key.replace(/_/g, ' ') }}</label>
            <input 
              v-model.number="limits[key]" 
              type="number" 
              min="1"
              class="provider-input" 
            />
          </div>

          <div class="provider-actions">
            <button class="save-btn" @click="saveLimits">
              <span class="i i-save"></span>
              <span>Save</span>
            </button>
            <button class="default-btn" @click="restoreLimits">
              Restore Defaults
            </button>
            <span v-if="saveLimitsStatus" class="status-msg" :class="{ success: saveLimitsStatus.includes('Saved'), error: !saveLimitsStatus.includes('Saved') }">{{ saveLimitsStatus }}</span>
          </div>
        </div>
      </div>

      <!-- Page Extraction Section -->
      <div class="settings-section">
        <div class="section-header collapsible" @click="extractionOpen = !extractionOpen">
          <span class="i i-bookmark"></span>
          <span class="section-title">PAGE EXTRACTION</span>
          <span class="i i-chevron-right chevron" :class="{ open: extractionOpen }"></span>
        </div>

        <div v-show="extractionOpen" class="provider-card">
          <div class="input-group" v-for="(val, key) in extraction" :key="key">
            <label class="input-label">{{ key.replace(/_/g, ' ') }}</label>
            <input 
              v-model.number="extraction[key]" 
              type="number" 
              min="1"
              class="provider-input" 
            />
          </div>

          <div class="provider-actions">
            <button class="save-btn" @click="saveExtraction">
              <span class="i i-save"></span>
              <span>Save</span>
            </button>
            <button class="default-btn" @click="restoreExtraction">
              Restore Defaults
            </button>
            <span v-if="saveExtractionStatus" class="status-msg" :class="{ success: saveExtractionStatus.includes('Saved'), error: !saveExtractionStatus.includes('Saved') }">{{ saveExtractionStatus }}</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.config-view {
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
.section-header.collapsible {
  cursor: pointer;
  user-select: none;
}
.section-header.collapsible:hover {
  color: var(--text);
}
.section-title {
  font-size: 11px;
  letter-spacing: 1.5px;
  font-weight: 600;
  flex: 1;
}
.chevron {
  transition: transform 0.2s;
}
.chevron.open {
  transform: rotate(90deg);
}
.provider-card {
  background: #21252b;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 16px;
  animation: reveal-soft 0.2s ease-out;
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
.provider-textarea {
  min-height: 100px;
  resize: vertical;
  line-height: 1.6;
}

.provider-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
}
.save-btn {
  background: rgba(82, 148, 226, 0.18);
  border: 1px solid rgba(82, 148, 226, 0.42);
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
  background: rgba(82, 148, 226, 0.25);
  border-color: var(--accent);
}
.default-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text2);
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.default-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
}
.status-msg {
  font-size: 12px;
}
.status-msg.success {
  color: var(--success);
}
.status-msg.error {
  color: var(--error);
}
@keyframes reveal-soft {
  0% { opacity: 0; transform: translateY(-4px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
