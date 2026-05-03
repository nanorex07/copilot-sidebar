<script setup>
import { ref, onMounted } from 'vue';
import { configService } from '../../services/config';
import { DEFAULT_AGENT_LIMITS, DEFAULT_PAGE_EXTRACTION, DEFAULT_USER_SETTINGS, CONFIG_KEYS } from '../../config/constants';
import AppToggle from '../components/AppToggle.vue';
import NumberInput from '../components/NumberInput.vue';

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
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="flex-1 overflow-y-auto px-4 pt-4 pb-5 sm:px-5">
      <div class="mb-6 text-[13px] leading-relaxed text-skin-muted">
        Manage advanced Agent logic constraints and page extraction thresholds.
      </div>

      <div class="settings-section mb-6">
        <div class="mb-3 flex cursor-pointer select-none items-center gap-2 text-skin-muted transition hover:text-skin-text" @click="userOpen = !userOpen">
          <span class="i i-user"></span>
          <span class="section-title flex-1 text-[11px] font-semibold tracking-[1.5px]">USER SETTINGS</span>
          <span class="i i-chevron-right transition" :class="userOpen ? 'rotate-90' : ''"></span>
        </div>

        <div v-show="userOpen" class="animate-reveal-soft rounded-[10px] border border-white/5 bg-[#21252b] p-4">
          <div class="mb-4">
            <label class="mb-2 block text-[10px] uppercase tracking-[1px] text-skin-muted">Custom Instructions</label>
            <textarea
              v-model="userSettings.customInstructions"
              class="min-h-[100px] w-full resize-y rounded-lg border border-white/10 bg-[#1b1e23] px-3 py-2.5 text-[13px] leading-relaxed text-skin-text outline-none transition focus:border-skin-accent"
              placeholder="E.g. Always explain code concisely..."
              rows="4"
            ></textarea>
          </div>

          <AppToggle v-model="userSettings.highlightActions" label="Highlight actions on page (1s delay)" />

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <button class="inline-flex items-center gap-2 rounded-md border border-skin-accent/40 bg-skin-accent/18 px-3.5 py-2 text-xs text-skin-accent transition hover:border-skin-accent hover:bg-skin-accent/25" @click="saveUser">
              <span class="i i-save"></span>
              <span>Save</span>
            </button>
            <button class="rounded-md border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-skin-muted transition hover:bg-white/10 hover:text-skin-text" @click="restoreUser">
              Restore Defaults
            </button>
            <span v-if="saveUserStatus" class="status-msg text-xs" :class="saveUserStatus.includes('Saved') ? 'text-skin-success' : 'text-skin-error'">{{ saveUserStatus }}</span>
          </div>
        </div>
      </div>

      <div class="settings-section mb-6">
        <div class="mb-3 flex cursor-pointer select-none items-center gap-2 text-skin-muted transition hover:text-skin-text" @click="limitsOpen = !limitsOpen">
          <span class="i i-list-checks"></span>
          <span class="section-title flex-1 text-[11px] font-semibold tracking-[1.5px]">AGENT LOOP LIMITS</span>
          <span class="i i-chevron-right transition" :class="limitsOpen ? 'rotate-90' : ''"></span>
        </div>

        <div v-show="limitsOpen" class="animate-reveal-soft rounded-[10px] border border-white/5 bg-[#21252b] p-4">
          <NumberInput
            v-for="(val, key) in limits"
            :key="key"
            :label="key.replace(/_/g, ' ')"
            v-model="limits[key]"
            :min="1"
          />

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <button class="inline-flex items-center gap-2 rounded-md border border-skin-accent/40 bg-skin-accent/18 px-3.5 py-2 text-xs text-skin-accent transition hover:border-skin-accent hover:bg-skin-accent/25" @click="saveLimits">
              <span class="i i-save"></span>
              <span>Save</span>
            </button>
            <button class="rounded-md border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-skin-muted transition hover:bg-white/10 hover:text-skin-text" @click="restoreLimits">
              Restore Defaults
            </button>
            <span v-if="saveLimitsStatus" class="status-msg text-xs" :class="saveLimitsStatus.includes('Saved') ? 'text-skin-success' : 'text-skin-error'">{{ saveLimitsStatus }}</span>
          </div>
        </div>
      </div>

      <div class="settings-section mb-6">
        <div class="mb-3 flex cursor-pointer select-none items-center gap-2 text-skin-muted transition hover:text-skin-text" @click="extractionOpen = !extractionOpen">
          <span class="i i-bookmark"></span>
          <span class="section-title flex-1 text-[11px] font-semibold tracking-[1.5px]">PAGE EXTRACTION</span>
          <span class="i i-chevron-right transition" :class="extractionOpen ? 'rotate-90' : ''"></span>
        </div>

        <div v-show="extractionOpen" class="animate-reveal-soft rounded-[10px] border border-white/5 bg-[#21252b] p-4">
          <NumberInput
            v-for="(val, key) in extraction"
            :key="key"
            :label="key.replace(/_/g, ' ')"
            v-model="extraction[key]"
            :min="1"
          />

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <button class="inline-flex items-center gap-2 rounded-md border border-skin-accent/40 bg-skin-accent/18 px-3.5 py-2 text-xs text-skin-accent transition hover:border-skin-accent hover:bg-skin-accent/25" @click="saveExtraction">
              <span class="i i-save"></span>
              <span>Save</span>
            </button>
            <button class="rounded-md border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-skin-muted transition hover:bg-white/10 hover:text-skin-text" @click="restoreExtraction">
              Restore Defaults
            </button>
            <span v-if="saveExtractionStatus" class="status-msg text-xs" :class="saveExtractionStatus.includes('Saved') ? 'text-skin-success' : 'text-skin-error'">{{ saveExtractionStatus }}</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
