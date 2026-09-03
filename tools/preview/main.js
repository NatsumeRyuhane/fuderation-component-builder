// Preview orchestrator: a component -> real runtime -> mock chat bubble.
//
// Parsing, mode dispatch, sanitizing, CSS flattening and the iframe document all
// come from the vendored runtime, unmodified. Mounting, the DSL interpreter, the
// host and this chrome are ours. Markdown uses the site's own markdown-it config.

import * as runtime from '../../vendor/storyComponents.js';
import { createHost, listenForFrameActions } from './host.js';
import { mountFrames, listenForFrameResize, requestResize } from './frame.js';
import { runDsl, statements, BRIDGE_FNS } from './dsl.js';
import { renderMarkdown, describeRemovals } from './markdown.js';

// Runtime exports, by their minified names (see RUNTIME_INTERNALS.md).
const parseMessage = runtime.p;   // Pe: text + components -> nodes
const renderNode = runtime.a;     // Fe: node -> html string
const getFrameDoc = runtime.h;    // $e: frameId -> iframe document
const normalizeList = runtime.e;  // $:  raw components -> normalized
const promptBlock = runtime.j;    // ze: components -> injected system prompt

const AVATAR = (hue) =>
  'data:image/svg+xml;base64,' +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="hsl(${hue} 62% 52%)"/><circle cx="40" cy="31" r="14" fill="rgba(255,255,255,.9)"/><path d="M12 78c5-18 15-25 28-25s23 7 28 25z" fill="rgba(255,255,255,.9)"/></svg>`,
  );

const state = {
  component: null,
  origin: 'src',              // 'src' | 'file'
  originLabel: 'src/',
  params: {},                 // param name -> value
  before: '',
  after: '',
  rawMode: false,
  rawMessage: '',
  userAvatar: AVATAR(214),
  charAvatar: AVATAR(276),
  worldBook: [
    { keys: ['吸血鬼', 'vampire'], enabled: true, content: '吸血鬼无法跨越流动的水。' },
    { keys: ['实验室', 'lab'], enabled: true, content: '地下实验室由一道四位数密码封锁。' },
    { keys: ['disabled'], enabled: false, content: '这条被禁用，不应该出现。' },
  ],
  width: 360,
  logs: [],
};

const $ = (s) => document.querySelector(s);
const el = {
  bubble: $('[data-bubble]'), bubbleWrap: $('[data-bubble-wrap]'),
  charAvatar: $('[data-char-avatar]'), charName: $('[data-char-name]'),
  meta: $('[data-meta]'), mode: $('[data-mode]'), warnings: $('[data-warnings]'),
  prompt: $('[data-prompt]'), log: $('[data-log]'),
  params: $('[data-params]'), before: $('[data-before]'), after: $('[data-after]'),
  message: $('[data-message]'), rawField: $('[data-raw-field]'),
  composed: $('[data-composed]'), rawToggle: $('[data-raw-toggle]'),
  sourceChip: $('[data-source-chip]'), resetSrc: $('[data-reset-src]'),
  mdNotice: $('[data-md-notice]'), mdNoticeBody: $('[data-md-notice-body]'),
  fileInput: $('[data-file-input]'), dropzone: $('[data-dropzone]'),
};

let teardownActions = null;
let teardownResize = null;

// ── message composition ──────────────────────────────────────────────────────

/** Placeholders the component declares, in first-appearance order. */
function detectParams(component) {
  const seen = [];
  const scan = (text) => {
    for (const m of String(text || '').matchAll(/(?<!\\)\$([^$\n]{1,64})\$/g)) {
      const name = m[1];
      if (!name.startsWith('{') && !seen.includes(name)) seen.push(name);
    }
  };
  scan(component.html);
  scan(component.css);
  scan(component.script);
  return seen;
}

function buildInvocation() {
  const name = state.component?.name || 'Component';
  const names = detectParams(state.component || {});
  if (!names.length) return `<$${name}$></$${name}$>`;
  const body = names.map((p) => `  <${p}>${state.params[p] ?? ''}</${p}>`).join('\n');
  return `<$${name}$>\n${body}\n</$${name}$>`;
}

function composedMessage() {
  if (state.rawMode) return state.rawMessage;
  return [state.before.trim(), buildInvocation(), state.after.trim()]
    .filter(Boolean)
    .join('\n\n');
}

function renderParamEditor() {
  const names = detectParams(state.component || {});
  if (!names.length) {
    el.params.innerHTML = '<p class="empty">该组件没有 <code>$参数$</code> 占位符。</p>';
    return;
  }
  // Built with DOM APIs throughout: a parameter *name* comes from the component
  // under test and can contain quotes or angle brackets, which would break out
  // of both the label text and the data-param attribute if interpolated.
  el.params.replaceChildren(
    ...names.map((p, i) => {
      const row = document.createElement('div');
      row.className = 'param';

      const label = document.createElement('label');
      label.htmlFor = `p${i}`;
      label.textContent = p;

      const long = (state.params[p] ?? '').length > 40;
      const field = document.createElement(long ? 'textarea' : 'input');
      field.id = `p${i}`;
      field.dataset.param = p;
      if (long) field.rows = 2;
      else field.type = 'text';

      row.append(label, field);
      return row;
    }),
  );
  // Values are assigned as properties, so nothing in a value can inject markup.
  for (const node of el.params.querySelectorAll('[data-param]')) {
    node.value = state.params[node.dataset.param] ?? '';
    node.addEventListener('input', () => {
      state.params[node.dataset.param] = node.value;
      syncRawBox();
      render();
    });
  }
}

function syncRawBox() {
  if (!state.rawMode) el.message.value = composedMessage();
}

// ── logging ──────────────────────────────────────────────────────────────────

function log(entry) {
  state.logs.unshift({ ...entry, at: new Date().toLocaleTimeString('zh-CN', { hour12: false }) });
  state.logs = state.logs.slice(0, 60);
  renderLog();
}

function renderLog() {
  if (!state.logs.length) {
    el.log.innerHTML = '<p class="empty">还没有调用。与组件交互后会显示在这里。</p>';
    return;
  }
  el.log.innerHTML = state.logs
    .map((e) =>
      `<div class="log-row log-${e.kind}">` +
      `<span class="log-time">${e.at}</span>` +
      `<span class="log-kind">${e.kind}${e.level ? ':' + e.level : ''}</span>` +
      `<span class="log-text"></span>` +
      (e.note ? `<span class="log-note">${e.note}</span>` : '') +
      `</div>`)
    .join('');
  el.log.querySelectorAll('.log-text').forEach((n, i) => { n.textContent = state.logs[i].text ?? ''; });
}

const host = createHost({
  onLog: log,
  getState: () => ({ ...state, message: composedMessage() }),
  onMessageChange: (next, info) => {
    // A component rewrote the message. Switch to raw mode so what we render is
    // exactly what it produced, and reflect it in the editor.
    state.rawMode = true;
    state.rawMessage = next;
    el.rawToggle.checked = true;
    applyRawModeUi();
    el.message.value = next;
    log({
      kind: info.action,
      text: next.length > 90 ? next.slice(0, 90) + '…' : next,
      note: info.persisted ? '已持久化' : '仅本地',
    });
    render();
  },
});

// ── mode analysis (mirrors scripts/build.mjs) ────────────────────────────────

function analyse(component) {
  const { html, css, script } = component;
  const nativeJs = /(?:^|[\s;(])(const|let|var|function|if|for|while|return)\b|=>|document\.|window\.|setInterval\s*\(|setTimeout\s*\(|requestAnimationFrame\s*\(|new\s+Date\s*\(/i;
  const atRule = /@(?:media|supports|keyframes|font-face|layer|container|property)\b/i;
  const globalSel = /(^|[\s,{>+~])(?:html|body|:root)(?=[\s.#:[>+~,{]|$)/i;
  // querySelectorAll runs against a detached <template>, so nothing stateful can
  // match, and pseudo-elements are not selectable at all (that rule is skipped).
  const deadPseudo = /::|:(?:hover|focus(?:-within|-visible)?|active|visited|target|before|after|first-line|first-letter)\b/i;
  // These *do* match — once, against the markup as it was at flatten time.
  const statePseudoStructural = /:(?:nth-child|nth-of-type|nth-last-child|nth-last-of-type|first-child|last-child|only-child|first-of-type|last-of-type|only-of-type|not|is|where|has)\b/i;
  const allStatements = (t) =>
    String(t || '').split(/[\r\n;]+/).map((x) => x.trim()).filter((x) => x && !x.startsWith('//'));

  const warnings = [];
  let mode, reason;

  if (script) {
    const lines = statements(script);
    const bad = lines.find((s) => {
      const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\([\s\S]*\)$/);
      return !m || !BRIDGE_FNS.has(m[1]);
    });
    const all = String(script).split(/[\r\n;]+/).map((s) => s.trim()).filter((s) => s && !s.startsWith('//'));
    // Se() slices to the first 32 statements *before* validating, so a long
    // all-whitelisted script still validates and stays in DSL mode.
    if (nativeJs.test(script)) [mode, reason] = ['iframe', '脚本包含原生 JS'];
    else if (bad) [mode, reason] = ['iframe', `存在非 DSL 语句：${bad.slice(0, 36)}`];
    else [mode, reason] = ['dsl', `${all.length} 条白名单桥接调用`];
  } else if (/<\s*(html|head|body)\b/i.test(html)) [mode, reason] = ['iframe', 'HTML 含完整文档标签'];
  else if (css.length > 1000) [mode, reason] = ['iframe', `CSS 共 ${css.length} 字符（> 1000）`];
  else if (atRule.test(css)) [mode, reason] = ['iframe', 'CSS 含 at-rule'];
  else if (globalSel.test(css)) [mode, reason] = ['iframe', 'CSS 选中了 html/body/:root'];
  else [mode, reason] = ['dsl', '无脚本，且 CSS 简单'];

  if (mode === 'dsl') {
    if (css.length > 1000) warnings.push(`CSS 被截断：超出 1000 字符上限的 ${css.length - 1000} 个字符会被静默丢弃。`);
    if (atRule.test(css)) warnings.push('DSL 模式会跳过 @media / @keyframes 等 at-rule。');
    if (deadPseudo.test(css)) {
      warnings.push('DSL 模式把 CSS 摊平成内联样式：状态伪类（:hover/:focus/:active）与伪元素（::before 等）永远不会生效。');
    }
    if (statePseudoStructural.test(css)) {
      warnings.push('结构性伪类（:nth-child 等）只在摊平的那一刻按初始 DOM 匹配一次，之后 DOM 变化不会重新套用。');
    }
    if (script) warnings.push('DSL 脚本在「点击组件」时才执行，不是挂载时。');
    if (statements(script).length < allStatements(script).length) {
      warnings.push(
        `脚本共 ${allStatements(script).length} 条语句，DSL 校验只看前 32 条 —— ` +
          '超出部分是否执行无法从可达代码确认，请勿依赖。',
      );
    }
  }
  if (mode === 'iframe' && /\bopenUrl\s*\(/.test(script)) {
    warnings.push('iframe 模式下 openUrl() 未定义，调用会抛 ReferenceError。');
  }
  if (!component.ai_prompt) warnings.push('ai_prompt 为空 —— AI 永远不会知道这个组件存在。');

  return { mode, reason, warnings };
}

// ── render ───────────────────────────────────────────────────────────────────

function render() {
  teardownActions?.();
  teardownResize?.();

  const raw = state.component;
  if (!raw) return;

  const [component] = normalizeList([raw]);
  const message = composedMessage();
  const nodes = parseMessage(message, [raw], { streaming: false });

  el.bubble.innerHTML = '';
  el.bubble.style.width = `${state.width}px`;
  el.charName.textContent = '角色';
  el.charAvatar.src = state.charAvatar;

  const mdRemoved = [];

  for (const node of nodes) {
    if (node.type === 'markdown') {
      if (!String(node.text).trim()) continue;
      const box = document.createElement('div');
      box.className = 'markdown-body';
      // Rendered exactly as the client renders it, dropped tags and all. What
      // the pipeline removed is reported below the bubble, never patched over.
      const { html, removed } = renderMarkdown(node.text);
      box.innerHTML = html;
      mdRemoved.push(...removed);
      el.bubble.appendChild(box);
      continue;
    }
    if (node.type === 'component-loading') {
      const s = document.createElement('div');
      s.className = 'bubble-loading';
      s.textContent = `⋯ 正在流式输出 <$${node.name}$>`;
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

  // Outside the render area on purpose: the bubble shows what the client shows,
  // and this strip says what the client silently took out on the way there.
  const summary = describeRemovals(mdRemoved);
  el.mdNotice.hidden = !summary;
  el.mdNoticeBody.textContent = summary;

  mountFrames(el.bubble, getFrameDoc);
  teardownActions = listenForFrameActions(host);
  teardownResize = listenForFrameResize();
  bindDslComponents();

  const { mode, reason, warnings } = analyse(raw);
  el.mode.textContent = `${mode === 'dsl' ? 'DSL（内联）模式' : 'iframe（沙箱）模式'} — ${reason}`;
  el.mode.className = `mode mode-${mode}`;
  el.warnings.innerHTML = warnings.length
    ? warnings.map(() => '<li></li>').join('')
    : '<li class="ok">没有警告。</li>';
  el.warnings.querySelectorAll('li:not(.ok)').forEach((li, i) => { li.textContent = warnings[i]; });

  const total = raw.html.length + raw.css.length + raw.script.length;
  el.meta.textContent =
    `${component.name} · ${total}/20000 字符（HTML ${raw.html.length} / CSS ${raw.css.length} / 脚本 ${raw.script.length}）`;
  el.prompt.textContent = promptBlock([raw]) || '（ai_prompt 为空，不会注入任何内容）';
}

function bindDslComponents() {
  for (const node of el.bubble.querySelectorAll('[data-story-component="1"]')) {
    const script = node.getAttribute('data-component-script') || '';
    if (!script) continue;
    node.addEventListener('click', async (event) => {
      event.stopPropagation();
      const result = await runDsl(script, node, host);
      if (result.error) log({ kind: 'dsl-error', text: result.error });
      else log({
        kind: 'dsl',
        text: `执行 ${result.ran} 条调用${result.halted ? '（被 requireInputEquals 中断）' : ''}`,
      });
    });
  }
}

// ── loading a component ──────────────────────────────────────────────────────

function adoptComponent(component, { originLabel, origin, seedParams = true }) {
  state.component = { source: '', ai_prompt: '', description: '', script: '', css: '', ...component };
  state.origin = origin;
  state.originLabel = originLabel;
  el.sourceChip.textContent = originLabel;
  el.sourceChip.classList.toggle('file', origin === 'file');
  el.resetSrc.hidden = origin !== 'file';

  if (seedParams) {
    state.params = {};
    for (const p of detectParams(state.component)) state.params[p] = `示例${p}`;
  }
  state.rawMode = false;
  el.rawToggle.checked = false;
  applyRawModeUi();
  renderParamEditor();
  syncRawBox();
  render();
}

async function loadFromSrc() {
  const res = await fetch('/api/component');
  const payload = await res.json();
  if (payload.error) {
    el.mode.textContent = payload.error;
    el.mode.className = 'mode mode-error';
    return;
  }
  adoptComponent(payload.component, { originLabel: 'src/', origin: 'src' });
}

/** Accept either a full export envelope or a bare component object. */
function componentFromJson(json) {
  const c = json?.component && typeof json.component === 'object' ? json.component : json;
  if (!c || typeof c !== 'object') throw new Error('不是有效的 JSON 对象');
  if (!c.name) throw new Error('缺少 component.name');
  if (!c.html && !c.source) throw new Error('缺少 component.html');
  // The editor stores single-field source; derive the three fields if needed.
  if (!c.html && c.source) {
    const styles = [];
    const scripts = [];
    const html = String(c.source)
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, b) => (styles.push(b.trim()), ''))
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_, b) => (scripts.push(b.trim()), ''))
      .replace(/<\/?(?:!doctype|html|head|body)[^>]*>/gi, '')
      .trim();
    return { ...c, html, css: styles.join('\n\n'), script: scripts.join('\n') };
  }
  return c;
}

async function loadFile(file) {
  try {
    const component = componentFromJson(JSON.parse(await file.text()));
    adoptComponent(component, { originLabel: file.name, origin: 'file' });
    log({ kind: 'import', text: `已载入 ${file.name}` });
  } catch (err) {
    log({ kind: 'dsl-error', text: `载入 ${file.name} 失败：${err.message}` });
    el.mode.textContent = `载入失败：${err.message}`;
    el.mode.className = 'mode mode-error';
  }
}

// ── UI wiring ────────────────────────────────────────────────────────────────

function applyRawModeUi() {
  el.composed.hidden = state.rawMode;
  // The raw box is a permanent read-out of the message the runtime actually
  // parses, so it stays visible in both modes — the toggle only decides whether
  // it is editable. It ships `hidden` in the markup purely to avoid a flash of
  // unstyled content before this runs.
  el.rawField.hidden = false;
  el.message.readOnly = !state.rawMode;
  el.message.style.opacity = state.rawMode ? '1' : '.65';
  el.message.title = state.rawMode ? '' : '勾选「直接编辑原文」后可编辑';
}

el.rawToggle.addEventListener('change', () => {
  state.rawMode = el.rawToggle.checked;
  if (state.rawMode) state.rawMessage = composedMessage();
  applyRawModeUi();
  syncRawBox();
  render();
});

el.message.addEventListener('input', () => {
  if (!state.rawMode) return;
  state.rawMessage = el.message.value;
  render();
});

for (const [node, key] of [[el.before, 'before'], [el.after, 'after']]) {
  node.addEventListener('input', () => {
    state[key] = node.value;
    syncRawBox();
    render();
  });
}

for (const btn of document.querySelectorAll('[data-width]')) {
  btn.addEventListener('click', () => {
    state.width = Number(btn.dataset.width);
    for (const b of document.querySelectorAll('[data-width]')) b.classList.toggle('active', b === btn);
    el.bubble.style.width = `${state.width}px`;
    for (const f of document.querySelectorAll('iframe.preview-component-frame')) requestResize(f);
  });
}

$('[data-pick-file]').addEventListener('click', () => el.fileInput.click());
el.fileInput.addEventListener('change', () => {
  if (el.fileInput.files?.[0]) loadFile(el.fileInput.files[0]);
  el.fileInput.value = '';
});
el.resetSrc.addEventListener('click', loadFromSrc);

// Drag & drop anywhere in the window.
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
  dragDepth += 1;
  el.dropzone.hidden = false;
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) el.dropzone.hidden = true;
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  el.dropzone.hidden = true;
  const file = e.dataTransfer?.files?.[0];
  if (file) loadFile(file);
});

$('[data-reset-storage]').addEventListener('click', () => {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('fcb-preview:local:')) localStorage.removeItem(k);
    }
    log({ kind: 'storage', text: '已清除预览的本地存储' });
  } catch (err) {
    log({ kind: 'storage', text: `无法访问本地存储：${err?.name || 'error'}` });
  }
});
$('[data-clear-log]').addEventListener('click', () => { state.logs = []; renderLog(); });

// Live reload from the dev server — only when previewing src/.
try {
  const es = new EventSource('/api/watch');
  es.addEventListener('change', () => { if (state.origin === 'src') loadFromSrc(); });
} catch { /* no live reload */ }

// Debug/automation hook.
window.__preview = {
  get state() { return state; },
  setComponent(component, message) {
    adoptComponent(component, { originLabel: '(注入)', origin: 'file' });
    if (typeof message === 'string') {
      state.rawMode = true;
      state.rawMessage = message;
      el.rawToggle.checked = true;
      applyRawModeUi();
      el.message.value = message;
      render();
    }
  },
  reload: loadFromSrc,
  host,
};

renderLog();
applyRawModeUi();
loadFromSrc();
