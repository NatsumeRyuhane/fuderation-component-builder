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

import { readFile, writeFile } from 'node:fs/promises';
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

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
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

async function update() {
  const { url, via } = await resolveRuntimeUrl();
  const bytes = await get(url);
  const hash = sha256(bytes);

  const prev = existsSync(LOCK) ? JSON.parse(await readFile(LOCK, 'utf8')) : null;
  await writeFile(path.join(VENDOR, 'storyComponents.js'), bytes);
  await writeFile(
    LOCK,
    JSON.stringify(
      {
        _comment:
          'Provenance for vendor/storyComponents.js. Third-party, not covered by this repo LICENSE. See vendor/README.md.',
        url,
        resolvedVia: via,
        sha256: hash,
        bytes: bytes.length,
        fetchedAt: new Date().toISOString().slice(0, 10),
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  console.log(`✓ vendored ${url}`);
  console.log(`  sha256 ${hash}`);
  console.log(`  ${bytes.length} bytes`);

  if (prev && prev.sha256 !== hash) {
    console.warn('');
    console.warn('!  The runtime changed since the last vendoring.');
    console.warn(`   was ${prev.sha256} (${prev.fetchedAt})`);
    console.warn(`   now ${hash}`);
    console.warn('   Re-verify RUNTIME_INTERNALS.md before trusting its findings.');
  }
}

async function verify() {
  if (!existsSync(LOCK)) throw new Error('vendor/runtime.lock.json is missing — run with --update');
  const lock = JSON.parse(await readFile(LOCK, 'utf8'));
  const file = path.join(VENDOR, 'storyComponents.js');
  if (!existsSync(file)) throw new Error('vendor/storyComponents.js is missing — run with --update');

  const hash = sha256(await readFile(file));
  if (hash !== lock.sha256) {
    console.error('✗ vendor/storyComponents.js does not match the lockfile');
    console.error(`   expected ${lock.sha256}`);
    console.error(`   actual   ${hash}`);
    process.exit(1);
  }
  console.log(`✓ runtime matches lockfile (${lock.sha256.slice(0, 16)}…, fetched ${lock.fetchedAt})`);
}

const args = process.argv.slice(2);
await (args.includes('--update') ? update() : verify());
