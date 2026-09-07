import assert from 'node:assert/strict';
import vm from 'node:vm';
import test from 'node:test';
import { parse } from 'acorn';
import { analyseMode } from '../scripts/build.mjs';
import { splitDslStatements, DSL_EXECUTION_LIMIT } from '../scripts/dsl-statements.mjs';
import { stripWorkshopJavaScript, applyWorkshopFieldStripping } from '../scripts/workshop-import.mjs';
import { renderDsl } from '../.agents/skills/fuderation-component-builder/tests/runtime-harness.mjs';

test('Workshop import reproduces the production unterminated-regex failure', () => {
  const source = String.raw`const pattern = /\/\*literal\*\//;
pattern.test('/*literal*/');`;
  assert.doesNotThrow(() => parse(source, { ecmaVersion: 'latest' }));
  const imported = stripWorkshopJavaScript(source);
  assert.throws(() => parse(imported, { ecmaVersion: 'latest' }), /Unterminated regular expression/);
  assert.ok(analyseMode({ html: '<div></div>', css: '', script: source }).warnings.some((w) => /Workshop import/.test(w)));
  const safe = String.raw`new RegExp('/\\*literal\\*/').test('/*literal*/')`;
  assert.equal(stripWorkshopJavaScript(safe), safe);
  assert.equal(vm.runInNewContext(safe), true);
});

test('Workshop stripping protects strings but removes CSS comment text inside strings', () => {
  const source = String.raw`const text = 'https://example.com/a/*literal*/'; // remove
const quoted = "a\\\"//b"; /* remove */
const template = ` + '`/* keep */`' + ';';
  const stripped = stripWorkshopJavaScript(source);
  assert.ok(stripped.includes('https://example.com/a/*literal*/'));
  assert.ok(!stripped.includes('remove'));
  assert.doesNotThrow(() => parse(stripped, { ecmaVersion: 'latest' }));
  const css = '.x::after{content:"/* CSS literal */"}';
  assert.equal(applyWorkshopFieldStripping({ css }).css, '.x::after{content:""}');
  const escaped = String.raw`.x::after{content:"\2f * CSS literal *\2f "}`;
  assert.equal(applyWorkshopFieldStripping({ css: escaped }).css, escaped);
});

test('DSL execution stops silently at statement 12 even though mode validation accepts more', async (t) => {
  const script = Array.from({ length: 13 }, (_, i) => `setText('[data-result]', '${i + 1}')`).join('\n');
  const component = { name: 'DslLimitProbe', html: '<div data-result>NOT RUN</div>', css: '', script };
  assert.equal(DSL_EXECUTION_LIMIT, 12);
  assert.equal(analyseMode(component).mode, 'dsl');
  assert.ok(analyseMode(component).warnings.some((w) => /only the first 12/.test(w)));
  const { root, run, host } = renderDsl(t, component);
  assert.deepEqual({ ...await run() }, { ran: 12, halted: false, error: null });
  assert.equal(root.querySelector('[data-result]').textContent, '12');
  assert.deepEqual(host.toasts, []);
  assert.equal(analyseMode({ ...component, script: script + '\nunknownCall()' }).mode, 'iframe',
    'mode detection still inspects calls beyond the execution window');
});

test('execution splitting retains quoted delimiters and multiline call arguments', () => {
  const source = "setText(\n'[data-out]', 'semi; newline\ninside'\n);wait(0)";
  assert.deepEqual(splitDslStatements(source), ["setText(\n'[data-out]', 'semi; newline\ninside'\n)", 'wait(0)']);
});
