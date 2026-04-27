/**
 * Content Script - Injected into web pages to provide context and perform actions.
 */
console.log('Copilot Sidebar content script initialized');

/**
 * Extracts basic information about the current page.
 */
function getPageContext() {
  return {
    url: window.location.href,
    title: document.title,
    // Extract a clean version of the page text
    text: document.body.innerText.substring(0, 10000).replace(/\s+/g, ' ').trim(),
    // Simple meta information
    meta: {
      description: document.querySelector('meta[name="description"]')?.content || '',
      keywords: document.querySelector('meta[name="keywords"]')?.content || ''
    }
  };
}

/**
 * Message listener for background or sidepanel requests.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in content script:', message);

  if (message.type === 'GET_PAGE_CONTEXT') {
    try {
      const context = getPageContext();
      sendResponse({ success: true, data: context });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  return true; // Keep the message channel open for async response
});
