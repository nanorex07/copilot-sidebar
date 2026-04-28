/**
 * Content Script — Copilot Sidebar
 *
 * Injected into every page. Handles:
 *   1. Accessibility tree extraction (page understanding)
 *   2. DOM actions (click, type, scroll, hover, select, press_key)
 *   3. Natural language element search with relevance scoring
 *   4. Plain text search (Ctrl+F style)
 *   5. Page text extraction (full/viewport/selector)
 *
 * Communicates with service worker via chrome.runtime.onMessage.
 */

(() => {
  'use strict';

  // ===== ERROR HELPERS =====

  const ACTION_ERROR = {
    ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
    INVALID_ACTION: 'INVALID_ACTION',
    INVALID_TARGET: 'INVALID_TARGET',
  };

  function makeError(code, message, details = {}) {
    return {
      success: false,
      code: String(code || ACTION_ERROR.INVALID_ACTION),
      reason: String(message || 'Unknown error'),
      ...details,
    };
  }

  // ===== VISIBILITY & ROLE HELPERS =====

  function isElementVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === 'BODY' || el.tagName === 'HTML') return true;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (Number.parseFloat(cs.opacity || '1') === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return true;
  }

  function getElementRole(el) {
    const ariaRole = el.getAttribute('role');
    if (ariaRole) return ariaRole;
    const tag = el.tagName.toLowerCase();
    const roleMap = {
      a: 'link', button: 'button', input: 'textbox',
      select: 'combobox', textarea: 'textbox', img: 'image',
      h1: 'heading', h2: 'heading', h3: 'heading',
      h4: 'heading', h5: 'heading', h6: 'heading',
      nav: 'navigation', main: 'main', form: 'form',
      table: 'table', ul: 'list', ol: 'list', li: 'listitem',
    };
    if (tag === 'input') {
      const type = (el.type || 'text').toLowerCase();
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'submit' || type === 'button') return 'button';
      if (type === 'search') return 'searchbox';
      return 'textbox';
    }
    return roleMap[tag] || null;
  }

  function isInteractive(el) {
    const tag = el.tagName.toLowerCase();
    if (['a', 'button', 'input', 'select', 'textarea', 'summary'].includes(tag)) return true;
    if (el.getAttribute('role') === 'button' || el.getAttribute('role') === 'link') return true;
    if (el.onclick || el.getAttribute('onclick')) return true;
    if (el.tabIndex >= 0) return true;
    try { if (getComputedStyle(el).cursor === 'pointer') return true; } catch { }
    return false;
  }

  function getAccessibleName(el) {
    const label = el.getAttribute('aria-label')
      || el.getAttribute('alt')
      || el.getAttribute('title')
      || el.getAttribute('placeholder');
    if (label) return label;
    const raw = el.textContent;
    if (!raw) return '';
    return raw.slice(0, 120).replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  function getState(el) {
    const state = {};
    if (el.disabled) state.disabled = true;
    if (el.checked) state.checked = true;
    if (el.selected) state.selected = true;
    if (el.getAttribute('aria-expanded') === 'true') state.expanded = true;
    if (el.required) state.required = true;
    if (el.readOnly) state.readonly = true;
    const rawValue = 'value' in el ? el.value : undefined;
    if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
      state.value = String(rawValue).slice(0, 100);
    }
    return Object.keys(state).length > 0 ? state : null;
  }

  // ===== AGENT ELEMENT INDEX =====

  let agentIdSeed = 0;
  const agentElementIndex = new Map();

  function clearAgentElementIndex() {
    agentElementIndex.clear();
  }

  function ensureAgentId(el) {
    const existing = el.getAttribute('data-agent-id');
    if (existing && /^\d+$/.test(existing)) {
      const id = Number(existing);
      if (id > agentIdSeed) agentIdSeed = id;
      agentElementIndex.set(id, el);
      return id;
    }
    agentIdSeed += 1;
    el.setAttribute('data-agent-id', String(agentIdSeed));
    agentElementIndex.set(agentIdSeed, el);
    return agentIdSeed;
  }

  function findElementById(agentId) {
    const id = Number(agentId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const indexed = agentElementIndex.get(id);
    if (indexed && indexed.isConnected) return indexed;
    agentElementIndex.delete(id);
    const found = document.querySelector(`[data-agent-id="${id}"]`);
    if (found) {
      agentElementIndex.set(id, found);
      return found;
    }
    return null;
  }

  // ===== ACCESSIBILITY TREE EXTRACTION =====

  function extractAccessibilityTree(options = {}) {
    const maxDepth = options.maxDepth || 15;
    const maxNodes = options.maxNodes || 500;
    const viewportOnly = options.viewportOnly === true;
    let nodeCount = 0;
    const startSeed = agentIdSeed;
    let interactiveId = agentIdSeed;
    clearAgentElementIndex();
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;

    function inViewport(rect) {
      if (!viewportOnly) return true;
      if (!rect || rect.w <= 0 || rect.h <= 0) return false;
      if (rect.x + rect.w < 0 || rect.y + rect.h < 0) return false;
      if (rect.x > viewportW || rect.y > viewportH) return false;
      return true;
    }

    function traverse(el, depth = 0) {
      if (nodeCount >= maxNodes || depth > maxDepth) return null;
      if (!el || el.nodeType !== 1) return null;
      if (!isElementVisible(el)) return null;

      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'meta', 'link'].includes(tag)) return null;

      const rect = el.getBoundingClientRect();
      const globalRect = {
        x: Math.round(rect.x), y: Math.round(rect.y),
        w: Math.round(rect.width), h: Math.round(rect.height),
      };
      if (!inViewport(globalRect)) return null;

      const role = getElementRole(el);
      const isInt = isInteractive(el);
      const name = getAccessibleName(el);

      const children = [];
      for (const child of el.children) {
        const node = traverse(child, depth + 1);
        if (node) children.push(node);
      }

      // Flatten non-semantic wrappers
      if (!role && !isInt && !name && children.length === 1) return children[0];
      if (!role && !isInt && !name && children.length === 0) return null;

      nodeCount++;
      const node = {};

      if (isInt) {
        interactiveId++;
        node.id = interactiveId;
        node.rect = globalRect;
        el.setAttribute('data-agent-id', String(interactiveId));
        agentElementIndex.set(interactiveId, el);
      }

      if (role) node.role = role;
      if (name) node.name = name;
      if (tag) node.tag = tag;

      const state = getState(el);
      if (state) node.state = state;
      if (children.length > 0) node.children = children;

      return node;
    }

    const tree = traverse(document.body, 0);
    agentIdSeed = interactiveId;

    const docEl = document.documentElement;
    return {
      url: window.location.href,
      title: document.title,
      tree,
      interactiveCount: interactiveId - startSeed,
      nodeCount,
      scroll: {
        x: Math.round(window.scrollX),
        y: Math.round(window.scrollY),
        maxY: Math.round(docEl.scrollHeight - docEl.clientHeight),
      },
      viewport: { w: docEl.clientWidth, h: docEl.clientHeight },
    };
  }

  // ===== PAGE TEXT EXTRACTION =====

  function getPageText(payload = {}) {
    const scope = String(payload.scope || 'full').toLowerCase();
    const selector = String(payload.selector || '').trim();
    const maxChars = Math.min(Math.max(Number(payload.maxChars) || 8000, 200), 50000);
    const blockedTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'FOOTER', 'HEADER', 'ASIDE']);

    let roots = [];
    if (scope === 'selector' && selector) {
      try { roots = Array.from(document.querySelectorAll(selector)); } catch { roots = []; }
    } else {
      // Try semantic roots first
      const preferred = document.querySelectorAll('main, [role="main"], article, .content');
      roots = preferred.length > 0 ? Array.from(preferred) : [document.body];
    }

    const viewportOnly = scope === 'viewport';
    let collected = '';
    let truncated = false;

    for (const root of roots) {
      if (!root || !isElementVisible(root)) continue;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (!isElementVisible(parent)) return NodeFilter.FILTER_REJECT;
          if (blockedTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (viewportOnly) {
            const r = parent.getBoundingClientRect();
            if (r.bottom < 0 || r.top > window.innerHeight) return NodeFilter.FILTER_REJECT;
          }
          if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
          // Walk up to check for boilerplate
          let curr = parent;
          while (curr && curr !== document.body) {
            if (blockedTags.has(curr.tagName)) return NodeFilter.FILTER_REJECT;
            const role = (curr.getAttribute('role') || '').toLowerCase();
            if (['banner', 'navigation', 'contentinfo'].includes(role)) return NodeFilter.FILTER_REJECT;
            curr = curr.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      while (walker.nextNode()) {
        const value = walker.currentNode.nodeValue?.trim();
        if (!value) continue;
        const next = collected ? `${collected}\n${value}` : value;
        if (next.length > maxChars) {
          collected = next.slice(0, maxChars);
          truncated = true;
          break;
        }
        collected = next;
      }
      if (truncated) break;
    }

    // Fallback: raw text if structured extraction returned nothing
    if (!collected && scope !== 'selector') {
      const body = document.body;
      if (body) {
        const raw = body.innerText || '';
        collected = raw.slice(0, maxChars).replace(/\s+/g, ' ').trim();
        truncated = raw.length > maxChars;
      }
    }

    return {
      url: window.location.href,
      title: document.title,
      text: collected.replace(/\n{3,}/g, '\n\n').trim(),
      charCount: collected.length,
      scope,
      truncated,
    };
  }

  // ===== FIND ELEMENT BY DESCRIPTION =====

  function findByDescription(payload = {}) {
    const query = String(payload.query || '').toLowerCase().trim();
    if (!query) return [];
    const queryWords = query.split(/\s+/).filter(Boolean);
    const maxResults = payload.maxResults || 10;
    const candidates = [];

    const selector = 'a, button, input, select, textarea, [role="button"], [role="link"], [onclick], [tabindex]';
    document.querySelectorAll(selector).forEach((el) => {
      if (!isElementVisible(el)) return;
      const text = (
        (el.innerText || '') +
        ' ' + (el.getAttribute('aria-label') || '') +
        ' ' + (el.getAttribute('placeholder') || '') +
        ' ' + (el.getAttribute('title') || '') +
        ' ' + (el.getAttribute('alt') || '') +
        ' ' + (el.getAttribute('name') || '') +
        ' ' + (el.getAttribute('id') || '') +
        ' ' + (typeof el.className === 'string' ? el.className : '')
      ).toLowerCase();

      let score = 0;
      if (text.includes(query)) score += 10;
      const matchedWords = queryWords.filter((w) => text.includes(w));
      if (matchedWords.length === 0) return;
      score += (matchedWords.length / queryWords.length) * 5;
      score += Math.max(0, 3 - text.length / 100);

      const rect = el.getBoundingClientRect();
      const agentId = ensureAgentId(el);
      const inputType = el.tagName.toLowerCase() === 'input'
        ? String(el.type || '').toLowerCase()
        : '';

      candidates.push({
        agentId,
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || '').trim().slice(0, 60),
        role: getElementRole(el),
        inputType,
        score: Math.round(score * 100) / 100,
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, maxResults);
  }

  // ===== FIND TEXT ON PAGE =====

  function findTextOnPage(payload = {}) {
    const query = String(payload.query || '').trim();
    if (!query) return makeError(ACTION_ERROR.INVALID_ACTION, 'find_text requires a query');

    const maxResults = Math.min(Math.max(Number(payload.maxResults) || 20, 1), 200);
    const body = document.body;
    if (!body) return { success: true, query, count: 0, matches: [] };

    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        if (!isElementVisible(parent)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const needle = query.toLowerCase();
    const matches = [];
    let totalCount = 0;

    while (walker.nextNode()) {
      const raw = walker.currentNode.nodeValue || '';
      const haystack = raw.toLowerCase();
      let pos = 0;
      while (pos <= haystack.length - needle.length) {
        const idx = haystack.indexOf(needle, pos);
        if (idx === -1) break;
        totalCount++;
        if (matches.length < maxResults) {
          const start = Math.max(0, idx - 80);
          const end = Math.min(raw.length, idx + query.length + 80);
          matches.push({
            index: totalCount,
            context: raw.slice(start, end).replace(/\s+/g, ' ').trim(),
          });
        }
        pos = idx + Math.max(1, needle.length);
      }
    }

    // Scroll to first match
    if (payload.scrollToFirst !== false && totalCount > 0) {
      try {
        const found = window.find(query, false, false, true);
        if (!found) window.getSelection()?.removeAllRanges();
      } catch { }
    }

    return {
      success: true,
      query,
      count: totalCount,
      returned: matches.length,
      matches,
    };
  }

  // ===== DOM ACTIONS =====

  function setTextLikeValue(el, value) {
    if (el instanceof HTMLInputElement) {
      const inputType = String(el.type || 'text').toLowerCase();
      const textTypes = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);
      if (!textTypes.has(inputType)) return false;
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeSetter) nativeSetter.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el instanceof HTMLTextAreaElement) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (nativeSetter) nativeSetter.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el.isContentEditable) {
      el.textContent = value;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      return true;
    }
    return false;
  }

  function fireMouse(el, type, overrides = {}) {
    const rect = el.getBoundingClientRect();
    const event = new MouseEvent(type, {
      bubbles: true, cancelable: true,
      view: window,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
      ...overrides,
    });
    el.dispatchEvent(event);
  }

  function executeAction(action) {
    if (!action || typeof action !== 'object') {
      return makeError(ACTION_ERROR.INVALID_ACTION, 'Action payload must be an object');
    }
    const { type, target, params = {} } = action;

    switch (type) {
      case 'click': {
        const el = findElementById(target);
        if (!el) return makeError(ACTION_ERROR.ELEMENT_NOT_FOUND, `Element [${target}] not found`);
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        fireMouse(el, 'mousedown', { detail: 1, button: 0, buttons: 1 });
        fireMouse(el, 'mouseup', { detail: 1, button: 0, buttons: 0 });
        fireMouse(el, 'click', { detail: 1, button: 0, buttons: 0 });
        el.click();
        return { success: true, description: `Clicked [${target}]` };
      }

      case 'type': {
        const el = findElementById(target);
        if (!el) return makeError(ACTION_ERROR.ELEMENT_NOT_FOUND, `Element [${target}] not found`);
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        el.focus();
        const text = String(params.text ?? '');
        if (!setTextLikeValue(el, text)) {
          return makeError(ACTION_ERROR.INVALID_TARGET, `Element [${target}] is not a text input`);
        }
        if (params.enter) {
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
          el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
          const form = el.closest('form');
          if (form) {
            const submitBtn = form.querySelector('[type="submit"], button:not([type="button"])');
            if (submitBtn) submitBtn.click();
            else try { form.submit(); } catch { }
          }
        }
        return { success: true, description: `Typed "${text}" into [${target}]${params.enter ? ' and pressed Enter' : ''}` };
      }

      case 'scroll': {
        const amount = params.amount || 500;
        const dir = target === 'up' ? -amount : amount;
        window.scrollBy({ top: dir, behavior: 'smooth' });
        return { success: true, description: `Scrolled ${target} ${amount}px` };
      }

      case 'hover': {
        const el = findElementById(target);
        if (!el) return makeError(ACTION_ERROR.ELEMENT_NOT_FOUND, `Element [${target}] not found`);
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        return { success: true, description: `Hovered [${target}]` };
      }

      case 'select': {
        const el = findElementById(target);
        if (!el) return makeError(ACTION_ERROR.ELEMENT_NOT_FOUND, `Element [${target}] not found`);
        const value = String(params.value ?? '');
        if (el instanceof HTMLSelectElement) {
          el.value = value;
        } else if (!setTextLikeValue(el, value)) {
          return makeError(ACTION_ERROR.INVALID_TARGET, `Element [${target}] is not selectable`);
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, description: `Selected "${value}" in [${target}]` };
      }

      case 'press_key': {
        const el = document.activeElement || document.body;
        const keyEvent = { key: params.key, code: params.key, bubbles: true, cancelable: true };
        el.dispatchEvent(new KeyboardEvent('keydown', keyEvent));
        el.dispatchEvent(new KeyboardEvent('keypress', keyEvent));
        el.dispatchEvent(new KeyboardEvent('keyup', { ...keyEvent, cancelable: false }));
        if (params.key === 'Enter' && el !== document.body) {
          const form = el.closest('form');
          if (form) {
            const submitBtn = form.querySelector('[type="submit"], button:not([type="button"])');
            if (submitBtn) submitBtn.click();
            else try { form.submit(); } catch { }
          }
        }
        return { success: true, description: `Pressed ${params.key}` };
      }

      default:
        return makeError(ACTION_ERROR.INVALID_ACTION, `Unknown action type: ${type}`);
    }
  }

  // ===== MESSAGE HANDLER =====

  function onRuntimeMessage(msg, sender, sendResponse) {
    const { action, payload } = msg;

    try {
      switch (action) {
        case 'readPage':
          sendResponse(extractAccessibilityTree(payload));
          break;
        case 'getPageText':
          sendResponse(getPageText(payload));
          break;
        case 'find':
          sendResponse(findByDescription(payload));
          break;
        case 'findText':
          sendResponse(findTextOnPage(payload));
          break;
        case 'executeAction':
          sendResponse(executeAction(payload));
          break;
        case 'getPageInfo':
          sendResponse({
            url: window.location.href,
            title: document.title,
            readyState: document.readyState,
          });
          break;
        // Legacy support for basic context
        case 'GET_PAGE_CONTEXT':
          sendResponse({
            success: true,
            data: {
              url: window.location.href,
              title: document.title,
              text: (document.body?.innerText || '').substring(0, 10000).replace(/\s+/g, ' ').trim(),
            },
          });
          break;
        default:
          sendResponse(makeError(ACTION_ERROR.INVALID_ACTION, `Unknown action: ${action}`));
      }
    } catch (err) {
      sendResponse(makeError('CONTENT_HANDLER_FAILED', err.message));
    }

    return true; // Keep message channel open
  }

  // Handle both message formats (legacy type-based and new action-based)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Support legacy { type: 'GET_PAGE_CONTEXT' } format
    if (msg.type && !msg.action) {
      return onRuntimeMessage({ action: msg.type, payload: msg }, sender, sendResponse);
    }
    return onRuntimeMessage(msg, sender, sendResponse);
  });

  console.log('[Copilot Sidebar] Content script initialized');
})();
