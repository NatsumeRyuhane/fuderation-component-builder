import { encode, decode } from 'base32768';
import { unpack } from './payload';
import { unpack as unpackText } from './text-payload';

function query<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error('Missing probe: ' + selector);
  return element;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function verifyBytes(bytes: Uint8Array) {
  assert(bytes.length === 18002, 'Decoded byte length changed');
  for (let i = 0; i < bytes.length; i++) {
    assert(bytes[i] === ((i * 73 + 19) & 255), 'Byte mismatch at offset ' + i);
  }
}

let running = false;
async function run() {
  if (running) return;
  running = true;
  const root = query('.lab');
  const button = query<HTMLButtonElement>('[data-run]');
  button.disabled = true;
  root.dataset.result = 'running';
  query('[data-summary]').textContent = 'RUNNING · checking actual data';
  document.querySelectorAll<HTMLElement>('[data-check]').forEach((row) => {
    row.dataset.state = 'pending';
    row.textContent = 'PENDING · ' + row.dataset.check;
  });
  let passed = 0;
  async function check(id: string, operation: () => string | Promise<string>) {
    const row = query('[data-check="' + id + '"]');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const detail = await Promise.race([
        Promise.resolve().then(operation),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Timed out after 7 seconds')), 7000);
        }),
      ]);
      row.dataset.state = 'pass';
      row.textContent = 'PASS · ' + detail;
      passed++;
    } catch (error) {
      row.dataset.state = 'fail';
      row.textContent = 'FAIL · ' + id + ' — ' + (error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeout);
    }
  }

  await check('bytes', () => {
    const bytes = unpack();
    verifyBytes(bytes);
    assert(encode(bytes).length === 9602, 'Packed character count changed');
    return '18,002 / 18,002 bytes match';
  });
  await check('text', () => {
    query('[data-text]').textContent = 'RESET';
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(unpackText()));
    const dollar = String.fromCharCode(36);
    assert(data.title === '欢迎 😀', 'Chinese or emoji changed');
    assert(data.literal === '</script> /* literal */ // ' + dollar + 'Param' + dollar, 'Literal markup changed');
    assert(data.lines === 'first\nsecond' && data.nul === '\0', 'Newline or NUL changed');
    assert(data.combining === 'e\u0301', 'Combining sequence changed');
    const display = data.title + '\n' + data.literal + '\n' + data.lines;
    setText('[data-text]', display);
    assert(query('[data-text]').textContent === display, 'Decoded text was not rendered');
    return 'UTF-8, JSON, markup, newlines and NUL';
  });
  await check('padding', () => {
    assert(Array.from(decode('媒腻㐤┖ꈳ埳')).join(',') === '104,101,108,108,111,32,119,111,114,108,100', 'Known vector failed');
    for (let size = 0; size < 32; size++) {
      const input = Uint8Array.from({ length: size }, (_, i) => (i * 37 + size) & 255);
      const result = decode(encode(input));
      assert(result.length === size && result.every((byte, i) => byte === input[i]), 'Padding failed at byte length ' + size);
    }
    const packed = encode(unpack());
    for (const form of ['NFC', 'NFD', 'NFKC', 'NFKD'] as const) {
      assert(packed.normalize(form) === packed, 'Normalization changed payload: ' + form);
    }
    return '32 padding lengths and 4 normalization forms';
  });
  await check('invalid', () => {
    // ASCII, surrogate pair, bad padding, and a secondary character before EOF.
    for (const invalid of ['A', '😀', 'Ҡ', 'ɟҠ']) {
      let rejected = false;
      try { decode(invalid); } catch { rejected = true; }
      assert(rejected, 'Malformed input was accepted');
    }
    return '4 malformed inputs rejected';
  });
  await check('dom', () => {
    const packed = encode(unpack());
    const value = query<HTMLTextAreaElement>('[data-value]');
    value.value = 'RESET';
    query('[data-dom-text]').textContent = 'RESET';
    setValue('[data-value]', packed);
    setText('[data-dom-text]', packed);
    assert(value.value === packed, 'Packed input readback changed');
    assert(query('[data-dom-text]').textContent === packed, 'Packed text readback changed');
    verifyBytes(decode(value.value));
    return '9,602 characters preserved in input and text';
  });
  await check('storage', async () => {
    const key = 'fcb.diagnostics.packed.v1';
    await saveToLocal(key, 'RESET');
    assert(await readFromLocal(key) === 'RESET', 'Storage reset failed');
    const packed = encode(unpack());
    await saveToLocal(key, packed);
    const restored = await readFromLocal(key);
    assert(restored === packed, 'Stored payload changed');
    verifyBytes(decode(restored));
    return 'storage reset and 18,002-byte round trip';
  });
  root.dataset.result = passed === 6 ? 'pass' : 'fail';
  query('[data-summary]').textContent = (passed === 6 ? 'PASS' : 'FAIL') + ' · ' + passed + '/6 data checks passed. Visual observations are separate.';
  button.disabled = false;
  running = false;
}

query('[data-run]').addEventListener('click', run);
void run();
