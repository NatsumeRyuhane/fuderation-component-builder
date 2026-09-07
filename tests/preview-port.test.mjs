import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { listenPreview } from '../scripts/listen-preview.mjs';

test('preview skips an occupied port and serves on the selected port', async (t) => {
  const occupied = createServer();
  const preview = createServer((req, res) => res.end('preview'));
  t.after(() => { occupied.close(); preview.close(); });
  const port = await listenPreview(occupied, 0);
  const selected = await listenPreview(preview, port);
  assert.ok(selected > port);
  assert.equal(preview.address().port, selected);
  const response = await fetch(`http://localhost:${selected}`);
  assert.equal(await response.text(), 'preview');
  assert.equal(occupied.address().port, port);
});

test('preview rejects invalid ports before attempting to listen', async () => {
  for (const port of [NaN, -1, 65536, 12.5]) {
    await assert.rejects(listenPreview(createServer(), port), /--port must be an integer/);
  }
});
