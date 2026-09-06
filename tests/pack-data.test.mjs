import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import vm from 'node:vm';
import test from 'node:test';
import { decode, encode } from 'base32768';
import { transform } from 'esbuild';
import { packBytes } from '../.agents/skills/fuderation-component-builder/scripts/pack-data.mjs';
import { renderIframe } from '../.agents/skills/fuderation-component-builder/tests/runtime-harness.mjs';
import { assembleComponent, analyseMode, validate, toEnvelope } from '../scripts/build.mjs';

const exec = promisify(execFile);
const repository = fileURLToPath(new URL('../', import.meta.url));
const helper = path.join(repository, '.agents/skills/fuderation-component-builder/scripts/pack-data.mjs');

async function fixture(t) {
  // Within the repo so the generated module resolves the installed codec.
  const project = await mkdtemp(path.join(repository, '.packing-test-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  await mkdir(path.join(project, 'src'));
  return project;
}

test('generated modules restore binary and Unicode data across padding boundaries', async () => {
  const inputs = [
    ...Array.from({ length: 65 }, (_, length) => Buffer.from(
      Array.from({ length }, (_, i) => (i * 37 + length) & 255))),
    Buffer.from(Array.from({ length: 256 }, (_, i) => i)),
    Buffer.from('中文 😀 e\u0301 </script> $Param$ \\"\n\u0000'),
  ];
  assert.equal(encode(Buffer.from('hello world')), '媒腻㐤┖ꈳ埳'); // upstream vector
  for (const input of inputs) {
    const packed = packBytes(input);
    assert.equal(packed.packedChars, Math.ceil(input.length * 8 / 15));
    assert.equal(packed.base64Chars, input.toString('base64').length);
    for (const form of ['NFC', 'NFD', 'NFKC', 'NFKD']) {
      assert.equal(packed.source.normalize(form), packed.source);
    }
    const { code } = await transform(packed.source, { loader: 'ts', format: 'cjs', charset: 'utf8' });
    const module = { exports: {} };
    vm.runInNewContext(code, { module, exports: module.exports, require: () => ({ decode }) });
    assert.deepEqual(Buffer.from(module.exports.unpack()), input);
  }
});

test('CLI packs a file, reports payload counts, and refuses to overwrite existing output', async (t) => {
  const project = await fixture(t);
  const input = path.join(project, 'input.bin');
  const output = path.join(project, 'src/data.ts');
  const bytes = Buffer.from([0, 255, 128, 1]);
  await writeFile(input, bytes);
  const { stdout } = await exec(process.execPath, [helper, input, output]);
  assert.match(stdout, /4 bytes → 3 Base32768 chars/);
  assert.match(stdout, /exclude decoder/);
  assert.equal(await readFile(output, 'utf8'), packBytes(bytes).source);
  await assert.rejects(exec(process.execPath, [helper, input, output]), /EEXIST/);
  await assert.rejects(exec(process.execPath, [helper, input, path.join(project, 'data.js')]), /Usage:/);
  assert.deepEqual(await readFile(input), bytes);
});

test('packed data survives TypeScript build, export JSON, and the vendored iframe runtime', async (t) => {
  const project = await fixture(t);
  const input = Buffer.from(Array.from({ length: 12000 }, (_, i) => (i * 73 + 19) & 255));
  const files = {
    'meta.json': JSON.stringify({ name: 'PackedDataTest' }),
    'markup.html': '<pre id="result"></pre>',
    'data.ts': packBytes(input).source,
    'script.ts': "import { unpack } from './data';\n" +
      "document.querySelector('#result')!.textContent = Array.from(unpack()).join(',');\n",
  };
  for (const [name, source] of Object.entries(files)) await writeFile(path.join(project, 'src', name), source);
  await exec(process.execPath, [path.join(repository, 'node_modules/typescript/bin/tsc'),
    '--noEmit', '--strict', '--target', 'es2017', '--module', 'esnext',
    '--moduleResolution', 'bundler', path.join(project, 'src/script.ts')]);
  const built = await assembleComponent(project);
  const component = JSON.parse(JSON.stringify(toEnvelope(built))).component;
  assert.equal(analyseMode(component).mode, 'iframe');
  assert.deepEqual(validate(component), []);
  assert.ok(component.script.includes(encode(input)), 'Unicode payload stays literal after minification');
  assert.ok(component.html.length + component.script.length < input.toString('base64').length,
    'packed component including decoder beats the Base64 payload alone');
  const { window } = renderIframe(t, component);
  assert.equal(window.document.querySelector('#result').textContent, Array.from(input).join(','));
  t.diagnostic(`12,000 bytes: ${component.html.length + component.script.length} total component chars; Base64 payload alone: 16,000`);
});
