<script setup>
import { ref } from 'vue'
import Chat from './components/Chat.vue'
import Settings from './components/Settings.vue'
import Config from './components/Config.vue'
import { APP_NAME, APP_VERSION } from '../config/constants'

const currentView = ref('chat')
const chatRef = ref(null)

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
  <div class="header">
    <h1>
      <img src="/favicon.svg" alt="Logo" class="app-logo" />
      {{ APP_NAME }}
      <span class="app-version">v{{ APP_VERSION }}</span>
    </h1>
  </div>

  <div class="tab-nav">
    <div class="tab-group">
      <div 
        class="tab-item" 
        :class="{ active: currentView === 'chat' }" 
        @click="setView('chat')"
        title="Ask"
      >
        <span class="i i-message-square tab-icon"></span>
        <span>Ask</span>
      </div>

      <div 
        class="tab-item" 
        :class="{ active: currentView === 'settings' }" 
        @click="setView('settings')"
        title="Settings"
      >
        <span class="i i-sun tab-icon"></span>
        <span>Settings</span>
      </div>

      <div 
        class="tab-item" 
        :class="{ active: currentView === 'config' }" 
        @click="setView('config')"
        title="Config"
      >
        <span class="i i-cpu tab-icon"></span>
        <span>Config</span>
      </div>
    </div>
    
    <div class="nav-actions">
      <div 
        v-if="currentView === 'chat'"
        class="tab-item action-icon clear-btn" 
        @click="handleClearHistory"
        title="Clear History"
      >
        <span>Clear</span>
        <span class="i i-ban"></span>
      </div>
    </div>
  </div>

  <div class="view-container">
    <Chat v-show="currentView === 'chat'" ref="chatRef" />
    <Settings v-show="currentView === 'settings'" />
    <Config v-show="currentView === 'config'" />
  </div>
</template>

<style scoped>
.header {
  padding: 20px;
  padding-bottom: 0px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header h1 {
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 12px;
  letter-spacing: 0px;
  color: var(--text);
}

.header .app-version {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--text2);
}

.header .app-logo {
  width: 20px;
  height: 20px;
  display: block;
}

.tab-nav {
  display: flex;
  padding: 0 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  margin-top: 24px;
  align-items: flex-end;
  justify-content: space-between;
}

.tab-group {
  display: flex;
  gap: 24px;
}

.nav-actions {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}

.tab-item {
  padding: 0 0 12px 0;
  font-size: 12px;
  color: rgba(211, 218, 227, 0.62);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-item.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 500;
  position: relative;
  bottom: -1px;
}

.tab-item:hover:not(.active) {
  color: var(--text);
}

.tab-item.action-icon:hover {
  color: var(--error);
}

.clear-btn {
  gap: 6px;
}

.view-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-icon {
  font-size: 14px;
}
</style>
