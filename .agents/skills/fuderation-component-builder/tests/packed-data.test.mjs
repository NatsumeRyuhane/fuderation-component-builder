import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { encode, decode } from 'base32768';
import { assembleDiagnostics } from '../scripts/build-diagnostics.mjs';
import { diagnosticBytes, packedDiagnosticSources } from '../scripts/generate-packed-diagnostic.mjs';
import { toEnvelope, LIMITS } from '../../../../scripts/build.mjs';
import { createHost, renderIframe, waitForResult } from './runtime-harness.mjs';

const fixture = (await assembleDiagnostics()).find(({ id }) => id === 'iframe-data');
assert.ok(fixture, 'packed data belongs to the standard diagnostic registry');
const component = JSON.parse(JSON.stringify(toEnvelope(fixture.component))).component;
const bytes = diagnosticBytes();
const packed = encode(bytes);
const storageKey = 'fcb.diagnostics.packed.v1';
const row = (root, id) => root.querySelector(`[data-check="${id}"]`);

test('packed fixtures are reproducible and keep the complete export within its character budget', async () => {
  for (const [name, source] of Object.entries(await packedDiagnosticSources())) {
    assert.equal(await readFile(path.join(fixture.directory, 'src', name), 'utf8'), source,
      `${name} is stale: run generate-packed-diagnostic.mjs`);
  }
  assert.equal(bytes.length, 18002);
  assert.equal(packed.length, 9602);
  assert.equal(new Set(bytes).size, 256);
  assert.ok(component.script.includes(packed), 'build preserves literal packed Unicode');
  assert.ok(Buffer.from(bytes).toString('base64').length > LIMITS.source, 'Base64 payload alone exceeds budget');
  const total = component.html.length + component.css.length + component.script.length;
  assert.ok(total <= LIMITS.source, `packed component exceeds budget: ${total}`);
});

test('data-heavy iframe passes six real checks after export and on rerun', async (t) => {
  const host = createHost();
  const originalSave = host.saveToLocal;
  let writes = 0;
  host.saveToLocal = (...args) => { writes++; return originalSave(...args); };
  const { window, root } = renderIframe(t, component, { host });
  for (let run = 1; run <= 2; run++) {
    assert.equal(await waitForResult(window, root), 'pass', root.textContent);
    assert.equal(root.querySelectorAll('[data-state="pass"]').length, 6);
    assert.match(root.querySelector('[data-summary]').textContent, /6\/6/);
    assert.equal(root.querySelector('[data-value]').value, packed);
    assert.equal(root.querySelector('[data-dom-text]').textContent, packed);
    assert.deepEqual(Buffer.from(decode(host.storage.get(storageKey))), Buffer.from(bytes));
    assert.match(root.querySelector('[data-text]').textContent, /欢迎 😀\n<\/script>/);
    assert.ok(root.querySelector('[data-text]').textContent.includes('$Param$'));
    assert.equal(writes, run * 2, 'one reset and one payload write per run');
    if (run === 1) {
      root.querySelector('[data-run]').click();
      root.querySelector('[data-run]').click(); // disabled while running
      assert.equal(root.dataset.result, 'running');
    }
  }
});

for (const kind of ['invalid character', 'valid but changed bytes', 'truncation']) {
  test(`packed diagnostic detects ${kind} and continues independent checks`, async (t) => {
    const changed = bytes.slice();
    changed[512] ^= 1;
    const replacement = kind === 'invalid character' ? 'A' + packed.slice(1)
      : kind === 'truncation' ? packed.slice(0, -2) : encode(changed);
    const script = component.script.replace(packed, replacement);
    assert.notEqual(script, component.script);
    const { window, root } = renderIframe(t, { ...component, script });
    assert.equal(await waitForResult(window, root), 'fail');
    assert.equal(row(root, 'bytes').dataset.state, 'fail');
    assert.equal(row(root, 'text').dataset.state, 'pass');
    assert.equal(row(root, 'invalid').dataset.state, 'pass');
    assert.equal(root.querySelector('[data-run]').disabled, false);
  });
}

test('packed diagnostic rejects invalid UTF-8 after binary decoding', async (t) => {
  const text = await readFile(path.join(fixture.directory, 'data/text.json'));
  const script = component.script.replace(encode(text), encode(Uint8Array.of(255)));
  assert.notEqual(script, component.script);
  const { window, root } = renderIframe(t, { ...component, script });
  assert.equal(await waitForResult(window, root), 'fail');
  assert.equal(row(root, 'text').dataset.state, 'fail');
  assert.equal(root.querySelectorAll('[data-state="fail"]').length, 1);
});

for (const [bridge, failures] of [['setValue', ['dom']], ['setText', ['text', 'dom']]]) {
  test(`packed diagnostic detects broken ${bridge} instead of claiming success`, async (t) => {
    const { window, root } = renderIframe(t, component, {
      breakBridge(frame) { frame[bridge] = () => {}; },
    });
    assert.equal(await waitForResult(window, root), 'fail');
    for (const id of failures) assert.equal(row(root, id).dataset.state, 'fail');
    assert.equal(root.querySelectorAll('[data-state="fail"]').length, failures.length);
    assert.equal(row(root, 'storage').dataset.state, 'pass');
  });
}

test('packed diagnostic detects storage truncation', async (t) => {
  const host = createHost();
  host.saveToLocal = (key, value) => host.storage.set(key, value === 'RESET' ? value : value.slice(0, -1));
  const { window, root } = renderIframe(t, component, { host });
  assert.equal(await waitForResult(window, root), 'fail');
  assert.match(row(root, 'storage').textContent, /Stored payload changed/);
});

test('packed rerun cannot reuse old DOM or stored success', async (t) => {
  const host = createHost();
  const { window, root } = renderIframe(t, component, { host });
  assert.equal(await waitForResult(window, root), 'pass');
  window.setValue = () => {};
  host.saveToLocal = () => {};
  root.querySelector('[data-run]').click();
  assert.equal(await waitForResult(window, root), 'fail');
  assert.equal(row(root, 'dom').dataset.state, 'fail');
  assert.match(row(root, 'storage').textContent, /Storage reset failed/);
});
