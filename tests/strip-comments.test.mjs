import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { stripHtmlComments, stripCssComments, stripJavaScriptComments } from '../scripts/strip-comments.mjs';
import { assembleComponent, analyseMode, validate } from '../scripts/build.mjs';

test('JavaScript removes comments while preserving DSL calls and literal spellings', () => {
  const code = String.raw`// const document. => must not force iframe mode
setText('[data-out]', '$Text$'); // explanation
/* another call */
toast('欢迎 https://example.com/a/*b*/', 'success');
changeMsg('<\$Panel\$><Text>Hi</Text></\$Panel\$>');`;
  const stripped = stripJavaScriptComments(code);
  assert.equal(stripped, String.raw`
setText('[data-out]', '$Text$'); 

toast('欢迎 https://example.com/a/*b*/', 'success');
changeMsg('<\$Panel\$><Text>Hi</Text></\$Panel\$>');`);
  assert.equal(analyseMode({ html: '<div/>', css: '', script: stripped }).mode, 'dsl');
  const calls = [];
  vm.runInNewContext(stripped, {
    setText: (...args) => calls.push(['setText', ...args]),
    toast: (...args) => calls.push(['toast', ...args]),
    changeMsg: (...args) => calls.push(['changeMsg', ...args]),
  });
  assert.equal(calls.length, 3);
  assert.equal(calls[1][1], '欢迎 https://example.com/a/*b*/');
  assert.equal(calls[2][1], '<$Panel$><Text>Hi</Text></$Panel$>');
});

for (const source of [
  String.raw`const url = 'https://example.com/*literal*/'; // remove
    const regex = /https?:\/\/[^/]+\/\*literal\*\//;
    regex.test(url);`,
  'let result = 12 / /* divisor */ 3; result;',
  'function read() { return/* newline\n*/42; } read();',
  'function read() { return/* newline\r\n*/42; } read();',
  'function read() { return/* newline\u2028*/42; } read();',
  'function read() { return/* newline\u2029*/42; } read();',
  'function read() { return/* separator */42; } read();',
  'let count = 2; count +/* not increment */+count;',
  'let count = 2; count -/* not decrement */-count;',
  '`/* literal */ ${1 + /* actual comment */ 2} // literal`;',
  'let count = 1; if (count) /[/]\\*/.test("/*"); // remove',
  '#!/usr/bin/env node\n/* header */\n42 // tail',
]) {
  test(`JavaScript retains execution semantics: ${JSON.stringify(source)}`, () => {
    const stripped = stripJavaScriptComments(source);
    assert.equal(vm.runInNewContext(stripped), vm.runInNewContext(source));
    assert.equal(stripJavaScriptComments(stripped), stripped);
  });
}

test('JavaScript keeps an explicit iframe no-op and descriptive variable names', () => {
  const source = '(() => {})(); /* marker */\nconst descriptiveName = "/* literal */";';
  const stripped = stripJavaScriptComments(source);
  assert.ok(stripped.includes('(() => {})();'));
  assert.ok(stripped.includes('descriptiveName'));
  assert.equal(analyseMode({ html: '<div/>', css: '', script: stripped }).mode, 'iframe');
});

test('CSS removes comments without rewriting strings, URLs, selectors or placeholders', () => {
  const source = String.raw`/* header */
.card/* note */.active {
  color: $Color$; /* theme */
  content: "/* literal */ https://example.com";
  background: url(https://example.com/a/*literal*/b);
  --message: '/* literal */';
}`;
  assert.equal(stripCssComments(source), String.raw`
.card.active {
  color: $Color$; 
  content: "/* literal */ https://example.com";
  background: url(https://example.com/a/*literal*/b);
  --message: '/* literal */';
}`);
});

test('CSS retains only required empty separators instead of merging tokens or adding combinators', () => {
  const source = '/* header */div/* type boundary */span { --x: 1/* unit */px; color:/* safe */red; }';
  const stripped = stripCssComments(source);
  assert.equal(stripped, 'div/**/span { --x: 1/**/px; color:red; }');
  assert.equal(stripCssComments(stripped), stripped);
});

test('CSS preserves whitespace, escapes and adjacent comment boundaries', () => {
  for (const [source, expected] of [
    ['a { color: /* one */ /* two */ red; }', 'a { color:   red; }'],
    ['a { --x: 1/* one *//* two */px; }', 'a { --x: 1/**/px; }'],
    [String.raw`a { --x: \31/* boundary */ a; }`, String.raw`a { --x: \31/**/ a; }`],
  ]) assert.equal(stripCssComments(source), expected);
});

test('HTML removes comments in documents and templates without reserializing markup', async () => {
  const source = '<!DOCTYPE html>\n<!-- header --><HTML><body>\n' +
    '<DIV data-note="<!-- literal -->">$Title$ &amp; 欢迎<!-- note -->!</DIV>\n' +
    '<template><!-- inside --><span>value</span></template></body></HTML><!-- tail -->';
  assert.equal(await stripHtmlComments(source), '<!DOCTYPE html>\n<HTML><body>\n' +
    '<DIV data-note="<!-- literal -->">$Title$ &amp; 欢迎!</DIV>\n' +
    '<template><span>value</span></template></body></HTML>');
});

test('HTML leaves raw text, embedded languages and SVG CDATA intact', async () => {
  const source = '<!-- remove --><script>const x = "<!-- literal -->"; /* JS */</script>' +
    '<style>.x { content: "<!-- literal -->"; /* CSS */ }</style>' +
    '<textarea><!-- literal --></textarea><pre>&lt;!-- literal --&gt;</pre>' +
    '<svg><![CDATA[<!-- literal -->]]></svg>';
  assert.equal(await stripHtmlComments(source), source.replace('<!-- remove -->', ''));
});

test('HTML comment removal does not form new entities or markup', async () => {
  const source = '<p>&am<!-- entity -->p; <<!-- tag -->b></p><!-- removable -->';
  const stripped = await stripHtmlComments(source);
  assert.equal(stripped, '<p>&am<!---->p; <<!---->b></p>');
  assert.equal(await stripHtmlComments(stripped), stripped);
});

async function fixture(t, files) {
  const project = await mkdtemp(path.join(os.tmpdir(), 'fuderation-strip-test-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  await mkdir(path.join(project, 'src'));
  const sources = { 'meta.json': '{"name":"StripTest"}', 'markup.html': '<div>$Text$</div>', ...files };
  await Promise.all(Object.entries(sources).map(([name, content]) =>
    writeFile(path.join(project, 'src', name), content)));
  return project;
}

test('assembly strips before limits and mode analysis, leaving the AI prompt unchanged', async (t) => {
  const project = await fixture(t, {
    'markup.html': `<!-- ${'padding'.repeat(3000)} --><div>$Text$</div>`,
    'styles.css': `/* ${'padding'.repeat(160)} */div { color: red; }`,
    'script.js': '// const document. should disappear\n/* no executable code */',
    'ai_prompt.md': '  <!-- prompt content, not code -->  ',
  });
  const component = await assembleComponent(project);
  assert.equal(component.html, '<div>$Text$</div>');
  assert.equal(component.css, 'div { color: red; }');
  assert.equal(component.script, '');
  assert.equal(component.ai_prompt, '<!-- prompt content, not code -->');
  assert.deepEqual(validate(component), []);
  assert.equal(analyseMode(component).mode, 'dsl');
});

test('assembly retains explicit iframe mode after stripping', async (t) => {
  const project = await fixture(t, { 'script.js': '/* header */\n(() => {})();' });
  const component = await assembleComponent(project);
  assert.equal(component.script, '(() => {})();');
  assert.equal(analyseMode(component).mode, 'iframe');
});

test('TypeScript still compiles and minifies using the existing iframe path', async (t) => {
  const project = await fixture(t, {
    'script.ts': '/*! header */ const message: string = "ready"; document.body.textContent = message;',
  });
  const component = await assembleComponent(project);
  assert.ok(!component.script.includes('header'));
  assert.equal(analyseMode(component).mode, 'iframe');
  const document = { body: {} };
  vm.runInNewContext(component.script, { document });
  assert.equal(document.body.textContent, 'ready');
});

test('comment-only HTML fails existing empty-markup validation', async (t) => {
  const project = await fixture(t, { 'markup.html': '<!-- no markup -->' });
  assert.ok(validate(await assembleComponent(project)).some((error) => error.includes('markup.html is empty')));
});

test('malformed JavaScript reports its source file instead of stripping guessed ranges', async (t) => {
  const project = await fixture(t, { 'script.js': 'toast("unterminated); // note' });
  await assert.rejects(assembleComponent(project), /src\/script\.js: Unterminated string/);
});
