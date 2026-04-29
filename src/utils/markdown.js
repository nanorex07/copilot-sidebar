import { marked } from 'marked';

/**
 * Enhanced Markdown-to-HTML parser using the 'marked' package.
 */
export function parseMarkdown(text) {
  if (!text) return '';

  try {
    // Configure marked for safe and clean output
    const renderer = new marked.Renderer();
    renderer.link = ({ href, title, text }) => {
      return `<a href="${href}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    };

    marked.setOptions({
      renderer,
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Use GFM line breaks
    });
    return marked.parse(text);
  } catch (error) {
    console.error('Markdown parsing error:', error);
    return text;
  }
}
