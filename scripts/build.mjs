#!/usr/bin/env node
// Build this Fuderation Workshop component: ./src -> ./component.json
//
// This repo is a one-component-per-repo template. The build output is the exact
// importable export envelope (type "fuderation_story_component", version 1).
//
//   src/markup.html   -> component.html
//   src/styles.css    -> component.css
//   src/script.ts     -> component.script  (compiled with esbuild; runs in iframe mode)
//   src/script.js     -> component.script  (passed through verbatim; keeps DSL mode)
//   src/ai_prompt.md  -> component.ai_prompt
//   src/meta.json     -> component.name / component.description
//
// Usage: node scripts/build.mjs [projectDir]   (default: cwd)

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const PROJECT = path.resolve(process.argv[2] || process.cwd());
const SRC = path.join(PROJECT, 'src');
const OUT = path.join(PROJECT, 'component.json');

// Platform limits from the Workshop component guide.
const LIMITS = {
  name: 32,
  description: 120,
  aiPrompt: 1000,
  source: 20000, // html + css + script combined
};

async function loadEsbuild() {
  try {
    return await import('esbuild');
  } catch {
    return null;
  }
}

async function readIf(p) {
  return existsSync(p) ? (await readFile(p, 'utf8')) : '';
}

// .ts -> compiled, minified IIFE (classic inline script, no ESM import/export).
// Compiled output always trips the runtime's advanced-JS detector -> iframe mode.
// .js -> verbatim, so simple `fn('a','b')` DSL scripts keep lightweight DSL mode.
async function buildScript(esbuild) {
  const tsPath = path.join(SRC, 'script.ts');
  const jsPath = path.join(SRC, 'script.js');

  if (existsSync(tsPath)) {
    if (!esbuild) {
      throw new Error('src/script.ts requires esbuild to compile. Run: npm install');
    }
    const result = await esbuild.build({
      entryPoints: [tsPath],
      bundle: true,
      format: 'iife',
      target: 'es2017',
      minify: true,
      platform: 'browser',
      write: false,
      legalComments: 'none',
    });
    return result.outputFiles[0].text.trim();
  }
  if (existsSync(jsPath)) {
    return (await readFile(jsPath, 'utf8')).trim();
  }
  return '';
}

function validate(component) {
  const errs = [];
  if (!component.name) errs.push('meta.json "name" is required');
  if (component.name.length > LIMITS.name)
    errs.push(`name is ${component.name.length} chars (max ${LIMITS.name})`);
  if (!/^[A-Za-z0-9_\-一-鿿]+$/.test(component.name))
    errs.push('name may only contain letters, digits, "-", "_", or CJK characters');
  if (component.description.length > LIMITS.description)
    errs.push(`description is ${component.description.length} chars (max ${LIMITS.description})`);
  if (component.ai_prompt.length > LIMITS.aiPrompt)
    errs.push(`ai_prompt is ${component.ai_prompt.length} chars (max ${LIMITS.aiPrompt})`);
  const combined = component.html.length + component.css.length + component.script.length;
  if (combined > LIMITS.source)
    errs.push(`html+css+script is ${combined} chars (max ${LIMITS.source})`);
  return errs;
}

async function main() {
  if (!existsSync(SRC)) {
    console.error(`No src/ directory at ${SRC}.`);
    process.exit(1);
  }

  const esbuild = await loadEsbuild();
  if (!esbuild) {
    console.warn('! esbuild not installed — TypeScript sources cannot be compiled. Run: npm install\n');
  }

  const metaRaw = await readIf(path.join(SRC, 'meta.json'));
  const meta = metaRaw ? JSON.parse(metaRaw) : {};

  const component = {
    name: meta.name || path.basename(PROJECT),
    html: (await readIf(path.join(SRC, 'markup.html'))).trim(),
    css: (await readIf(path.join(SRC, 'styles.css'))).trim(),
    script: await buildScript(esbuild),
    source: '',
    ai_prompt: (await readIf(path.join(SRC, 'ai_prompt.md'))).trim(),
    description: meta.description || '',
  };

  const errs = validate(component);
  if (errs.length) {
    console.error(`✗ ${component.name}`);
    for (const e of errs) console.error(`    - ${e}`);
    process.exit(1);
  }

  const envelope = {
    type: 'fuderation_story_component',
    version: 1,
    exported_at: '',
    creator: { username: '', display_id: 0 },
    component,
  };

  await writeFile(OUT, JSON.stringify(envelope, null, 2) + '\n', 'utf8');

  const total = component.html.length + component.css.length + component.script.length;
  console.log(`✓ ${component.name} → ${path.relative(process.cwd(), OUT)}  (${total}/${LIMITS.source} chars)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
