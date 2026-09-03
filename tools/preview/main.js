// Preview orchestrator: src/ -> real runtime -> mock chat bubble.
//
// The parse/dispatch/sanitize/iframe-document half is the vendored runtime,
// unmodified. Only mounting, the DSL interpreter and the host are ours.

import * as runtime from '../../vendor/storyComponents.js';
import { createHost, listenForFrameActions } from './host.js';
import { mountFrames, listenForFrameResize, requestResize } from './frame.js';
import { runDsl, statements, BRIDGE_FNS } from './dsl.js';

// Runtime exports, by their minified names (see RUNTIME_INTERNALS.md).
const parseMessage = runtime.p;   // Pe: text + components -> nodes
const renderNode = runtime.a;     // Fe: node -> html string
const getFrameDoc = runtime.h;    // $e: frameId -> iframe document
const normalizeList = runtime.e;  // $:  raw components -> normalized
const promptBlock = runtime.j;    // ze: components -> injected system prompt

const AVATAR = (hue) =>
  'data:image/svg+xml;base64,' +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="12" fill="hsl(${hue} 60% 45%)"/><circle cx="32" cy="25" r="11" fill="rgba(255,255,255,.85)"/><path d="M10 62c4-14 12-20 22-20s18 6 22 20z" fill="rgba(255,255,255,.85)"/></svg>`,
  );

const state = {
  component: null,
  message: '',
  userAvatar: AVATAR(210),
  charAvatar: AVATAR(340),
  worldBook: [
    { keys: ['vampire', '吸血鬼'], enabled: true, content: 'Vampires cannot cross running water.' },
    { keys: ['lab', '实验室'], enabled: true, content: 'The underground lab is sealed with a 4-digit code.' },
    { keys: ['disabled'], enabled: false, content: 'You should never see this entry.' },
  ],
  width: 360,
  logs: [],
};

const $ = (sel) => document.querySelector(sel);
const el = {
  bubble: $('[data-bubble]'),
  message: $('[data-message]'),
  mode: $('[data-mode]'),
  warnings: $('[data-warnings]'),
  log: $('[data-log]'),
  meta: $('[data-meta]'),
  prompt: $('[data-prompt]'),
  widthLabel: $('[data-width-label]'),
};

let teardownActions = null;
let teardownResize = null;

function log(entry) {
  state.logs.unshift({ ...entry, at: new Date().toLocaleTimeString() });
  state.logs = state.logs.slice(0, 60);
  renderLog();
}

function renderLog() {
  if (!state.logs.length) {
    el.log.innerHTML = '<p class="empty">Nothing yet. Interact with the component.</p>';
    return;
  }
  el.log.innerHTML = state.logs
    .map(
      (e) =>
        `<div class="log-row log-${e.kind}">` +
        `<span class="log-time">${e.at}</span>` +
        `<span class="log-kind">${e.kind}${e.level ? `:${e.level}` : ''}</span>` +
        `<span class="log-text"></span>` +
        (e.note ? `<span class="log-note">${e.note}</span>` : '') +
        `</div>`,
    )
    .join('');
  // Assign text content separately so component-supplied strings can never
  // inject markup into the preview chrome.
  el.log.querySelectorAll('.log-text').forEach((node, i) => {
    node.textContent = state.logs[i].text ?? '';
  });
}

const host = createHost({
  onLog: log,
  getState: () => state,
  onMessageChange: (next, info) => {
    state.message = next;
    log({ kind: info.action, text: next.length > 80 ? next.slice(0, 80) + '…' : next,
          note: info.persisted ? 'persisted' : 'local only' });
    el.message.value = next;
    render();
  },
});

function analyse(component) {
  const { html, css, script } = component;
  const nativeJs =
    /(?:^|[\s;(])(const|let|var|function|if|for|while|return)\b|=>|document\.|window\.|setInterval\s*\(|setTimeout\s*\(|requestAnimationFrame\s*\(|new\s+Date\s*\(/i;
  const atRule = /@(?:media|supports|keyframes|font-face|layer|container|property)\b/i;
  const globalSel = /(^|[\s,{>+~])(?:html|body|:root)(?=[\s.#:[>+~,{]|$)/i;

  const warnings = [];
  let mode;
  let reason;

  if (script) {
    const lines = statements(script);
    const bad = lines.find((s) => {
      const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\([\s\S]*\)$/);
      return !m || !BRIDGE_FNS.has(m[1]);
    });
    const all = String(script).split(/[\r\n;]+/).map((s) => s.trim()).filter((s) => s && !s.startsWith('//'));
    if (nativeJs.test(script)) [mode, reason] = ['iframe', 'script contains native JS'];
    else if (bad) [mode, reason] = ['iframe', `non-DSL statement: ${bad.slice(0, 40)}`];
    else if (all.length > 32) [mode, reason] = ['iframe', `${all.length} calls (DSL parses 32)`];
    else [mode, reason] = ['dsl', `${all.length} whitelisted bridge call(s)`];
  } else if (/<\s*(html|head|body)\b/i.test(html)) [mode, reason] = ['iframe', 'full-document tag in markup'];
  else if (css.length > 1000) [mode, reason] = ['iframe', `css is ${css.length} chars (> 1000)`];
  else if (atRule.test(css)) [mode, reason] = ['iframe', 'css contains an at-rule'];
  else if (globalSel.test(css)) [mode, reason] = ['iframe', 'css targets html/body/:root'];
  else [mode, reason] = ['dsl', 'no script, plain css'];

  if (mode === 'dsl') {
    if (css.length > 1000) warnings.push(`CSS truncated: ${css.length - 1000} chars past the 1000-char cap are dropped.`);
    if (atRule.test(css)) warnings.push('@-rules are skipped in DSL mode.');
    if (/:(?:hover|focus|active|nth-|before|after)|::/.test(css)) warnings.push('Pseudo-classes/elements never apply in DSL mode.');
    if (script) warnings.push('DSL script runs on click — click the component to fire it.');
  }
  if (mode === 'iframe' && /\bopenUrl\s*\(/.test(script)) {
    warnings.push('openUrl() is undefined in iframe mode — it will throw.');
  }
  if (!component.ai_prompt) warnings.push('ai_prompt is empty — the AI would never invoke this.');

  return { mode, reason, warnings };
}

function render() {
  teardownActions?.();
  teardownResize?.();

  const raw = state.component;
  if (!raw) return;

  const [component] = normalizeList([raw]);
  const nodes = parseMessage(state.message, [raw], { streaming: false });

  el.bubble.innerHTML = '';
  el.bubble.style.width = `${state.width}px`;

  for (const node of nodes) {
    if (node.type === 'markdown') {
      if (!String(node.text).trim()) continue;
      const p = document.createElement('div');
      p.className = 'bubble-text';
      p.textContent = node.text;
      el.bubble.appendChild(p);
      continue;
    }
    if (node.type === 'component-loading') {
      const s = document.createElement('div');
      s.className = 'bubble-loading';
      s.textContent = `⋯ streaming <$${node.name}$>`;
      el.bubble.appendChild(s);
      continue;
    }
    const holder = document.createElement('div');
    holder.innerHTML = renderNode(node, {
      userAvatar: state.userAvatar,
      charAvatar: state.charAvatar,
      renderScope: 'preview',
    });
    el.bubble.appendChild(holder);
  }

  mountFrames(el.bubble, getFrameDoc);
  teardownActions = listenForFrameActions(host);
  teardownResize = listenForFrameResize();

  bindDslComponents();

  const { mode, reason, warnings } = analyse(raw);
  el.mode.textContent = `${mode} mode — ${reason}`;
  el.mode.className = `mode mode-${mode}`;
  el.warnings.innerHTML = warnings.length
    ? warnings.map((w) => `<li></li>`).join('')
    : '<li class="ok">No warnings.</li>';
  el.warnings.querySelectorAll('li:not(.ok)').forEach((li, i) => { li.textContent = warnings[i]; });

  const total = raw.html.length + raw.css.length + raw.script.length;
  el.meta.textContent =
    `${component.name} · ${total}/20000 chars ` +
    `(html ${raw.html.length} / css ${raw.css.length} / script ${raw.script.length})`;
  el.prompt.textContent = promptBlock([raw]) || '(no ai_prompt — nothing is injected)';
}

// DSL components carry their script in an attribute and are click-activated.
function bindDslComponents() {
  for (const node of el.bubble.querySelectorAll('[data-story-component="1"]')) {
    const script = node.getAttribute('data-component-script') || '';
    if (!script) continue;

    node.addEventListener('click', async (event) => {
      // A trigger button inside the component should not also bubble up and
      // re-fire; the real host uses data-component-trigger to keep Enter in an
      // input from reaching the global send.
      event.stopPropagation();
      const result = await runDsl(script, node, host);
      if (result.error) log({ kind: 'dsl-error', text: result.error });
      else log({
        kind: 'dsl',
        text: `${result.ran} call(s)${result.halted ? ' — halted by requireInputEquals' : ''}`,
      });
    });
  }
}

// ── wiring ───────────────────────────────────────────────────────────────────

async function load() {
  const res = await fetch('/api/component');
  const payload = await res.json();
  if (payload.error) {
    el.mode.textContent = payload.error;
    el.mode.className = 'mode mode-error';
    return;
  }
  const first = !state.component;
  state.component = payload.component;
  if (first || !state.message.trim()) {
    state.message = payload.sampleMessage;
    el.message.value = state.message;
  }
  render();
}

el.message.addEventListener('input', () => {
  state.message = el.message.value;
  render();
});

for (const btn of document.querySelectorAll('[data-width]')) {
  btn.addEventListener('click', () => {
    state.width = Number(btn.dataset.width);
    el.widthLabel.textContent = `${state.width}px`;
    for (const b of document.querySelectorAll('[data-width]')) b.classList.toggle('active', b === btn);
    el.bubble.style.width = `${state.width}px`;
    for (const f of document.querySelectorAll('iframe.preview-component-frame')) requestResize(f, '');
  });
}

$('[data-reset-storage]').addEventListener('click', () => {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('fcb-preview:local:')) localStorage.removeItem(k);
  }
  log({ kind: 'storage', text: 'cleared preview localStorage' });
});

$('[data-clear-log]').addEventListener('click', () => {
  state.logs = [];
  renderLog();
});

// Live reload: the dev server pushes a ping whenever src/ changes.
try {
  const es = new EventSource('/api/watch');
  es.addEventListener('change', () => load());
} catch {
  /* no live reload */
}

// Debug/automation hook. Lets you try a component without touching src/:
//   __preview.setComponent({ name, html, css, script, ai_prompt, description }, message)
window.__preview = {
  get state() {
    return state;
  },
  setComponent(component, message) {
    state.component = { source: '', ai_prompt: '', description: '', script: '', css: '', ...component };
    if (typeof message === 'string') {
      state.message = message;
      el.message.value = message;
    }
    render();
  },
  reload: load,
};

renderLog();
load();
