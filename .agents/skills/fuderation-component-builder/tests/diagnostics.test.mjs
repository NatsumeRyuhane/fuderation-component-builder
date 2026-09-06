import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { assembleDiagnostics } from '../scripts/build-diagnostics.mjs';
import { stripJavaScriptComments } from '../../../../scripts/strip-comments.mjs';
import { createHost, renderDsl, renderIframe, waitForResult } from './runtime-harness.mjs';

const fixtures = await assembleDiagnostics();
const fixture = (id) => fixtures.find((entry) => entry.id === id);
const component = (id) => fixture(id).component;
const query = (root, selector) => {
  const element = root.querySelector(selector);
  assert.ok(element, `missing diagnostic probe: ${selector}`);
  return element;
};

test('fixtures strip comments, preserve intended modes and shorten eligible iframe locals', async () => {
  for (const entry of fixtures) {
    assert.ok(entry.component.ai_prompt.includes(entry.component.name));
    assert.ok(!entry.component.html.includes('<!--'));
    assert.ok(!entry.component.script.includes('/* Reset first:'));
  }
  const dslCss = await readFile(path.join(fixture('dsl').directory, 'src/styles.css'), 'utf8');
  assert.ok(dslCss.length > 1000, 'comments deliberately exercise the processed CSS budget');
  assert.ok(component('dsl').css.length <= 1000);
  const source = await readFile(path.join(fixture('iframe').directory, 'src/script.js'), 'utf8');
  const stripped = stripJavaScriptComments(source).trim();
  assert.ok(component('iframe').script.length < stripped.length, 'fixture must exercise real identifier renaming');
  assert.ok(component('iframe').css.includes('\\2f * CSS literal *\\2f '));
});

test('DSL renders a pending checklist and asserts three bridge results after execution', async (t) => {
  const { root, run, host } = renderDsl(t, component('dsl'));
  assert.match(query(root, '[data-summary]').textContent, /NOT RUN/);
  // Last CSS rule proves comment stripping prevents DSL stylesheet truncation.
  assert.equal(query(renderDsl(t, component('dsl-style')).root, '[data-style-probe]').style.padding, '8px');
  const result = await run();
  assert.equal(result.ran, 12);
  assert.equal(result.halted, false);
  assert.equal(result.error, null);
  assert.match(query(root, '[data-summary]').textContent, /^PASS/);
  for (const id of ['value', 'text', 'progress']) {
    assert.match(query(root, `[data-check-${id}]`).textContent, /^PASS/);
  }
  assert.equal(query(root, '[data-input]').value, '  DSL READY  ');
  assert.equal(query(root, '[data-text-probe]').textContent, '欢迎 https://example.com/a/*literal*/ // text');
  assert.equal(query(root, '[data-bar]').style.width, '100%');
  assert.equal(query(root, '[data-percent]').textContent, '100%');
  assert.equal(host.toasts.at(-1).value, 'DiagnosticDSL completed');
});

test('DSL storage and style panels retain the remaining assertions within 12 statements', async (t) => {
  const storage = renderDsl(t, component('dsl-storage'));
  assert.equal((await storage.run()).ran, 12);
  assert.equal(query(storage.root, '[data-storage-probe]').value, 'ROUNDTRIP');
  assert.equal(storage.host.storage.get('fcb.diagnostics.dsl.v1'), 'ROUNDTRIP');
  assert.match(query(storage.root, '[data-summary]').textContent, /^PASS/);
  const { root, run } = renderDsl(t, component('dsl-style'));
  assert.equal((await run()).ran, 10);
  assert.match(query(root, '[data-check-class]').textContent, /^PASS/);
  assert.ok(query(root, '[data-class-probe]').classList.contains('diagnostic-added'));
  assert.ok(!query(root, '[data-class-probe]').classList.contains('diagnostic-remove'));
  assert.equal(query(root, '[data-show-probe]').style.display, 'block');
  assert.equal(query(root, '[data-hide-probe]').style.display, 'none');
  assert.equal(query(root, '[data-style-probe]').style.backgroundColor, 'rgb(187, 247, 208)');
  assert.match(query(root, '[data-summary]').textContent, /^PASS/);
});

for (const [label, call, failure] of [
  ['input write', "setValue('[data-input]', '  DSL READY  ')", 'FAIL input value'],
  ['text write', "setText('[data-text-probe]', '欢迎 https://example.com/a/*literal*/ // text')", 'FAIL text'],
  ['class addition', "addClass('[data-class-probe]', 'diagnostic-added')", 'FAIL class'],
  ['class removal', "removeClass('[data-class-probe]', 'diagnostic-remove')", 'FAIL class'],
  ['progress completion', "progress('[data-bar]', '[data-percent]', 400)", 'FAIL progress'],
]) {
  test(`DSL checklist catches a missing ${label}`, async (t) => {
    const original = component(label.startsWith('class') ? 'dsl-style' : 'dsl');
    assert.ok(original.script.includes(call));
    const { root, run, host } = renderDsl(t, { ...original, script: original.script.replace(call, 'wait(0)') });
    const result = await run();
    assert.equal(result.error, null);
    assert.equal(result.halted, true);
    assert.ok(host.toasts.at(-1).value.startsWith(failure));
    assert.ok(!query(root, '[data-summary]').textContent.startsWith('PASS'));
  });
}

test('DSL storage assertion rejects stale success when writes are broken', async (t) => {
  const host = createHost({ brokenStorage: true });
  host.storage.set('fcb.diagnostics.dsl.v1', 'ROUNDTRIP');
  const { root, run } = renderDsl(t, component('dsl-storage'), host);
  assert.equal((await run()).halted, true);
  assert.equal(host.toasts.at(-1).value, 'FAIL storage reset');
  assert.match(query(root, '[data-check-storage]').textContent, /^PENDING/);
});

test('DSL negative control asserts the guard halts before forbidden operations', async (t) => {
  const { root, run, host } = renderDsl(t, component('dsl-guard'));
  assert.match(query(root, '[data-guard-status]').textContent, /^NOT RUN/);
  const result = await run();
  assert.equal(result.ran, 3);
  assert.equal(result.halted, true);
  assert.equal(result.error, null);
  assert.equal(host.toasts.at(-1).value, 'EXPECTED diagnostic rejection');
  assert.match(query(root, '[data-guard-status]').textContent, /^ARMED/);
  assert.equal(query(root, '[data-forbidden]').textContent, 'NOT REACHED');
});

test('DSL negative control visibly fails if the guard allows execution to continue', async (t) => {
  const original = component('dsl-guard');
  const { root, run } = renderDsl(t, {
    ...original,
    script: original.script.replace("'[data-wrong]', 'EXPECTED'", "'[data-wrong]', 'WRONG'"),
  });
  const result = await run();
  assert.equal(result.ran, 6);
  assert.equal(result.halted, false);
  assert.equal(result.error, null);
  assert.match(query(root, '[data-guard-status]').textContent, /^FAIL/);
  assert.equal(query(root, '[data-forbidden]').textContent, 'REACHED — FAIL');
});

test('iframe checks pass before and after renaming through the real iframe bridge', async (t) => {
  const source = await readFile(path.join(fixture('iframe').directory, 'src/script.js'), 'utf8');
  for (const script of [stripJavaScriptComments(source).trim(), component('iframe').script]) {
    const { window, root, host } = renderIframe(t, { ...component('iframe'), script });
    assert.equal(await waitForResult(window, root), 'pass', query(root, '[data-summary]').textContent);
    assert.equal(root.querySelectorAll('[data-check][data-state="pass"]').length, 10);
    assert.match(query(root, '[data-summary]').textContent, /10\/10/);
    assert.equal(host.storage.get('fcb.diagnostics.iframe.v1'), 'ROUNDTRIP');
    assert.ok(host.toasts.some(({ value }) => value === 'EXPECTED iframe diagnostic rejection'));
    assert.equal(query(root, '[data-visual-summary]').textContent, '0 / 4 visual observations confirmed');
    assert.equal(root.querySelectorAll('[data-visual]:checked').length, 0, 'automatic tests never claim visual approval');

    query(root, '[data-visual]').click();
    assert.equal(query(root, '[data-visual-summary]').textContent, '1 / 4 visual observations confirmed');
    query(root, '[data-run]').click();
    assert.equal(root.dataset.result, 'running');
    assert.equal(await waitForResult(window, root), 'pass');
    assert.equal(query(root, '[data-event-count]').textContent, '2 clicks observed', 'rerunning must not duplicate listeners');
    assert.equal(root.querySelectorAll('[data-visual]:checked').length, 1, 'rerun preserves manual observations');
  }
});

for (const [bridgeName, failedChecks] of [
  ['setValue', ['values', 'guard']],
  ['requireInputEquals', ['guard']],
  ['removeClass', ['classes']],
  ['show', ['styles']],
  ['progress', ['flow']],
  ['wait', ['flow']],
]) {
  test(`iframe checklist catches a broken ${bridgeName} bridge and continues other checks`, async (t) => {
    const { window, root } = renderIframe(t, component('iframe'), {
      breakBridge(frame) { frame[bridgeName] = () => {}; },
    });
    assert.equal(await waitForResult(window, root), 'fail');
    for (const id of failedChecks) assert.equal(query(root, `[data-check="${id}"]`).dataset.state, 'fail');
    assert.equal(root.querySelectorAll('[data-check][data-state="fail"]').length, failedChecks.length);
    assert.equal(query(root, '[data-check="events"]').dataset.state, 'pass');
    assert.equal(query(root, '[data-run]').disabled, false);
  });
}

test('iframe storage assertion rejects stale success with broken host writes', async (t) => {
  const host = createHost({ brokenStorage: true });
  host.storage.set('fcb.diagnostics.iframe.v1', 'ROUNDTRIP');
  const { window, root } = renderIframe(t, component('iframe'), { host });
  assert.equal(await waitForResult(window, root), 'fail');
  assert.match(query(root, '[data-check="storage"]').textContent, /FAIL.*Storage reset failed/);
});

test('iframe rerun cannot reuse an earlier successful value write', async (t) => {
  const { window, root } = renderIframe(t, component('iframe'));
  assert.equal(await waitForResult(window, root), 'pass');
  window.setValue = () => {};
  query(root, '[data-run]').click();
  assert.equal(await waitForResult(window, root), 'fail');
  assert.equal(query(root, '[data-check="values"]').dataset.state, 'fail');
});
