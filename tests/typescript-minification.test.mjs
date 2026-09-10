import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assembleComponent, analyseMode, validate } from '../scripts/build.mjs';
import { renderIframe } from '../.agents/skills/fuderation-component-builder/tests/runtime-harness.mjs';

async function fixture(t, script) {
  const project = await mkdtemp(path.join(os.tmpdir(), 'fuderation-typescript-test-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  await mkdir(path.join(project, 'src'));
  const files = {
    // These options only apply to JavaScript; TypeScript must still minify safely.
    'meta.json': JSON.stringify({ name: 'TypeScriptTest', build: { renameIdentifiers: false } }),
    'markup.html': '<div id="result"></div>',
    'script.ts': script,
  };
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(project, 'src', name), content);
  }
  return assembleComponent(project);
}

test('TypeScript minification never generates dollar identifiers, even after exhausting single letters', async (t) => {
  const names = Array.from({ length: 160 }, (_, i) => `descriptiveParameter${i}`);
  const values = names.map((_, i) => i);
  const component = await fixture(t, `
    function summarize(${names.map((name) => `${name}: number`).join(',')}) {
      return [${names}].join(',');
    }
    document.querySelector('#result')!.textContent = summarize(${values});
  `);
  assert.equal(component.script.includes('$'), false);
  assert.equal(component.script.includes('descriptiveParameter'), false, 'identifiers are still minified');
  assert.equal(analyseMode(component).mode, 'iframe');
  assert.deepEqual(validate(component), []);
  const { window } = renderIframe(t, component);
  assert.equal(window.document.querySelector('#result').textContent, values.join(','));
});

test('TypeScript mangling preserves scopes, properties, Unicode, placeholders and inline script safety', async (t) => {
  const component = await fixture(t, `
    const a = document.querySelector('#result')!;
    function outer(descriptiveValue: string) {
      const descriptiveObject = { descriptiveValue };
      return (descriptiveValue: string) => descriptiveObject.descriptiveValue + descriptiveValue;
    }
    setText('#result', outer('欢迎')('你好') + ' | $Missing$ | $5 | </script>');
    a.setAttribute('data-result', 'done');
  `);
  assert.ok(component.script.includes('欢迎'), 'Unicode is not expanded into escapes');
  assert.ok(component.script.includes('$Missing$'), 'placeholder remains available to the runtime');
  assert.ok(!component.script.includes('</script>'), 'literal cannot terminate the inline script');
  const { window } = renderIframe(t, component);
  const result = window.document.querySelector('#result');
  assert.equal(result.textContent, '欢迎你好 |  | $5 | </script>');
  assert.equal(result.dataset.result, 'done');
});
