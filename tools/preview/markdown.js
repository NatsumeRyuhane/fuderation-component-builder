// Markdown rendering, configured exactly as the site configures it.
//
// From the app's useMarkdown chunk:
//   new MarkdownIt({ html: true, linkify: true, breaks: true, highlight: … })
//
// We skip the syntax-highlight hook (it pulls in highlight.js plus a language
// pack per grammar); fenced code still renders, just without token colours.
// The output is wrapped in `.markdown-body`, which is the class the site's own
// stylesheet targets — see vendor/site-chat.css.
//
// `html: true` means markdown-it passes raw HTML straight through, and this
// output is assigned to innerHTML. The text is not always yours: a component
// can push arbitrary markup into the message through appendMsg()/changeMsg(),
// which the preview then re-parses and re-renders. So the result goes through
// DOMPurify — the same sanitiser the runtime itself uses on component markup —
// before it reaches the DOM.

import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const md = new MarkdownIt({ html: true, linkify: true, breaks: true });

export function renderMarkdown(text) {
  return DOMPurify.sanitize(md.render(String(text ?? '')));
}
