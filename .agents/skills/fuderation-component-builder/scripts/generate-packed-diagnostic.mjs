#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packBytes } from './pack-data.mjs';

const directory = new URL('../assets/diagnostics/iframe-data/', import.meta.url);

// Fixed data, including all 256 byte values and a secondary final code point.
export function diagnosticBytes() {
  return Uint8Array.from({ length: 18002 }, (_, i) => (i * 73 + 19) & 255);
}

export async function packedDiagnosticSources() {
  return {
    'payload.ts': packBytes(diagnosticBytes()).source,
    'text-payload.ts': packBytes(await readFile(new URL('data/text.json', directory))).source,
  };
}

async function main() {
  for (const [name, source] of Object.entries(await packedDiagnosticSources())) {
    // These two files are generated fixtures, never hand-authored modules.
    await writeFile(new URL('src/' + name, directory), source, 'utf8');
    console.log('Regenerated iframe-data/src/' + name);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
