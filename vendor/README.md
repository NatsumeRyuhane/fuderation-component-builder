# Vendored third-party code — NOT covered by this repository's LICENSE

## ⚠️ Licensing

`storyComponents.js` and `site-chat.css` are **derived from proprietary
Fuderation code**, retrieved from their public web client — the first verbatim,
the second as an extracted subset. Neither is MIT-licensed and the MIT LICENSE at
the repository root **does not apply to this directory**. All rights in them
remain with their owner.

It is committed here so the local preview tool renders components exactly the way
the live site does, rather than approximating it. If you fork, redistribute, or
publish this repository, **review this directory first** — you may need to remove
it and use `npm run vendor:runtime -- --update` to fetch it locally instead.

## What is here

| File | Origin |
|---|---|
| `storyComponents.js` | `assets/storyComponents-*.js`, unmodified |
| `site-chat.css` | A subset of `assets/main-*.css` — the design tokens plus the `.chat-msg-*`, `.chat-bubble-*` and `.markdown-body` rules (light theme only), so the preview's bubble and prose match the real client |
| `runtime.lock.json` | Resolved URLs, SHA-256 of both files, byte counts and fetch date |

`storyComponents.js` is byte-identical to what the site serves — no patching, no
reformatting. The preview tool leaves it untouched and instead redirects its two
imports at bundle time (see `tools/preview/`):

- `./purify.es-*.js` → the `dompurify` npm package
- `./fontAwesomeLoader-*.js` → a local 5-line HTML-escape shim (the real chunk
  pulls in the whole application store for FontAwesome lazy-loading, which the
  component runtime does not need)

## Refreshing it

```bash
npm run vendor:runtime              # verify the committed copy against the lockfile
npm run vendor:runtime -- --update  # re-resolve from the live site, rewrite the lockfile
```

The chunk name is content-hashed and rotates on every site rebuild. `--update`
warns loudly when the hash moves — which is also the signal that
[`RUNTIME_INTERNALS.md`](../.agents/skills/fuderation-component-builder/RUNTIME_INTERNALS.md)
was written against an older build and needs re-verification.
