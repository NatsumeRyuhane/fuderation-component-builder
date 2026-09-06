// DOM assertions, not browser/layout verification. Render through the vendored
// runtime; DSL execution uses the preview's documented reconstruction.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const bundle = await build({
  stdin: {
    contents: `export {p as parseMessage, a as renderNode, h as getFrameDoc} from './vendor/storyComponents.js';
      export {runDsl} from './tools/preview/dsl.js';`,
    resolveDir: repository,
  },
  bundle: true, write: false, format: 'iife', globalName: 'DiagnosticHarness', platform: 'browser',
  plugins: [{
    name: 'preview-shims',
    setup(builder) {
      builder.onResolve({ filter: /purify\.es-[A-Za-z0-9_-]+\.js$/ }, () => ({ path: path.join(repository, 'tools/preview/shims/purify.js') }));
      builder.onResolve({ filter: /fontAwesomeLoader-[A-Za-z0-9_-]+\.js$/ }, () => ({ path: path.join(repository, 'tools/preview/shims/escape.js') }));
    },
  }],
});

function createDom(t, html = '') {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://diagnostics.invalid/' });
  t.after(() => dom.window.close());
  return dom;
}

export function createHost({ brokenStorage = false } = {}) {
  const storage = new Map();
  const toasts = [];
  return {
    storage, toasts,
    saveToLocal(key, value) { if (!brokenStorage) storage.set(key, value); return value; },
    readFromLocal(key) { return storage.get(key) ?? ''; },
    toast(value, level) { toasts.push({ value, level }); },
  };
}

function render(t, component) {
  const dom = createDom(t);
  const { window } = dom;
  window.eval(bundle.outputFiles[0].text);
  const harness = window.DiagnosticHarness;
  const nodes = harness.parseMessage(`<$${component.name}$></$${component.name}$>`, [component], { streaming: false });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].type, 'component');
  window.document.body.innerHTML = harness.renderNode(nodes[0], { renderScope: 'diagnostics' });
  return { window, harness };
}

export function renderDsl(t, component, host = createHost()) {
  const { window, harness } = render(t, component);
  const root = window.document.querySelector('[data-story-component="1"]');
  assert.ok(root, 'vendored runtime selected DSL');
  assert.equal(window.document.querySelector('[data-story-component-frame]'), null);
  return {
    window, root, host,
    run: () => harness.runDsl(root.getAttribute('data-component-script'), root, host),
  };
}

export function renderIframe(t, component, { host = createHost(), breakBridge } = {}) {
  const rendered = render(t, component);
  const placeholder = rendered.window.document.querySelector('[data-story-component-frame="1"]');
  assert.ok(placeholder, 'vendored runtime selected iframe');
  const document = rendered.harness.getFrameDoc(placeholder.dataset.storyFrameId);
  assert.ok(document, 'vendored runtime produced an iframe document');
  const { window } = createDom(t, document);
  const unexpectedActions = [];
  t.after(() => assert.deepEqual(unexpectedActions, [], 'fixture only calls diagnostic host actions'));
  // Exercise the real iframe bridge's asynchronous postMessage protocol with a
  // small in-memory host. No external requests or browser sessions are involved.
  window.addEventListener('message', ({ data }) => {
    if (data?.type !== 'story-component-action') return;
    if (!['toast', 'saveToLocal', 'readFromLocal'].includes(data.action)) unexpectedActions.push(data.action);
    let value;
    if (data.action === 'toast') host.toast(data.value, data.level);
    if (data.action === 'saveToLocal') value = host.saveToLocal(data.variable, data.value);
    if (data.action === 'readFromLocal') value = host.readFromLocal(data.variable);
    if (data.requestId) window.setTimeout(() => window.dispatchEvent(new window.MessageEvent('message', {
      data: { type: 'story-component-action-result', requestId: data.requestId, action: data.action, value },
    })), 0);
  });
  const scripts = [...window.document.querySelectorAll('script')];
  assert.equal(scripts.length, 3, 'bridge, authored component, and sizing scripts');
  scripts.forEach((script, index) => {
    if (index === 1) breakBridge?.(window);
    // Only our authored fixtures and the checked-in runtime are evaluated.
    window.eval(script.textContent);
  });
  return { window, host, root: window.document.querySelector('.lab') };
}

export function waitForResult(window, root) {
  return new Promise((resolve, reject) => {
    const observer = new window.MutationObserver(check);
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Diagnostic did not finish: ${root.textContent}`));
    }, 10000);
    function check() {
      if (!['pass', 'fail'].includes(root.dataset.result)) return;
      observer.disconnect();
      window.clearTimeout(timeout);
      resolve(root.dataset.result);
    }
    observer.observe(root, { attributes: true, attributeFilter: ['data-result'] });
    check();
  });
}
