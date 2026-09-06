// DSL-mode interpreter.
//
// ── Why this file exists ──────────────────────────────────────────────────────
// The runtime chunk emits DSL components as
//   <div class="story-inline-component is-clickable" data-component-script="…"
//        role="button" tabindex="0">
// The production executor was located in MessageBubble-lB0l6UTk.js via Chat's
// lazy dependency map on 2026-09-06. This remains a reconstruction, not vendored
// code. Its 12-statement execution cap, quote-aware splitting, awaited getters,
// and equality-guard halt now follow that source (RUNTIME_INTERNALS.md §3).
//
// What is faithful, because it is read straight out of the runtime's own iframe
// bridge source: the whitelist, the selector rules (`@host`, querySelector only,
// 200-char cap), and every function's behaviour.

import { HOST_ACTIONS } from './host.js';
import { DSL_EXECUTION_LIMIT, splitDslStatements } from '../../scripts/dsl-statements.mjs';

// Mirrors the runtime's `Se()` pure-DSL check.
export const BRIDGE_FNS = new Set([
  'fillInput', 'saveToLocal', 'readFromLocal', 'getWorldInfo', 'copyText',
  'toast', 'appendMsg', 'changeMsg', 'tempAppendMsg', 'tempChangeMsg',
  'getMsgContent', 'getUserAvatar', 'getCurrentUserAvatar', 'getCharAvatar',
  'getCurrentCharAvatar', 'openUrl', 'setText', 'setValue', 'show', 'hide',
  'addClass', 'removeClass', 'setStyle', 'progress', 'wait', 'requireInputEquals',
]);

const MAX_STATEMENTS = 32;

/** Split a DSL script the way the runtime's pure-DSL check does. */
export function statements(script) {
  return String(script || '')
    .split(/[\r\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('//'))
    .slice(0, MAX_STATEMENTS);
}

// ── A tiny expression reader ─────────────────────────────────────────────────
// Handles what the guide actually shows in DSL scripts: string/number/boolean
// literals, zero-arg getter calls used as arguments, and `a() || b()` fallback
// chains (the documented avatar idiom).

function readString(src, i) {
  const quote = src[i];
  let out = '';
  i += 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      const next = src[i + 1];
      out += next === 'n' ? '\n' : next === 't' ? '\t' : next === 'r' ? '\r' : next;
      i += 2;
      continue;
    }
    if (ch === quote) return [out, i + 1];
    out += ch;
    i += 1;
  }
  throw new SyntaxError('unterminated string');
}

function skipWs(src, i) {
  while (i < src.length && /\s/.test(src[i])) i += 1;
  return i;
}

/** Parse `name(arg, arg, …)`. Returns { name, args:[node] }. */
export function parseCall(src) {
  const text = String(src || '').trim();
  const m = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  if (!m) throw new SyntaxError(`not a bridge call: ${text.slice(0, 40)}`);

  const name = m[1];
  let i = m[0].length;
  const args = [];

  i = skipWs(text, i);
  if (text[i] === ')') return { name, args };

  for (;;) {
    const [node, next] = parseExpr(text, i);
    args.push(node);
    i = skipWs(text, next);
    if (text[i] === ',') {
      i = skipWs(text, i + 1);
      continue;
    }
    if (text[i] === ')') return { name, args };
    throw new SyntaxError(`unexpected ${JSON.stringify(text[i] ?? 'EOF')} in ${name}(…)`);
  }
}

function parseExpr(src, i) {
  let [left, next] = parseAtom(src, i);
  for (;;) {
    const j = skipWs(src, next);
    if (src[j] === '|' && src[j + 1] === '|') {
      const [right, after] = parseAtom(src, skipWs(src, j + 2));
      left = { kind: 'or', left, right };
      next = after;
      continue;
    }
    return [left, next];
  }
}

function parseAtom(src, i) {
  i = skipWs(src, i);
  const ch = src[i];
  if (ch === '"' || ch === "'" || ch === '`') {
    const [value, next] = readString(src, i);
    return [{ kind: 'literal', value }, next];
  }
  const num = src.slice(i).match(/^-?\d+(?:\.\d+)?/);
  if (num) return [{ kind: 'literal', value: Number(num[0]) }, i + num[0].length];

  const word = src.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
  if (!word) throw new SyntaxError(`cannot read argument at ${i}`);
  const ident = word[0];
  let next = i + ident.length;

  if (ident === 'true') return [{ kind: 'literal', value: true }, next];
  if (ident === 'false') return [{ kind: 'literal', value: false }, next];
  if (ident === 'null' || ident === 'undefined') return [{ kind: 'literal', value: '' }, next];

  const j = skipWs(src, next);
  if (src[j] !== '(') throw new SyntaxError(`bare identifier "${ident}" is not allowed`);
  const depth = matchParen(src, j);
  const inner = src.slice(j + 1, depth).trim();
  const callArgs = inner ? [parseExpr(inner, 0)[0]] : [];
  return [{ kind: 'call', name: ident, args: callArgs }, depth + 1];
}

function matchParen(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = readString(src, i)[1] - 1;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new SyntaxError('unbalanced parentheses');
}

// ── Execution ────────────────────────────────────────────────────────────────

async function evaluate(node, bridge) {
  if (node.kind === 'literal') return node.value;
  if (node.kind === 'or') {
    const left = await evaluate(node.left, bridge);
    return left || (await evaluate(node.right, bridge));
  }
  const fn = bridge[node.name];
  if (typeof fn !== 'function') throw new Error(`unknown bridge function: ${node.name}`);
  const args = [];
  for (const a of node.args) args.push(await evaluate(a, bridge));
  return fn(...args);
}

/**
 * Run a DSL script against one component root.
 * Returns { ran, halted, error } so the preview can report what happened.
 */
export async function runDsl(script, root, host) {
  const bridge = makeBridge(root, host);
  const lines = splitDslStatements(script).slice(0, DSL_EXECUTION_LIMIT);
  let ran = 0;

  for (const line of lines) {
    let call;
    try {
      call = parseCall(line);
    } catch (err) {
      return { ran, halted: false, error: `${err.message}  ← ${line}` };
    }
    if (!BRIDGE_FNS.has(call.name)) {
      return { ran, halted: false, error: `"${call.name}" is not a bridge function  ← ${line}` };
    }

    let result;
    try {
      result = await evaluate(call, bridge);
    } catch (err) {
      return { ran, halted: false, error: `${call.name}(): ${err.message}` };
    }
    ran += 1;

    // The production executor stops its loop when an equality guard fails.
    if (call.name === 'requireInputEquals' && result === false) {
      return { ran, halted: true, error: null };
    }
  }
  return { ran, halted: false, error: null };
}

/** The 26 bridge functions, scoped to one component root. */
export function makeBridge(root, host) {
  const q = (selector) => {
    const text = String(selector || '').trim();
    if (!text) return null;
    if (text === '@host') return root;
    if (text.length > 200) return null;
    try {
      return root.querySelector(text);
    } catch {
      return null;
    }
  };

  const safeMedia = (v) =>
    !/(javascript:|data:text\/html|data:application\/javascript)/i.test(String(v || '').trim());
  const safeProp = (p) => /^--[A-Za-z0-9_-]{1,64}$/.test(p) || /^[A-Za-z][A-Za-z-]{0,63}$/.test(p);
  const safeVal = (v) =>
    !/(javascript:|expression\s*\(|@import|url\s*\(\s*['"]?\s*javascript:)/i.test(String(v || ''));

  const setElementValue = (el, value) => {
    if (!el) return;
    const text = String(value ?? '');
    if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement ||
        el instanceof HTMLAudioElement || el instanceof HTMLSourceElement) {
      if (safeMedia(text)) el.setAttribute('src', text);
      return;
    }
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement) {
      el.value = text;
      return;
    }
    el.textContent = text;
  };

  const getElementValue = (el, trim = true) => {
    if (!el) return '';
    const v =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
        ? el.value || ''
        : el.textContent || '';
    return trim ? String(v).trim() : String(v);
  };

  const bridge = {
    // DOM
    setText: (s, t) => { const el = q(s); if (el) el.textContent = String(t ?? ''); },
    setValue: (s, v) => setElementValue(q(s), v),
    show: (s, d) => { const el = q(s); if (el) el.style.display = String(d || 'block'); },
    hide: (s) => { const el = q(s); if (el) el.style.display = 'none'; },
    addClass: (s, c) => { const el = q(s); const k = String(c || '').trim(); if (el && k) el.classList.add(k); },
    removeClass: (s, c) => { const el = q(s); const k = String(c || '').trim(); if (el && k) el.classList.remove(k); },
    setStyle: (s, prop, value) => {
      const el = q(s);
      const name = String(prop || '').trim();
      if (!el || !name) return;
      if (name.toLowerCase() === 'src') return setElementValue(el, value);
      if (safeProp(name) && safeVal(value)) el.style.setProperty(name, String(value || ''));
    },

    // Flow control
    progress: (barSel, textSel, ms) => {
      const bar = q(barSel);
      const label = q(textSel);
      if (!bar && !label) return Promise.resolve();
      const duration = Math.max(200, Math.min(Number(ms) || 1400, 10000));
      const start = performance.now();
      return new Promise((resolve) => {
        const tick = (now) => {
          const pct = Math.min(100, Math.round(((now - start) / duration) * 100));
          if (bar) bar.style.width = pct + '%';
          if (label) label.textContent = pct + '%';
          if (pct >= 100) return resolve();
          requestAnimationFrame(tick);
        };
        if (bar) bar.style.width = '0%';
        if (label) label.textContent = '0%';
        requestAnimationFrame(tick);
      });
    },
    wait: (ms) => new Promise((r) => setTimeout(r, Math.max(0, Math.min(Number(ms) || 0, 10000)))),
    requireInputEquals: (s, expected, message, trimValue) => {
      const trim = trimValue === undefined ? true : String(trimValue).toLowerCase() !== 'false';
      const actual = getElementValue(q(s), trim);
      if (actual !== String(expected ?? '')) {
        host.toast(String(message || '验证失败'), 'error');
        return false;
      }
      return true;
    },
  };

  // Host-bridged functions are shared with iframe mode; see host.js.
  for (const [name, fn] of Object.entries(HOST_ACTIONS(host))) bridge[name] = fn;
  return bridge;
}
