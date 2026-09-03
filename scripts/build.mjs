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
//
// Also importable: `assembleComponent()`, `validate()`, `analyseMode()` and
// `LIMITS` are exported so the preview server (scripts/preview.mjs) builds the
// component exactly the way this CLI does, from one source of truth.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = path.resolve(process.argv[2] || process.cwd());

// Platform limits from the Workshop component guide.
const LIMITS = {
  name: 32,
  description: 120,
  aiPrompt: 1000,
  source: 20000, // html + css + script combined
  dslCss: 1000, // DSL mode flattens CSS to inline styles, reading only this much
  dslCalls: 32, // DSL mode parses at most this many bridge calls
};

// Component name charset, matching the runtime's own regex:
//   /<\$\s*([A-Za-z0-9_\-一-龥]{1,32})\s*\$>/
// Note U+9FA5, not U+9FFF — a few rare CJK ideographs are excluded.
const NAME_RE = /^[A-Za-z0-9_\-一-龥]+$/;

// The runtime's advanced-JS detector. A match forces sandboxed iframe mode.
const NATIVE_JS_RE =
  /(?:^|[\s;(])(const|let|var|function|if|for|while|return)\b|=>|document\.|window\.|setInterval\s*\(|setTimeout\s*\(|requestAnimationFrame\s*\(|new\s+Date\s*\(/i;

// A DSL statement: a single whitelisted call, nothing else.
const DSL_CALL_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*\([\s\S]*\)$/;

const BRIDGE_FNS = new Set([
  'fillInput', 'saveToLocal', 'readFromLocal', 'getWorldInfo', 'copyText',
  'toast', 'appendMsg', 'changeMsg', 'tempAppendMsg', 'tempChangeMsg',
  'getMsgContent', 'getUserAvatar', 'getCurrentUserAvatar', 'getCharAvatar',
  'getCurrentCharAvatar', 'openUrl', 'setText', 'setValue', 'show', 'hide',
  'addClass', 'removeClass', 'setStyle', 'progress', 'wait', 'requireInputEquals',
]);

// CSS features that force iframe mode when the component has no script.
// querySelectorAll runs against a detached <template> during flattening: nothing
// stateful can match, and pseudo-elements are not selectable at all.
const CSS_DEAD_PSEUDO_RE =
  /::|:(?:hover|focus(?:-within|-visible)?|active|visited|target|before|after|first-line|first-letter)\b/i;
// These DO match — once, against the markup as it stood at flatten time.
const CSS_STRUCTURAL_PSEUDO_RE =
  /:(?:nth-child|nth-of-type|nth-last-child|nth-last-of-type|first-child|last-child|only-child|first-of-type|last-of-type|only-of-type|not|is|where|has)\b/i;
const CSS_AT_RULE_RE = /@(?:media|supports|keyframes|font-face|layer|container|property)\b/i;
const CSS_GLOBAL_SEL_RE = /(^|[\s,{>+~])(?:html|body|:root)(?=[\s.#:[>+~,{]|$)/i;

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
async function buildScript(esbuild, SRC) {
  const tsPath = path.join(SRC, 'script.ts');
  const jsPath = path.join(SRC, 'script.js');

  if (existsSync(tsPath) && existsSync(jsPath)) {
    throw new Error(
      'Both src/script.ts and src/script.js exist — use one or the other. ' +
        '.ts compiles to iframe mode; .js stays verbatim in DSL mode.',
    );
  }
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
  if (!NAME_RE.test(component.name))
    errs.push('name may only contain letters, digits, "-", "_", or CJK characters (U+4E00–U+9FA5)');
  if (!component.html)
    errs.push('src/markup.html is empty — the importer drops components with no html');
  if (component.description.length > LIMITS.description)
    errs.push(`description is ${component.description.length} chars (max ${LIMITS.description})`);
  if (component.ai_prompt.length > LIMITS.aiPrompt)
    errs.push(`ai_prompt is ${component.ai_prompt.length} chars (max ${LIMITS.aiPrompt})`);
  const combined = component.html.length + component.css.length + component.script.length;
  if (combined > LIMITS.source)
    errs.push(`html+css+script is ${combined} chars (max ${LIMITS.source})`);
  return errs;
}

// Mirror the runtime's mode dispatch so the build can warn about the footguns
// that mode selection creates. See RUNTIME_INTERNALS.md §1–§3.
function analyseMode(component) {
  const { html, css, script } = component;
  const warnings = [];

  let mode;
  let reason;

  const statements = script
    ? script
        .split(/[\r\n;]+/)
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('//'))
    : [];

  if (script) {
    const considered = statements.slice(0, LIMITS.dslCalls);
    const badCall = considered.find((s) => {
      const m = s.match(DSL_CALL_RE);
      return !m || !BRIDGE_FNS.has(m[1]);
    });

    if (NATIVE_JS_RE.test(script)) {
      mode = 'iframe';
      reason = 'script contains native JS';
    } else if (badCall) {
      mode = 'iframe';
      reason = `script has a non-DSL statement (${badCall.slice(0, 40)}…)`;
    } else {
      // Se() slices to the first `dslCalls` statements *before* validating, so a
      // longer all-whitelisted script still validates and stays in DSL mode.
      mode = 'dsl';
      reason = `${statements.length} whitelisted bridge call(s)`;
    }
  } else if (/<\s*(html|head|body)\b/i.test(html)) {
    mode = 'iframe';
    reason = 'markup contains a full-document tag';
  } else if (css.length > LIMITS.dslCss) {
    mode = 'iframe';
    reason = `css is ${css.length} chars (> ${LIMITS.dslCss})`;
  } else if (CSS_AT_RULE_RE.test(css)) {
    mode = 'iframe';
    reason = 'css contains an at-rule';
  } else if (CSS_GLOBAL_SEL_RE.test(css)) {
    mode = 'iframe';
    reason = 'css targets html/body/:root';
  } else {
    mode = 'dsl';
    reason = 'no script, plain css';
  }

  if (mode === 'dsl') {
    if (css.length > LIMITS.dslCss) {
      warnings.push(
        `DSL mode reads only the first ${LIMITS.dslCss} chars of css — ` +
          `${css.length - LIMITS.dslCss} chars will be silently dropped.`,
      );
    }
    if (CSS_AT_RULE_RE.test(css)) {
      warnings.push('DSL mode skips @-rules — @media/@keyframes/@font-face will not apply.');
    }
    if (CSS_DEAD_PSEUDO_RE.test(css)) {
      warnings.push(
        'DSL mode flattens css to inline styles — state pseudo-classes (:hover/:focus/:active) ' +
          'and pseudo-elements (::before …) never apply.',
      );
    }
    if (CSS_STRUCTURAL_PSEUDO_RE.test(css)) {
      warnings.push(
        'Structural selectors (:nth-child …) are matched ONCE against the initial markup when ' +
          'the css is flattened; later DOM changes will not re-apply them.',
      );
    }
    if (script) {
      warnings.push('DSL scripts run on CLICK, not on mount. Use src/script.ts to run on render.');
    }
    if (statements.length > LIMITS.dslCalls) {
      warnings.push(
        `script has ${statements.length} statements but DSL validation inspects only the first ` +
          `${LIMITS.dslCalls}. Whether the rest execute cannot be confirmed from the reachable ` +
          'runtime code — do not rely on it.',
      );
    }
  }

  if (mode === 'iframe' && /\bopenUrl\s*\(/.test(script)) {
    warnings.push('openUrl() is undefined in iframe mode — it will throw a ReferenceError.');
  }

  return { mode, reason, warnings };
}

// Read src/ and produce the component object. Does not validate or write.
export async function assembleComponent(projectDir = PROJECT) {
  const SRC = path.join(projectDir, 'src');
  if (!existsSync(SRC)) throw new Error(`No src/ directory at ${SRC}.`);

  const esbuild = await loadEsbuild();
  const metaRaw = await readIf(path.join(SRC, 'meta.json'));
  const meta = metaRaw ? JSON.parse(metaRaw) : {};

  return {
    name: meta.name || path.basename(projectDir),
    html: (await readIf(path.join(SRC, 'markup.html'))).trim(),
    css: (await readIf(path.join(SRC, 'styles.css'))).trim(),
    script: await buildScript(esbuild, SRC),
    source: '',
    ai_prompt: (await readIf(path.join(SRC, 'ai_prompt.md'))).trim(),
    description: meta.description || '',
  };
}

export function toEnvelope(component) {
  return {
    type: 'fuderation_story_component',
    version: 1,
    exported_at: '',
    creator: { username: '', display_id: 0 },
    component,
  };
}

export { validate, analyseMode, LIMITS };

async function main() {
  const OUT = path.join(PROJECT, 'component.json');

  const esbuild = await loadEsbuild();
  if (!esbuild) {
    console.warn('! esbuild not installed — TypeScript sources cannot be compiled. Run: npm install\n');
  }

  const component = await assembleComponent(PROJECT);

  const errs = validate(component);
  if (errs.length) {
    console.error(`✗ ${component.name}`);
    for (const e of errs) console.error(`    - ${e}`);
    process.exit(1);
  }

  await writeFile(OUT, JSON.stringify(toEnvelope(component), null, 2) + '\n', 'utf8');

  const total = component.html.length + component.css.length + component.script.length;
  const { mode, reason, warnings } = analyseMode(component);
  console.log(
    `✓ ${component.name} → ${path.relative(process.cwd(), OUT)}  ` +
      `(${total}/${LIMITS.source} chars, ${mode} mode: ${reason})`,
  );
  if (!component.ai_prompt) {
    warnings.push('ai_prompt is empty — the AI is never told this component exists.');
  }
  for (const w of warnings) console.warn(`    ! ${w}`);
}

// Only run the CLI when invoked directly, not when imported by the preview server.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
