#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleComponent, analyseMode, validate, toEnvelope, LIMITS } from '../../../../scripts/build.mjs';

export const DIAGNOSTICS = ['dsl', 'dsl-guard', 'iframe', 'iframe-data'].map((id) => ({
  id,
  mode: id.startsWith('iframe') ? 'iframe' : 'dsl',
  directory: fileURLToPath(new URL(`../assets/diagnostics/${id}/`, import.meta.url)),
}));

export async function assembleDiagnostics() {
  return Promise.all(DIAGNOSTICS.map(async (fixture) => {
    const component = await assembleComponent(fixture.directory);
    const errors = validate(component);
    const { mode } = analyseMode(component);
    if (mode !== fixture.mode) errors.push(`expected ${fixture.mode}, received ${mode}`);
    if (!component.ai_prompt) errors.push('diagnostic invocation instructions are missing');
    if (mode === 'dsl') {
      if (component.css.length > LIMITS.dslCss) errors.push('DSL CSS exceeds the runtime limit');
      // Count before the interpreter truncates to 32 statements.
      const calls = component.script.split(/[\r\n;]+/).filter((line) => line.trim());
      if (calls.length > LIMITS.dslCalls) errors.push('DSL calls exceed the runtime limit');
    }
    if (errors.length) throw new Error(`${fixture.id}: ${errors.join('; ')}`);
    return { ...fixture, component };
  }));
}

async function main() {
  for (const { component, directory, mode } of await assembleDiagnostics()) {
    const output = path.join(directory, 'component.json');
    await writeFile(output, JSON.stringify(toEnvelope(component), null, 2) + '\n');
    const size = component.html.length + component.css.length + component.script.length;
    console.log(`${component.name}: ${mode}, ${size}/${LIMITS.source} chars → ${output}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
