/**
 * Service Worker - Main entry point for the extension logic.
 */
console.log('Service worker initialized');

// Listen for messages from the sidepanel or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in background:', message);

  if (message.type === 'PING') {
    sendResponse({ type: 'PONG', status: 'ready' });
  }

  // Future: Handle LLM tool calls and task execution here
  return true;
});

// Open sidepanel on icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});
