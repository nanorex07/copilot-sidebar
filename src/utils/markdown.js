import { marked } from 'marked';

/**
 * Enhanced Markdown-to-HTML parser using the 'marked' package.
 */
export function parseMarkdown(text) {
  if (!text) return '';

  try {
    // Configure marked for safe and clean output
    marked.setOptions({
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Use GFM line breaks
    });
    return marked.parse(text);
  } catch (error) {
    console.error('Markdown parsing error:', error);
    return text;
  }
}
