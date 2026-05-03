<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Chat from './screens/Chat.vue'
import Settings from './screens/Settings.vue'
import Config from './screens/Config.vue'
import { APP_NAME, APP_VERSION } from '../config/constants'

const currentView = ref('chat')
const chatRef = ref(null)
let backgroundPort = null

onMounted(() => {
  try {
    backgroundPort = chrome.runtime.connect({ name: 'sidebar' })
    backgroundPort.onDisconnect.addListener(() => {
      console.log('[sidebar] Disconnected from background')
    })
  } catch (err) {
    console.warn('[sidebar] Failed to connect to background:', err)
  }
})

onUnmounted(() => {
  if (backgroundPort) {
    backgroundPort.disconnect()
  }
})

const setView = (view) => {
  currentView.value = view
}

const handleClearHistory = () => {
  if (chatRef.value && typeof chatRef.value.clearHistory === 'function') {
    chatRef.value.clearHistory()
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex items-center px-4 pt-4 pb-0 sm:px-5 sm:pt-5">
      <h1 class="flex items-center gap-3 text-[15px] font-medium text-skin-text">
        <img src="/icons/icon128.png" alt="Logo" class="size-5" />
        {{ APP_NAME }}
        <span class="text-[11px] font-medium tracking-[0.04em] text-skin-muted">v{{ APP_VERSION }}</span>
      </h1>
    </div>

    <div class="mt-5 flex items-end justify-between border-b border-skin-border px-6 sm:px-5">
      <div class="flex gap-4 sm:gap-6">
        <button
          class="tab-item inline-flex items-center gap-2 border-b-2 border-transparent pb-3 text-xs font-normal text-skin-text/60 transition hover:text-skin-text"
          :class="currentView === 'chat' ? 'active relative !border-skin-accent !font-medium !text-skin-accent' : ''"
          @click="setView('chat')"
          title="Ask"
        >
          <span class="i i-message-square text-sm"></span>
          <span>Ask</span>
        </button>

        <button
          class="tab-item inline-flex items-center gap-2 border-b-2 border-transparent pb-3 text-xs font-normal text-skin-text/60 transition hover:text-skin-text"
          :class="currentView === 'settings' ? 'active relative !border-skin-accent !font-medium !text-skin-accent' : ''"
          @click="setView('settings')"
          title="Settings"
        >
          <span class="i i-sun text-sm"></span>
          <span>Settings</span>
        </button>

        <button
          class="tab-item inline-flex items-center gap-2 border-b-2 border-transparent pb-3 text-xs font-normal text-skin-text/60 transition hover:text-skin-text"
          :class="currentView === 'config' ? 'active relative !border-skin-accent !font-medium !text-skin-accent' : ''"
          @click="setView('config')"
          title="Config"
        >
          <span class="i i-cpu text-sm"></span>
          <span>Config</span>
        </button>
      </div>

      <button
        v-if="currentView === 'chat'"
        class="inline-flex items-center gap-1.5 border-b-2 border-transparent pb-3 text-xs text-skin-text/60 transition hover:text-skin-error"
        @click="handleClearHistory"
        title="Clear History"
      >
        <span>Clear</span>
        <span class="i i-ban"></span>
      </button>
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Chat v-show="currentView === 'chat'" ref="chatRef" />
      <Settings v-show="currentView === 'settings'" />
      <Config v-show="currentView === 'config'" />
    </div>
  </div>
</template>
