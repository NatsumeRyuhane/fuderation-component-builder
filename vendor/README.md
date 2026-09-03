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
| `markdown-sanitize.json` | The chat-prose sanitiser extracted from `assets/useMarkdown-*.js` — the DOMPurify config plus the event-handler post-pass (see below) |
| `runtime.lock.json` | Resolved URLs, SHA-256 of every file (source *and* extracted), byte counts and fetch date |

### Why the markdown sanitiser is vendored as data

Chat prose is not rendered raw, and it is **not** sanitised the way component
markup is. `useMarkdown` runs two stages:

1. `DOMPurify.sanitize(html, config)` with a permissive allowlist — 71 tags
   including `form`, `button`, `input` and `svg`, and `ADD_ATTR` admitting
   `onclick`, `onerror` and `ontoggle`, none of which the component sanitiser
   permits.
2. A regex pass that strips those same handlers again unless they match one of
   twelve site-provided callbacks (`window.copyCodeBlock(this)`,
   `this.classList.toggle('revealed')`, the book page-flip helpers …), keeps
   `onerror` only when it contains `this.onerror = null`, and unconditionally
   removes `onload`, `onmouseover`, `onsubmit` and ten others.

Stage 2 is why stage 1 looks so lax. Reproducing either one alone gives a
preview that is wrong in one direction or the other, so both are extracted
mechanically rather than transcribed, and hashed like everything else here.

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
