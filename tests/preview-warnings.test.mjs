import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { parse } from 'acorn';

const root = path.resolve(import.meta.dirname, '..');
const previewDir = path.join(root, 'tools/preview');
const bundle = build({
  entryPoints: [path.join(previewDir, 'main.js')],
  bundle: true, format: 'iife', platform: 'browser', write: false,
  plugins: [{ name: 'runtime-shims', setup(builder) {
    builder.onResolve({ filter: /purify\.es-[\w-]+\.js$/ }, () => ({ path: path.join(previewDir, 'shims/purify.js') }));
    builder.onResolve({ filter: /fontAwesomeLoader-[\w-]+\.js$/ }, () => ({ path: path.join(previewDir, 'shims/escape.js') }));
  } }],
});
const component = (script) => ({ name: 'PreviewProbe', html: '<button data-result>NOT RUN</button>', css: '', script });
const calls = (count) => Array.from({ length: count }, (_, i) => `setText('[data-result]', '${i + 1}')`).join('\n');

async function preview(t) {
  const dom = new JSDOM(await readFile(path.join(previewDir, 'index.html'), 'utf8'), {
    url: 'http://localhost/', runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  dom.window.fetch = async () => ({ json: async () => ({ component: component('') }) });
  dom.window.eval((await bundle).outputFiles[0].text);
  await new Promise(setImmediate);
  return dom.window;
}

test('preview warns about damaged regex and mounts the actual stripped script', async (t) => {
  const win = await preview(t);
  const source = String.raw`const pattern = /\/\*literal\*\//;
window.started = true;`;
  assert.doesNotThrow(() => parse(source, { ecmaVersion: 'latest' }));
  win.__preview.setComponent(component(source));
  assert.match(win.document.querySelector('[data-warnings]').textContent, /Workshop.*正则/);
  const frame = win.document.querySelector('[data-bubble] iframe');
  assert.ok(frame, 'native script uses an iframe');
  const doc = new JSDOM(frame.srcdoc);
  t.after(() => doc.window.close());
  const script = [...doc.window.document.scripts].find((node) => node.textContent.includes('window.started'));
  assert.ok(script, 'authored script is present in srcdoc');
  assert.throws(() => parse(script.textContent, { ecmaVersion: 'latest' }), /Unterminated regular expression/);

  win.__preview.setComponent(component(String.raw`const pattern = new RegExp('/\\*literal\\*/');`));
  assert.doesNotMatch(win.document.querySelector('[data-warnings]').textContent, /Workshop/);
});

test('preview displays the DSL execution warning and button input executes only 12 calls', async (t) => {
  const win = await preview(t);
  win.__preview.setComponent(component(calls(13)));
  assert.match(win.document.querySelector('[data-warnings]').textContent, /12/);
  assert.match(win.document.querySelector('[data-mode]').textContent, /DSL/);
  win.document.querySelector('[data-bubble] button').click();
  await new Promise(setImmediate);
  assert.equal(win.document.querySelector('[data-bubble] [data-result]').textContent, '12');
  assert.match(win.document.querySelector('[data-log]').textContent, /执行 12 条调用/);
  win.__preview.setComponent(component(calls(12)));
  assert.doesNotMatch(win.document.querySelector('[data-warnings]').textContent, /12/);
});

test('build CLI emits the execution warning after producing an importable artifact', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fcb-build-warning-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'src'));
  await writeFile(path.join(dir, 'src/markup.html'), '<button data-result>NOT RUN</button>');
  await writeFile(path.join(dir, 'src/script.js'), calls(13));
  const { stdout, stderr } = await promisify(execFile)(process.execPath, [path.join(root, 'scripts/build.mjs'), dir]);
  assert.match(stdout, /✓.*dsl mode/);
  assert.match(stderr, /13 statements.*only the first 12/);
  const output = JSON.parse(await readFile(path.join(dir, 'component.json'), 'utf8'));
  assert.match(output.component.script, /'13'/, 'build preserves source while warning about runtime truncation');
});
