/**
 * Background Service Worker
 *
 * Orchestrates:
 * - Extension lifecycle & keep-alive
 * - Diagnostic telemetry
 * - Side panel bootstrapping
 * - Active tab context management
 */

console.log('Background service worker initialized');

const KEEP_ALIVE_ALARM = 'keep-alive';
const MAX_TELEMETRY_ITEMS = 50;
let keepAliveInterval = null;


/**
 * Persists diagnostic logs to local storage for reliability tracking.
 */
function appendTelemetry(source, context, message) {
  if (!chrome?.storage?.local) return;

  chrome.storage.local.get('diagnosticTelemetry')
    .then(({ diagnosticTelemetry = [] }) => {
      diagnosticTelemetry.unshift({
        source,
        context,
        message,
        timestamp: Date.now(),
      });

      // Cap telemetry history
      if (diagnosticTelemetry.length > MAX_TELEMETRY_ITEMS) {
        diagnosticTelemetry.length = MAX_TELEMETRY_ITEMS;
      }

      return chrome.storage.local.set({ diagnosticTelemetry });
    })
    .catch((err) => {
      console.warn('[BG] telemetry.append failed:', err?.message || err);
    });
}

/**
 * Safely extracts context from a tab object.
 */
function buildActiveTabContext(tab) {
  if (!tab || !tab.url) return null;

  try {
    const parsed = new URL(tab.url);
    return {
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
      hostname: parsed.hostname,
      protocol: parsed.protocol,
      pathname: parsed.pathname
    };
  } catch (e) {
    return {
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
      hostname: '',
      protocol: '',
      pathname: ''
    };
  }
}

// ── MESSAGE HANDLERS ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG', status: 'ready', timestamp: Date.now() });
  }

  // Helper for components to get sanitized tab data
  if (message.type === 'GET_ACTIVE_TAB_CONTEXT') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const context = tabs[0] ? buildActiveTabContext(tabs[0]) : null;
      sendResponse(context);
    });
    return true; // Keep channel open for async tabs query
  }

  // Log incoming messages for debugging reliability issues
  if (message.type === 'LOG_TELEMETRY') {
    appendTelemetry(message.source || 'UI', message.context || 'General', message.content);
    sendResponse({ ok: true });
  }
});

/**
 * Open sidepanel on icon click (standard V3 pattern)
 */
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id }).catch(err => {
    appendTelemetry('BG', 'sidePanel.open', err.message);
  });
});

/**
 * Prevents the service worker from being terminated during active sessions.
 * Uses a dual-layered approach: setInterval for precision and chrome.alarms for persistence.
 */
function startKeepAlive() {
  if (keepAliveInterval) return;

  // Layer 1: Heartbeat interval
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => { });
  }, 20000);

  // Layer 2: Persistent alarm (backup if interval is throttled)
  chrome.alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: 0.5 });

  appendTelemetry('BG', 'KeepAlive', 'System started');
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  chrome.alarms.clear(KEEP_ALIVE_ALARM);
  appendTelemetry('BG', 'KeepAlive', 'System stopped');
}

// Handle keep-alive alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    // Wake up the worker
    chrome.runtime.getPlatformInfo(() => { });
  }
});

// Start keep-alive when a sidepanel connects (via messaging) or a task starts
// In this architecture, we can trigger this based on UI activity
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidebar') {
    startKeepAlive();
  }
});
