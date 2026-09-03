#!/usr/bin/env node
// Fetch (or re-verify) the vendored Fuderation component runtime.
//
//   node scripts/vendor-runtime.mjs           # verify vendor/ against the lockfile
//   node scripts/vendor-runtime.mjs --update  # re-resolve from the live site and rewrite the lockfile
//
// The runtime chunk is content-hashed and its name rotates on every site
// rebuild, so the lockfile records the resolved URL plus a SHA-256 of the exact
// bytes we vendored. A hash change is also the signal that
// .agents/skills/fuderation-component-builder/RUNTIME_INTERNALS.md may be stale.

import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = path.join(ROOT, 'vendor');
const LOCK = path.join(VENDOR, 'runtime.lock.json');
const ORIGIN = 'https://chat.fuderation.com';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const FETCH_TIMEOUT_MS = 30_000;

async function get(url) {
  // Without a signal, a response whose body never completes leaves `--update`
  // hanging forever.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`GET ${url} timed out after ${FETCH_TIMEOUT_MS}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// The SPA shell preloads an index-*.js manifest which names every lazy chunk.
async function resolveRuntimeUrl() {
  const shell = (await get(`${ORIGIN}/`)).toString('utf8');
  const indexes = [...shell.matchAll(/\/assets\/index-[A-Za-z0-9_-]+\.js/g)].map((m) => m[0]);
  if (!indexes.length) throw new Error('could not find an index-*.js chunk in the app shell');

  for (const idx of [...new Set(indexes)]) {
    const manifest = (await get(`${ORIGIN}${idx}`)).toString('utf8');
    const hit = manifest.match(/storyComponents-[A-Za-z0-9_-]+\.js/);
    if (hit) return { url: `${ORIGIN}/assets/${hit[0]}`, via: idx };
  }
  throw new Error('no storyComponents-*.js reference found in any index chunk');
}

// ── markdown sanitiser ───────────────────────────────────────────────────────
// Chat prose is NOT rendered raw. useMarkdown runs a two-stage pipeline:
//   1. DOMPurify.sanitize(html, config) — a permissive allowlist that keeps
//      onclick/onerror/ontoggle via ADD_ATTR, unlike the component sanitiser;
//   2. a regex pass that then strips those handlers again unless they match one
//      of ~12 site-provided callbacks (window.copyCodeBlock(this) and friends),
//      keeps onerror only when it contains `this.onerror = null`, and removes a
//      fixed list of other handlers unconditionally.
// Stage 2 is why stage 1 looks so lax. Reproducing only one of them gives a
// preview that is wrong in one direction or the other, so both are extracted.

async function resolveMarkdownUrl() {
  const shell = (await get(`${ORIGIN}/`)).toString('utf8');
  const indexes = [...shell.matchAll(/\/assets\/index-[A-Za-z0-9_-]+\.js/g)].map((m) => m[0]);
  for (const idx of [...new Set(indexes)]) {
    const manifest = (await get(`${ORIGIN}${idx}`)).toString('utf8');
    const hit = manifest.match(/useMarkdown-[A-Za-z0-9_-]+\.js/);
    if (hit) return { url: `${ORIGIN}/assets/${hit[0]}`, via: idx };
  }
  throw new Error('no useMarkdown-*.js reference found in any index chunk');
}

/** Pull the DOMPurify config object literal out of the minified chunk. */
function extractSanitizeConfig(js) {
  const start = js.indexOf('{ALLOWED_TAGS:');
  if (start < 0) throw new Error('markdown sanitiser config not found (ALLOWED_TAGS)');
  let depth = 0;
  let end = start;
  for (; end < js.length; end += 1) {
    if (js[end] === '{') depth += 1;
    else if (js[end] === '}' && --depth === 0) break;
  }
  const literal = js.slice(start, end + 1);

  const list = (key) => {
    const m = literal.match(new RegExp(`${key}:\\[([^\\]]*)\\]`));
    return m ? [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]) : [];
  };
  const uri = literal.match(/ALLOWED_URI_REGEXP:\/((?:[^/\\]|\\.)+)\//);

  return {
    ALLOWED_TAGS: list('ALLOWED_TAGS'),
    ALLOWED_ATTR: list('ALLOWED_ATTR'),
    ADD_ATTR: list('ADD_ATTR'),
    ALLOW_DATA_ATTR: /ALLOW_DATA_ATTR:!?0|ALLOW_DATA_ATTR:(?:true|!0)/.test(literal)
      ? !/ALLOW_DATA_ATTR:(?:false|!1)/.test(literal)
      : true,
    ALLOWED_URI_REGEXP: uri ? uri[1] : null,
  };
}

/** Pull stage 2 — the event-handler whitelist and the blanket strip list. */
function extractHandlerRules(js) {
  const m = js.match(/function \w+\(\w+\)\{const \w+=\[(\/[\s\S]*?)\];return/);
  if (!m) throw new Error('markdown handler post-pass not found');
  const allow = [...m[1].matchAll(/\/((?:[^/\\]|\\.)+)\/i/g)].map((x) => x[1]);

  const body = js.slice(js.indexOf(m[0]), js.indexOf(m[0]) + 2000);
  const onerror = body.match(/onerror[\s\S]{0,120}?\/((?:[^/\\]|\\.)*onerror[^/\\]*)\//);
  const blanket = body.match(/on\(\?:((?:load|[a-z|]+)+)\)/);

  if (!allow.length) throw new Error('markdown handler whitelist came back empty');
  if (!blanket) throw new Error('markdown blanket handler strip list not found');

  return {
    onclickAllow: allow,
    onerrorAllow: onerror ? onerror[1] : 'this\\.onerror\\s*=\\s*null',
    alwaysStrip: blanket[1].split('|'),
  };
}

// ── chat/markdown CSS subset ─────────────────────────────────────────────────
// The app stylesheet is ~490 KB of mostly Tailwind utilities. The preview only
// needs the design tokens, the chat bubble rules and the markdown-body rules, so
// we extract those rather than vendoring the whole thing.

const KEEP_SELECTOR = /(chat-msg|chat-bubble|chat-message-row|chat-reply-quote|markdown-body|message-renderer-chunk|story-inline-component)/;
const KEEP_ROOT = /--bg-app|--color-primary-50\b/;

/** Split a CSS string into top-level { selector, block } rules, honouring at-rules. */
function splitRules(css) {
  const rules = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const selector = css.slice(i, open).trim();

    let depth = 0;
    let j = open;
    for (; j < css.length; j += 1) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    rules.push({ selector, body: css.slice(open + 1, j) });
    i = j + 1;
  }
  return rules;
}

function extractChatCss(css) {
  const out = [];

  const walk = (rules, wrap) => {
    for (const { selector, body } of rules) {
      if (selector.startsWith('@media') || selector.startsWith('@supports')) {
        const inner = [];
        walk(splitRules(body), (s, b) => inner.push(`${s}{${b}}`));
        if (inner.length) out.push(`${selector}{${inner.join('')}}`);
        continue;
      }
      if (selector.startsWith('@')) continue;
      // Light theme only — the preview mirrors the site's default appearance.
      if (/(^|[\s,])\.dark(\s|\.|$)/.test(selector)) continue;

      const isRoot = selector.includes(':root') && KEEP_ROOT.test(body);
      if (isRoot || KEEP_SELECTOR.test(selector)) wrap(selector, body);
    }
  };

  walk(splitRules(css), (s, b) => out.push(`${s}{${b}}`));
  return out.join('\n');
}

async function resolveCssUrl() {
  const shell = (await get(`${ORIGIN}/`)).toString('utf8');
  const m = shell.match(/\/assets\/main-[A-Za-z0-9_-]+\.css/);
  if (!m) throw new Error('could not find main-*.css in the app shell');
  return `${ORIGIN}${m[0]}`;
}

// Write each [target, contents] pair to a sibling temp file, then rename them
// into place in order. Renames within a directory are atomic, so no reader ever
// sees a half-written vendor file. Staged files are removed if anything throws.
async function stage(entries) {
  const tmps = entries.map(([target]) => `${target}.tmp-${process.pid}`);
  try {
    for (const [i, [, contents]] of entries.entries()) {
      await writeFile(tmps[i], contents);
    }
    for (const [i, [target]] of entries.entries()) {
      await rename(tmps[i], target);
    }
  } catch (err) {
    await Promise.all(tmps.map((t) => rm(t, { force: true }).catch(() => {})));
    throw err;
  }
}

async function update() {
  const { url, via } = await resolveRuntimeUrl();
  const bytes = await get(url);
  const hash = sha256(bytes);

  const cssUrl = await resolveCssUrl();
  const cssBytes = await get(cssUrl);
  const subset = extractChatCss(cssBytes.toString('utf8'));
  const header =
    '/* Extracted from Fuderation\'s app stylesheet — third-party, NOT covered by\n' +
    ' * this repository\'s LICENSE. See vendor/README.md.\n' +
    ` * Source: ${cssUrl}\n` +
    ' * Subset: design tokens + .chat-msg-* / .markdown-body rules (light theme).\n' +
    ' * Regenerate with: npm run vendor:runtime -- --update\n */\n';

  const { url: mdUrl } = await resolveMarkdownUrl();
  const mdBytes = await get(mdUrl);
  const mdJs = mdBytes.toString('utf8');
  const sanitizer = {
    _comment:
      'Extracted from Fuderation\'s useMarkdown chunk — third-party, NOT covered by this ' +
      'repo LICENSE. See vendor/README.md. Stage 1 is the DOMPurify config; stage 2 re-strips ' +
      'the handlers stage 1 deliberately admits. Regenerate with: npm run vendor:runtime -- --update',
    source: mdUrl,
    config: extractSanitizeConfig(mdJs),
    handlers: extractHandlerRules(mdJs),
  };
  const sanitizerText = JSON.stringify(sanitizer, null, 2) + '\n';

  const prev = existsSync(LOCK) ? JSON.parse(await readFile(LOCK, 'utf8')) : null;
  const cssText = header + subset + '\n';
  const cssSha = sha256(Buffer.from(cssText, 'utf8'));
  const sanitizerSha = sha256(Buffer.from(sanitizerText, 'utf8'));

  // Stage every file, then rename into place. A plain writeFile can be
  // interrupted mid-stream and leave a truncated vendor file behind; a rename
  // within the same directory is atomic. The lockfile is renamed LAST, so an
  // interruption can only ever leave the *old* lockfile pointing at new
  // content — which `verify()` reports as a hash mismatch and tells you to
  // re-run `--update`. That self-diagnosing mismatch is the recovery path.
  await stage([
    [path.join(VENDOR, 'storyComponents.js'), bytes],
    [path.join(VENDOR, 'site-chat.css'), cssText],
    [path.join(VENDOR, 'markdown-sanitize.json'), sanitizerText],
    [
      LOCK,
      JSON.stringify(
      {
        _comment:
          'Provenance for vendor/. Third-party, not covered by this repo LICENSE. See vendor/README.md.',
        runtime: {
          url,
          resolvedVia: via,
          sha256: hash,
          bytes: bytes.length,
        },
        css: {
          url: cssUrl,
          sha256: sha256(cssBytes),
          sourceBytes: cssBytes.length,
          extractedBytes: subset.length,
          // Hash of the file we actually emit, not of the remote source. The
          // preview serves this file directly, so verify() has to check it.
          extractedSha256: cssSha,
        },
        markdownSanitizer: {
          url: mdUrl,
          sourceSha256: sha256(mdBytes),
          sourceBytes: mdBytes.length,
          extractedSha256: sanitizerSha,
        },
        fetchedAt: new Date().toISOString().slice(0, 10),
      },
        null,
        2,
      ) + '\n',
    ],
  ]);

  console.log(`✓ vendored ${url}`);
  console.log(`  sha256 ${hash}  (${bytes.length} bytes)`);
  console.log(`✓ extracted chat CSS from ${cssUrl}`);
  console.log(`  ${subset.length} of ${cssBytes.length} bytes kept`);
  console.log(`✓ extracted markdown sanitiser from ${mdUrl}`);
  console.log(
    `  ${sanitizer.config.ALLOWED_TAGS.length} tags, ${sanitizer.config.ALLOWED_ATTR.length} attrs, ` +
      `${sanitizer.handlers.onclickAllow.length} whitelisted onclick handlers`,
  );

  const prevHash = prev?.runtime?.sha256 ?? prev?.sha256;
  if (prevHash && prevHash !== hash) {
    console.warn('');
    console.warn('!  The runtime changed since the last vendoring.');
    console.warn(`   was ${prevHash} (${prev.fetchedAt})`);
    console.warn(`   now ${hash}`);
    console.warn('   Re-verify RUNTIME_INTERNALS.md before trusting its findings.');
  }
}

async function verify() {
  if (!existsSync(LOCK)) throw new Error('vendor/runtime.lock.json is missing — run with --update');
  const lock = JSON.parse(await readFile(LOCK, 'utf8'));
  const expected = lock.runtime?.sha256 ?? lock.sha256;
  const file = path.join(VENDOR, 'storyComponents.js');
  if (!existsSync(file)) throw new Error('vendor/storyComponents.js is missing — run with --update');

  const hash = sha256(await readFile(file));
  if (hash !== expected) {
    console.error('✗ vendor/storyComponents.js does not match the lockfile');
    console.error(`   expected ${expected}`);
    console.error(`   actual   ${hash}`);
    process.exit(1);
  }
  const cssFile = path.join(VENDOR, 'site-chat.css');
  if (!existsSync(cssFile)) {
    console.error('✗ vendor/site-chat.css is missing — run with --update');
    process.exit(1);
  }

  // lock.css.sha256 is the *remote* stylesheet; extractedSha256 covers the file
  // the preview actually serves, so truncation or hand-editing is caught here.
  const cssExpected = lock.css?.extractedSha256;
  if (cssExpected) {
    const cssHash = sha256(await readFile(cssFile));
    if (cssHash !== cssExpected) {
      console.error('✗ vendor/site-chat.css does not match the lockfile');
      console.error(`   expected ${cssExpected}`);
      console.error(`   actual   ${cssHash}`);
      process.exit(1);
    }
  } else {
    console.warn('!  lockfile predates extracted-CSS hashing — re-run with --update to pin it');
  }

  const sanFile = path.join(VENDOR, 'markdown-sanitize.json');
  const sanExpected = lock.markdownSanitizer?.extractedSha256;
  if (sanExpected) {
    if (!existsSync(sanFile)) {
      console.error('✗ vendor/markdown-sanitize.json is missing — run with --update');
      process.exit(1);
    }
    const sanHash = sha256(await readFile(sanFile));
    if (sanHash !== sanExpected) {
      console.error('✗ vendor/markdown-sanitize.json does not match the lockfile');
      console.error(`   expected ${sanExpected}`);
      console.error(`   actual   ${sanHash}`);
      process.exit(1);
    }
  }

  console.log(`✓ runtime matches lockfile (${expected.slice(0, 16)}…, fetched ${lock.fetchedAt})`);
  if (cssExpected) console.log(`✓ site-chat.css matches lockfile (${cssExpected.slice(0, 16)}…)`);
  if (sanExpected) console.log(`✓ markdown-sanitize.json matches lockfile (${sanExpected.slice(0, 16)}…)`);
}

const args = process.argv.slice(2);
await (args.includes('--update') ? update() : verify());
