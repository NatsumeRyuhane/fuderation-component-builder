# Dense embedded data

When the user wants substantial embedded data, or data is pushing a component
toward the 20,000-character allowance, try Base32768 and retain it if the **final
built component**, including the decoder and call sites, is smaller. Small or
readable text often works better as a plain literal. This is an optional data
optimization, not an automatic rewrite of every component.

The counter uses `html.length + css.length + script.length`: UTF-16 code units,
not UTF-8 bytes or AI tokens. [Upstream Base32768](https://github.com/qntm/base32768)
packs 15 bits into each BMP character (one code unit), using its safe alphabet
and special final-character padding. Payloads use about 60% fewer counted
characters than Base64. This does not promise smaller UTF-8 files or token use.
The helper uses the pinned upstream npm package instead of a custom alphabet or
codec. Keep original assets as the editable source of truth.

## Generate and consume

From the repository root, after `npm install`:

```sh
node .agents/skills/fuderation-component-builder/scripts/pack-data.mjs assets/catalog.json src/catalog-packed.ts
```

The helper accepts any file as bytes, verifies its encode/decode round trip,
and writes a UTF-8 TypeScript module exporting `unpack(): Uint8Array`. It reports
payload-only counts against Base64. The output directory must exist; an existing
output is refused. To regenerate, remove only the previously generated module,
then rerun. If this skill is copied to another project, install `base32768@5.0.1`
as a build dependency there and use the helper's actual path.

Use it from **`src/script.ts`**:

```ts
import { unpack } from './catalog-packed';

const catalog = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(unpack()));
// Render catalog using normal DOM operations.
```

For binary data, use `unpack()` directly, for example as the bytes of an image
Blob with the correct MIME type. Revoke object URLs when they are no longer used.
The generated text is a storage representation: browsers cannot use Base32768
directly as an image URL, stylesheet, or font source.

`script.ts` bundles the local module and upstream decoder into the inline script;
there is no runtime import or network request. Share the `decode` import across
multiple generated modules so esbuild can bundle one decoder. This requires
iframe mode. `script.js` is not bundled, so do not paste ESM imports into it.

## Verify the actual savings

- Keep the build's esbuild `charset: 'utf8'`. ASCII output converts the packed
  characters into `\uXXXX` escapes and destroys the character savings. Preserve
  literal Unicode in generated source; do not manually re-escape the payload.
- Compare the complete build count before and after, using equivalent data and
  behavior. Include the decoder, conversions, and any decompressor. Prefer the
  simpler representation if there is no net saving.
- The helper does encoding only. For compressible data, optionally compress
  **before** encoding and supply matching decompression after `unpack()`; verify
  browser support and its total cost before keeping that extra step.
- Keep AI prompts and AI-supplied parameters readable. Generate encoded data
  mechanically with the helper; do not ask the model to invent or edit payloads.
  This workflow packs data, not executable JavaScript; no `eval` loader is needed.
- Run `npm test`, `npm run typecheck`, and `npm run build`, then preview the
  component and verify its decoded content. A live Workshop import/playtest
  still checks behavior beyond the vendored runtime snapshot.
