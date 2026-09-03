// Markdown rendering, reproducing the site's pipeline rather than approximating
// it — including the sanitising, because the site sanitises this path too.
//
// From the app's useMarkdown chunk:
//   new MarkdownIt({ html: true, linkify: true, breaks: true, highlight: … })
//
// We skip the syntax-highlight hook (it pulls in highlight.js plus a language
// pack per grammar); fenced code still renders, just without token colours.
// The output is wrapped in `.markdown-body`, the class the site's own stylesheet
// targets — see vendor/site-chat.css.
//
// After rendering, the site runs TWO stages, and reproducing only one of them
// gives a preview that is wrong in one direction or the other:
//
//   1. DOMPurify.sanitize(html, config) with a deliberately permissive config —
//      71 tags including form/button/input/svg, and ADD_ATTR admitting onclick,
//      onerror and ontoggle, which the component sanitiser never allows.
//   2. A regex pass that re-strips those handlers unless they match one of 12
//      site-provided callbacks (window.copyCodeBlock(this) and friends), keeps
//      onerror only when it contains `this.onerror = null`, and unconditionally
//      removes onload/onmouseover/onsubmit/etc.
//
// Stage 2 is why stage 1 looks so lax: it is how `<pre onclick="window.
// copyCodeBlock(this)">` survives while an attacker's onclick does not.
//
// Both stages are extracted from the live chunk into vendor/markdown-sanitize.
// json and SHA-256 pinned, so this stays a reproduction of what ships rather
// than a guess. Nothing here is our own policy — see reportRemovals() for the
// warning surfaced when the pipeline drops something.

import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import RULES from '../../vendor/markdown-sanitize.json';

const md = new MarkdownIt({ html: true, linkify: true, breaks: true });

const CONFIG = {
  ALLOWED_TAGS: RULES.config.ALLOWED_TAGS,
  ALLOWED_ATTR: RULES.config.ALLOWED_ATTR,
  ADD_ATTR: RULES.config.ADD_ATTR,
  ALLOW_DATA_ATTR: RULES.config.ALLOW_DATA_ATTR,
  ...(RULES.config.ALLOWED_URI_REGEXP
    ? { ALLOWED_URI_REGEXP: new RegExp(RULES.config.ALLOWED_URI_REGEXP, 'i') }
    : {}),
};

const WRAPPER_TAGS = new Set(['html', 'head', 'body']);
const ONCLICK_ALLOW = RULES.handlers.onclickAllow.map((src) => new RegExp(src, 'i'));
const ONERROR_ALLOW = new RegExp(RULES.handlers.onerrorAllow);
const ALWAYS_STRIP = new RegExp(
  `\\s+on(?:${RULES.handlers.alwaysStrip.join('|')})\\s*=\\s*["'][^"']*["']`,
  'gi',
);

/** Stage 2: the site's own post-sanitise handler pass. */
function stripHandlers(html, removed) {
  const onclick = (whole, body) => {
    if (ONCLICK_ALLOW.some((re) => re.test(body))) return whole;
    removed.push({ kind: 'onclick', detail: body });
    return '';
  };
  const onerror = (whole, body) => {
    if (ONERROR_ALLOW.test(body)) return whole;
    removed.push({ kind: 'onerror', detail: body });
    return '';
  };

  return html
    .replace(/\s+onclick\s*=\s*"([^"]*)"/gi, onclick)
    .replace(/\s+onclick\s*=\s*'([^']*)'/gi, onclick)
    .replace(/\s+onerror\s*=\s*"([^"]*)"/gi, onerror)
    .replace(/\s+onerror\s*=\s*'([^']*)'/gi, onerror)
    .replace(ALWAYS_STRIP, (whole) => {
      removed.push({ kind: 'handler', detail: whole.trim() });
      return '';
    });
}

/**
 * Render one markdown chunk exactly as the client does.
 * Returns the html plus a list of everything the pipeline dropped, so the
 * caller can surface it OUTSIDE the render area instead of silently differing
 * from what the author wrote.
 */
export function renderMarkdown(text) {
  const raw = md.render(String(text ?? ''));
  const removed = [];

  const purified = DOMPurify.sanitize(raw, CONFIG);
  for (const tag of DOMPurify.removed || []) {
    const name = tag?.element?.nodeName || tag?.attribute?.name;
    if (!name) continue;
    const lower = String(name).toLowerCase();
    // html/head/body are the parser's implicit wrapper, not author content —
    // they are "removed" on every single call. The client has the same artifact
    // and obviously does not surface it.
    if (WRAPPER_TAGS.has(lower)) continue;
    removed.push({ kind: 'sanitizer', detail: lower });
  }

  return { html: stripHandlers(purified, removed), removed };
}

/** Human-readable summary of what the pipeline dropped, or '' if nothing did. */
export function describeRemovals(removed) {
  if (!removed?.length) return '';
  const byKind = new Map();
  for (const { kind, detail } of removed) {
    if (!byKind.has(kind)) byKind.set(kind, new Set());
    byKind.get(kind).add(detail.length > 48 ? `${detail.slice(0, 48)}…` : detail);
  }
  const label = { sanitizer: '消毒器删除', onclick: 'onclick 被剥离', onerror: 'onerror 被剥离', handler: '事件处理器被剥离' };
  return [...byKind]
    .map(([kind, set]) => `${label[kind] || kind}：${[...set].join('、')}`)
    .join('　|　');
}
