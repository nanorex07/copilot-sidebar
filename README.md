# Copilot Sidebar: Browser Automation Agent

Copilot Sidebar is a powerful browser automation agent built as a Chrome Extension. It leverages Large Language Models (LLMs) to understand, navigate, and interact with web pages in real-time.

## 🚀 Setup Steps

### 1. Development Environment
- Ensure you have [Node.js](https://nodejs.org/) (v18+) installed.
- Install dependencies:
  ```bash
  npm install
  ```

### 2. Build the Extension
- Run the build script to generate the `dist` folder:
  ```bash
  npm run build
  ```

### 3. Load into Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **"Developer mode"** (toggle in the top right).
3. Click **"Load unpacked"** and select the `dist` directory from this project.

### 4. Configuration
1. Click the Copilot Sidebar icon in your browser to open the sidepanel.
2. Navigate to the **Settings** tab.
3. Enter your **OpenAI API Key** (and optionally adjust the Model).
4. You are ready to go!

---

## 🏗 Architecture

The project follows a modular Chrome Extension architecture:

### Extension Layers
- **Sidepanel (Vue 3 + Vite)**: The primary UI where users interact with the agent. Built with Vue 3 for a reactive and modern experience.
- **Service Worker (Background)**: Handles extension lifecycle and coordinates with the sidepanel.
- **Content Script**: The bridge between the agent and the webpage. Injected into the active tab to perform DOM reads and interactions.

### Agent Design
The **Agent Class** (`src/services/agent.js`) manages the core logic:
1. **Perception**: Gathers page context via the Content Script.
2. **Reasoning**: Sends context and goals to the LLM.
3. **Action**: Parses tool calls from the LLM and executes them.
4. **Memory**: Maintains a session-based interaction history in `IndexedDB`.

---

## 🔍 Page Context Extraction

Page context is gathered dynamically before the agent loop starts and after significant interactions:
- **URL & Title**: Basic metadata from the active tab.
- **Text Extraction**: The content script recursively traverses the DOM to extract `innerText` while filtering out scripts and hidden elements.
- **Token Management**: To prevent hitting LLM context limits, the extracted text is truncated to a configurable threshold.
---

## 🛠 Tool & Action Design

Tools are defined as JSON schemas following the OpenAI Function Calling format.

### Design Pattern
1. **Definitions**: Schema-based descriptions in `src/tools/definitions.js` tell the LLM what is possible.
2. **Registry**: Handlers in `src/tools/registry.js` map these calls to specific executable payloads.
3. **Execution**: The agent sends these payloads to the content script, which uses standard Web APIs (`click()`, `dispatchEvent`, `element.value = ...`) to interact with the page.

### Available Tools
- `read_page`: Detailed DOM analysis.
- `find`: Locates specific elements using natural language queries.
- `click` / `type` / `select`: Direct interaction with elements.
- `scroll`: Navigates long pages.
- `done` / `fail`: Terminal states for the agent.

