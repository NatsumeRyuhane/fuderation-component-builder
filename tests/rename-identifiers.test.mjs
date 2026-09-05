import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { parse } from 'acorn';
import { renameJavaScriptIdentifiers, readRenameOptions } from '../scripts/rename-identifiers.mjs';
import { assembleComponent, analyseMode, validate } from '../scripts/build.mjs';

test('shortens local bindings without changing any other source text', async () => {
  const source = "function renderStatus(descriptiveMessage) {\n" +
    "  const trimmedMessage = descriptiveMessage.trim();\n" +
    "  setText('[data-status]', trimmedMessage);\n" +
    "  show('[data-status]');\n}";
  const renamed = await renameJavaScriptIdentifiers(source);
  assert.equal(renamed, "function renderStatus(a) {\n" +
    "  const b = a.trim();\n" +
    "  setText('[data-status]', b);\n" +
    "  show('[data-status]');\n}");
});

test('preserves exact literals, dollar escapes, templates, selectors and property names', async () => {
  const source = String.raw`function render(longMessage) {
  changeMsg('<\$Panel\$><Text>' + longMessage + '</Text></\$Panel\$>');
  setText('[data-status]', '$Text$ — 欢迎 https://example.com/*literal*/');
  const longPattern = /[\u4e00-\u9fa5]/;
  const longTemplate = String.raw` + '`\\$literal\\$ ${longMessage}`' + String.raw`;
  return [longPattern.test(longMessage), longTemplate, longMessage.length];
}`;
  const renamed = await renameJavaScriptIdentifiers(source);
  assert.ok(renamed.length < source.length);
  assert.ok(renamed.includes(String.raw`'<\$Panel\$><Text>'`));
  assert.ok(renamed.includes("'$Text$ — 欢迎 https://example.com/*literal*/'"));
  assert.ok(renamed.includes(String.raw`/[\u4e00-\u9fa5]/`));
  assert.ok(renamed.includes('`\\$literal\\$ ${'));
  assert.ok(renamed.includes("'[data-status]'"));
  assert.ok(renamed.includes('.length'));
});

const examples = [
  ['closure and shadowing', `function outer(longValue) {
    const longOuterValue = longValue + 1;
    function inner(longValue) { return longValue + longOuterValue; }
    return inner(4) + longValue;
  } outer(3);`],
  ['global collision avoidance', `const a = 7; function check(longValue) {
    const longResult = longValue + a; return longResult;
  } check(3);`],
  ['destructuring aliases and defaults', `function check(longOptions) {
    const { payload: longPayload = 4 } = longOptions;
    const [longFirst, ...longRest] = [longPayload, 2, 3];
    return longFirst + longRest.length;
  } check({});`],
  ['shorthand property and prototype semantics', `function check(longInput) {
    const longValue = longInput + 1; const __proto__ = 7;
    return JSON.stringify({ longValue, __proto__ });
  } check(3);`],
  ['computed properties', `function check(longKey, longValue) {
    const longResult = { [longKey]: longValue };
    return longResult[longKey];
  } check('payload', 3);`],
  ['catch and block bindings', `function check(longInput) {
    try { throw longInput; } catch (longError) {
      let longResult = longError + 1;
      { let longError = 2; longResult += longError; }
      return longResult;
    }
  } check(4);`],
  ['loop labels', `function check(longLimit) {
    let longTotal = 0;
    outerLabel: for (let longIndex = 0; longIndex < longLimit; longIndex++) {
      if (longIndex > 2) break outerLabel; longTotal += longIndex;
    }
    return longTotal;
  } check(7);`],
  ['private names', `class Panel {
    #longPrivateValue = 3;
    result(longInput) { return this.#longPrivateValue + longInput; }
  } new Panel().result(5);`],
  ['direct eval', `function check(longInput) {
    const longLocal = longInput + 1;
    return eval('longLocal + longInput');
  } check(4);`],
  ['with', `function check(longInput) {
    const longLocal = 2; with ({longLocal: 9}) { return longLocal + longInput; }
  } check(4);`],
  ['inferred function and class names', `function check(longInput) {
    const descriptiveArrow = () => longInput;
    const descriptiveClass = class {};
    let assignedCallback; assignedCallback = function() {};
    return [descriptiveArrow.name, descriptiveClass.name, assignedCallback.name].join(',');
  } check(4);`],
  ['default parameter names', `function check(longCallback = () => {}, longClass = class {}) {
    return longCallback.name + ',' + longClass.name;
  } check();`],
  ['destructuring default inferred names', `function check(longInput) {
    const { callback: descriptiveCallback = () => {}, klass: descriptiveClass = class {} } = longInput;
    return descriptiveCallback.name + ',' + descriptiveClass.name;
  } check({});`],
  ['default names in assignments', `function check(longInput) {
    let descriptiveCallback, descriptiveClass;
    [descriptiveCallback = () => {}] = [];
    descriptiveClass ||= class {};
    return descriptiveCallback.name + ',' + descriptiveClass.name + longInput;
  } check(4);`],
  ['directives and original number formats', `function check(longInput) {
    'use strict'; const longResult = 0x10 + longInput;
    return longResult;
  } check(4);`],
  ['ASI and regex boundaries', `function check(longInput) {
    const longValue = longInput / 2
    return /[/*]/.test('/*') ? longValue : 0
  } check(6);`],
];

for (const [name, source] of examples) {
  test(`retains behavior: ${name}`, async () => {
    const renamed = await renameJavaScriptIdentifiers(source);
    assert.equal(vm.runInNewContext(renamed), vm.runInNewContext(source));
    assert.ok(renamed.length <= source.length);
    if (!['direct eval', 'with', 'default parameter names'].includes(name)) {
      assert.ok(renamed.length < source.length, `${name} should exercise actual renaming`);
    }
  });
}

test('preserves top-level declarations, shorthand names, labels and private properties', async () => {
  const source = `const topLevelValue = 3;
function exposedHandler(longInput) {
  const shorthandValue = longInput;
  namedLoop: for (let longIndex = 0; longIndex < longInput; longIndex++) { break namedLoop; }
  return { shorthandValue };
}
class Panel { #privateValue = 2; getValue(longInput) { return this.#privateValue + longInput; } }`;
  const renamed = await renameJavaScriptIdentifiers(source);
  assert.ok(renamed.length < source.length);
  for (const name of ['topLevelValue', 'exposedHandler', 'shorthandValue', 'namedLoop', 'Panel', '#privateValue', 'getValue']) {
    assert.ok(renamed.includes(name), name);
  }
});

test('supports reserved names and never introduces dollar-bearing names', async () => {
  const source = 'function run(keepThisName, renameThisName, $Input$) { return keepThisName + renameThisName + $Input$; }';
  const renamed = await renameJavaScriptIdentifiers(source, { reservedNames: ['keepThisName'] });
  assert.ok(renamed.includes('keepThisName'));
  assert.ok(!renamed.includes('renameThisName'));
  assert.ok(renamed.includes('$Input$'));
  const params = Array.from({ length: 80 }, (_, i) => `descriptiveParameter${i}`);
  const many = await renameJavaScriptIdentifiers(`function run(${params}) { return [${params}]; }`);
  assert.equal(many.includes('$'), false);
  assert.equal(parse(many, { ecmaVersion: 'latest' }).body[0].params.length, 80);
});

test('does not enlarge scripts that already use short names', async () => {
  const source = 'function run(a, b) { return a + b; }';
  assert.equal(await renameJavaScriptIdentifiers(source), source);
});

test('preserves quoted object keys while still shortening local bindings', async () => {
  const source = 'function run(longValue) { return {"publicKey": longValue, plainKey: longValue}; }';
  const renamed = await renameJavaScriptIdentifiers(source);
  assert.ok(renamed.length < source.length);
  assert.ok(renamed.includes('"publicKey":'));
  assert.ok(renamed.includes('plainKey:'));
  assert.equal(vm.runInNewContext(`${renamed}; JSON.stringify(run(3));`),
    vm.runInNewContext(`${source}; JSON.stringify(run(3));`));
});

test('falls back to the input if the mangler printer changes syntax beyond identifiers', async () => {
  // Terser prints this overflowing literal as an Infinity identifier even with
  // compression disabled. Applying only part of that AST diff is unsafe.
  const source = 'function run(longValue) { return 1e999 + longValue; }';
  assert.equal(await renameJavaScriptIdentifiers(source), source);
});

test('renaming is deterministic and does not share mutable name mappings between builds', async () => {
  const source = 'function run(longValue) { const longResult = longValue + 1; return longResult; }';
  const first = await renameJavaScriptIdentifiers(source);
  await renameJavaScriptIdentifiers('function unrelated(otherValue) { return otherValue; }');
  assert.equal(await renameJavaScriptIdentifiers(source), first);
});

async function fixture(t, script, build, extra = {}) {
  const project = await mkdtemp(path.join(os.tmpdir(), 'fuderation-rename-test-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  await mkdir(path.join(project, 'src'));
  const files = {
    'meta.json': JSON.stringify({ name: 'RenameTest', build }),
    'markup.html': '<div data-status>$Text$</div>',
    'styles.css': '[data-status] { color: red; }',
    'script.js': script,
    ...extra,
  };
  for (const [name, contents] of Object.entries(files)) await writeFile(path.join(project, 'src', name), contents);
  return project;
}

test('assembly leaves DSL scripts on comment stripping only', async (t) => {
  const project = await fixture(t, String.raw`// Strip this
setText('[data-status]', '$Text$');
changeMsg('<\$Panel\$><Text>Hi</Text></\$Panel\$>');`);
  const component = await assembleComponent(project);
  assert.equal(component.script, String.raw`setText('[data-status]', '$Text$');
changeMsg('<\$Panel\$><Text>Hi</Text></\$Panel\$>');`);
  assert.equal(analyseMode(component).mode, 'dsl');
});

test('assembly renames iframe locals and validates the shortened output', async (t) => {
  const script = '/* header */\n(() => {})();\nfunction run(descriptiveMessage) { setText("[data-status]", descriptiveMessage); }';
  const project = await fixture(t, script);
  const component = await assembleComponent(project);
  assert.ok(component.script.startsWith('(() => {})();'));
  assert.ok(!component.script.includes('descriptiveMessage'));
  assert.ok(!component.script.includes('header'));
  assert.equal(analyseMode(component).mode, 'iframe');
  assert.deepEqual(validate(component), []);
  assert.equal(component.html, '<div data-status>$Text$</div>');
  assert.equal(component.css, '[data-status] { color: red; }');
  assert.equal(await readFile(path.join(project, 'src/script.js'), 'utf8'), script);
  assert.equal(Object.hasOwn(component, 'build'), false);
});

test('assembly supports disabling renaming and reserving selected local names', async (t) => {
  const script = '/* header */\nfunction run(keepThisName, shortenThisName) { return keepThisName + shortenThisName; }';
  const disabled = await assembleComponent(await fixture(t, script, { renameIdentifiers: false }));
  assert.equal(disabled.script, script.slice(script.indexOf('function')));
  const reserved = await assembleComponent(await fixture(t, script, { reservedNames: ['keepThisName'] }));
  assert.ok(reserved.script.includes('keepThisName'));
  assert.ok(!reserved.script.includes('shortenThisName'));
});

test('build settings reject invalid types with actionable field names', () => {
  assert.deepEqual(readRenameOptions(), { renameIdentifiers: true, reservedNames: [] });
  assert.throws(() => readRenameOptions(null), /"build" must be an object/);
  assert.throws(() => readRenameOptions({ renameIdentifiers: 'false' }), /build.renameIdentifiers/);
  assert.throws(() => readRenameOptions({ reservedNames: 'handler' }), /build.reservedNames/);
  assert.throws(() => readRenameOptions({ reservedNames: [null] }), /build.reservedNames/);
});
