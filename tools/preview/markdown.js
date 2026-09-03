// Markdown rendering, configured exactly as the site configures it.
//
// From the app's useMarkdown chunk:
//   new MarkdownIt({ html: true, linkify: true, breaks: true, highlight: … })
//
// We skip the syntax-highlight hook (it pulls in highlight.js plus a language
// pack per grammar); fenced code still renders, just without token colours.
// The output is wrapped in `.markdown-body`, which is the class the site's own
// stylesheet targets — see vendor/site-chat.css.

import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: true, linkify: true, breaks: true });

export function renderMarkdown(text) {
  return md.render(String(text ?? ''));
}
