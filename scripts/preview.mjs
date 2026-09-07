#!/usr/bin/env node
// Local preview server: renders src/ through the real, vendored Fuderation
// runtime inside a mock chat bubble.
//
//   node scripts/preview.mjs [--port 5173] [--open]
//
// Serves:
//   /                 the preview page
//   /main.js          the client bundle (esbuild, in-memory)
//   /styles.css       preview chrome
//   /api/component    src/ assembled the same way `npm run build` does
//   /api/watch        SSE stream that pings whenever src/ changes

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleComponent } from './build.mjs';
import { listenPreview } from './listen-preview.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEW = path.join(ROOT, 'tools', 'preview');
const VENDOR = path.join(ROOT, 'vendor');

const argv = process.argv.slice(2);
const portArg = argv.indexOf('--port');
const PORT = portArg >= 0 ? Number(argv[portArg + 1]) : 5173;

if (!existsSync(path.join(VENDOR, 'storyComponents.js'))) {
  console.error('✗ vendor/storyComponents.js is missing.');
  console.error('  Run: npm run vendor:runtime -- --update');
  process.exit(1);
}

const esbuild = await import('esbuild');

// The vendored chunk is kept byte-identical, so we redirect its two imports
// here instead of patching the file. See vendor/README.md.
const shimPlugin = {
  name: 'fuderation-runtime-shims',
  setup(build) {
    build.onResolve({ filter: /purify\.es-[A-Za-z0-9_-]+\.js$/ }, () => ({
      path: path.join(PREVIEW, 'shims', 'purify.js'),
    }));
    build.onResolve({ filter: /fontAwesomeLoader-[A-Za-z0-9_-]+\.js$/ }, () => ({
      path: path.join(PREVIEW, 'shims', 'escape.js'),
    }));
  },
};

let bundleCache = null;

async function bundle() {
  if (bundleCache) return bundleCache;
  const result = await esbuild.build({
    entryPoints: [path.join(PREVIEW, 'main.js')],
    bundle: true,
    format: 'esm',
    target: 'es2020',
    platform: 'browser',
    write: false,
    sourcemap: 'inline',
    plugins: [shimPlugin],
    logLevel: 'silent',
  });
  bundleCache = result.outputFiles[0].text;
  return bundleCache;
}

if (!existsSync(path.join(VENDOR, 'site-chat.css'))) {
  console.error('✗ vendor/site-chat.css is missing.');
  console.error('  Run: npm run vendor:runtime -- --update');
  process.exit(1);
}

// ── live reload ──────────────────────────────────────────────────────────────
const clients = new Set();
let debounce = null;

function notifyChange() {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    bundleCache = null; // preview sources may have changed too
    for (const res of clients) res.write('event: change\ndata: 1\n\n');
  }, 80);
}

for (const dir of [path.join(ROOT, 'src'), PREVIEW]) {
  if (existsSync(dir)) watch(dir, { recursive: true }, notifyChange);
}

// ── server ───────────────────────────────────────────────────────────────────
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const send = (code, type, body) => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  };

  try {
    if (url.pathname === '/api/watch') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
      res.write('retry: 500\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    if (url.pathname === '/api/component') {
      try {
        const component = await assembleComponent(ROOT);
        return send(200, 'application/json', JSON.stringify({ component }));
      } catch (err) {
        return send(200, 'application/json', JSON.stringify({ error: String(err.message || err) }));
      }
    }

    if (url.pathname === '/main.js') {
      return send(200, 'text/javascript', await bundle());
    }

    // The site's own design tokens + chat/markdown rules, extracted at vendor time.
    if (url.pathname === '/vendor-site-chat.css') {
      return send(200, 'text/css', await readFile(path.join(VENDOR, 'site-chat.css')));
    }

    if (url.pathname === '/favicon.ico') {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' +
        '<rect width="16" height="16" rx="4" fill="#6ea8fe"/>' +
        '<rect x="3.5" y="4.5" width="9" height="7" rx="2" fill="#0f1115"/></svg>';
      return send(200, 'image/svg+xml', svg);
    }

    const file = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    // path.join() normalises `..` away, so a prefix test would also accept a
    // sibling directory whose name merely starts with "preview". Compare against
    // the directory boundary instead.
    const target = path.resolve(PREVIEW, file);
    const inside = target === PREVIEW || target.startsWith(PREVIEW + path.sep);
    if (!inside || !existsSync(target)) return send(404, 'text/plain', 'not found');

    return send(200, TYPES[path.extname(target)] || 'application/octet-stream', await readFile(target));
  } catch (err) {
    send(500, 'text/plain', String(err?.stack || err));
  }
});

try {
  const actualPort = await listenPreview(server, PORT);
  const previewUrl = `http://localhost:${actualPort}`;
  if (PORT !== 0 && actualPort !== PORT) console.log(`  Port ${PORT} is occupied; using ${actualPort}.`);
  console.log(`\n  Component preview  →  ${previewUrl}\n`);
  console.log('  Renders src/ through the vendored runtime in a mock chat bubble.');
  console.log('  Edits to src/ reload automatically. Ctrl-C to stop.\n');
  if (argv.includes('--open')) {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    import('node:child_process').then(({ spawn }) =>
      spawn(cmd, [previewUrl], { stdio: 'ignore', detached: true }).unref(),
    );
  }
} catch (error) {
  console.error(`✗ Cannot start preview: ${error.message}`);
  process.exit(1);
}
