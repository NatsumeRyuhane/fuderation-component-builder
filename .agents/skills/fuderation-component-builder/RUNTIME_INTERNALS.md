# Runtime internals (reverse-engineered)

> ⚠️ **UNOFFICIAL — NOT FROM THE OFFICIAL DOCUMENTATION.**
> Everything below was reverse-engineered by reading Fuderation's shipped,
> minified client bundle — **not** the published guide. The platform can change
> any of it **without notice**, so treat this as a point-in-time snapshot that
> may already be stale or wrong. **Re-validate before relying on a detail**
> (see [How to verify](#how-to-verify-a-finding)), and when this conflicts with
> the official guide (<https://chat.fuderation.com/guide#component-guide-section-1>),
> trust the guide.

- **Analyzed:** 2026-06-27
- **Source chunk:** `https://chat.fuderation.com/assets/storyComponents-ai82fmtS.js`
  (the component runtime). The `ai82fmtS` hash changes on every site rebuild —
  re-derive it (below) rather than assuming it.

---

## How this was fetched (reproduce it)

The site is a Vue SPA; the runtime lives in a lazy-loaded, content-hashed chunk.
To get the current one:

```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'

# 1. The router/manifest chunk lists every lazy chunk by hashed name.
#    Find it from the app shell's preloaded modules (an index-*.js).
curl -s -A "$UA" https://chat.fuderation.com/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js'

# 2. Grep that manifest for the current component-runtime chunk hash.
curl -s -A "$UA" https://chat.fuderation.com/assets/index-obocAZjB.js \
  | grep -oE 'storyComponents-[A-Za-z0-9_-]+\.js'

# 3. Download the runtime chunk.
curl -s -A "$UA" https://chat.fuderation.com/assets/storyComponents-ai82fmtS.js -o storyComponents.js
```

The guide text itself lives in `UserGuide-*.js` as a template-literal string
(`Qe = \`# Workshop 组件创作指南 …\``) and was extracted the same way.

The chunk is minified to one line; read it by grepping for the markers in
[How to verify](#how-to-verify-a-finding) and printing a window around each hit
(e.g. with a short Python `s.find(...)` slice).

---

## How to verify a finding

| Finding | Grep marker in `storyComponents.js` |
|---|---|
| Bridge whitelist | `new Set(["fillInput"` |
| Advanced-JS detector regex | `(const\|let\|var\|function` |
| Async getters | `__storyComponentRequest` |
| Cached avatar/message getters | `window.getCharAvatar = function` |
| iframe sandbox CSP | `Content-Security-Policy` |
| Param substitution regex | `\$(?!\{)` |
| HTML sanitizer | `script\|iframe\|object\|embed` |
| Render-mode dispatch | `story-inline-component-iframe` |

If a marker no longer matches, the runtime was rebuilt — re-fetch and re-read
before trusting anything here.

---

## Findings (snapshot 2026-06-27)

### 1. Two execution modes

The runtime decides per component, then emits one of two DOM shapes:

- **DSL mode** → inline `<div data-story-component data-component-script="…">`;
  the script is parsed as one-call-per-line bridge calls (no real JS engine).
- **iframe mode** → `<div class="story-inline-component-iframe"
  data-story-component-frame="1" data-story-frame-doc="<encodeURIComponent(fullHtmlDoc)>">`,
  later mounted as an iframe whose document bundles the bridge + your script.

Mode is chosen by this detector (note: **broader than the guide states**, which
only lists `const/function/if/for/document./window.`):

```js
V = /(?:^|[\s;(])(const|let|var|function|if|for|while|return)\b|=>|document\.|window\.|setInterval\s*\(|setTimeout\s*\(|requestAnimationFrame\s*\(|new\s+Date\s*\(/i
```

Any compiled `script.ts` output matches this → **always iframe mode**.

### 2. Bridge whitelist (incl. 2 undocumented aliases)

```js
P = new Set(["fillInput","saveToLocal","readFromLocal","getWorldInfo","copyText",
  "toast","appendMsg","changeMsg","tempAppendMsg","tempChangeMsg","getMsgContent",
  "getUserAvatar","getCurrentUserAvatar","getCharAvatar","getCurrentCharAvatar",
  "openUrl","setText","setValue","show","hide","addClass","removeClass","setStyle",
  "progress","wait","requireInputEquals"])
```

`getCurrentUserAvatar` / `getCurrentCharAvatar` are **undocumented aliases** of
`getUserAvatar` / `getCharAvatar` (`window.getCurrentCharAvatar = window.getCharAvatar`).

### 3. Persistence — and the async discrepancy

There is **no direct storage access** for components. `saveToLocal` /
`readFromLocal` `postMessage` the request to the host, which owns the store
(per the guide: IndexedDB, scoped to device+browser, key ≤128 chars). In
**iframe mode** they are **async (Promise-returning)** — unlike the guide's
synchronous examples:

```js
window.readFromLocal = function (variable) {
  return window.__storyComponentRequest('readFromLocal', { variable: String(variable || '') })
    .then((ret) => String(ret || ''))
}
// saveToLocal -> Promise<string>, readFromLocal -> Promise<string>, getWorldInfo -> Promise<string[]>
```

`__storyComponentRequest` uses a 3 s default timeout (clamped 300 ms–10 s) and
**resolves to `''` on timeout** (failures look like empty data, not errors).

So `setValue('[x]', readFromLocal('k'))` only works in DSL mode (the interpreter
awaits it). In a compiled/raw-JS component you must `await readFromLocal('k')`.

### 4. Cached synchronous getters

`getCharAvatar` / `getUserAvatar` / `getMsgContent` are **sync but return a
cached value**, firing a background refresh:

```js
window.getCharAvatar = function () {
  parent.postMessage({ type: 'story-component-action', action: 'getCharAvatar' }, '*')
  return String(window.__storyComponentCharAvatar || '')
}
```

Avatars are **pre-seeded** when the iframe doc is built (`tt(...)` bakes in
`userAvatar`/`charAvatar`), so they're reliable on first call. `getMsgContent()`
may be empty/stale on the first call until the host responds.

### 5. iframe sandbox CSP

The mounted iframe document carries:

```
default-src 'none'; img-src data: blob: http: https:; media-src data: blob: http: https:;
font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';
connect-src 'none'; frame-src 'none';
```

→ **no networking** (`connect-src 'none'`: no fetch/XHR/WebSocket), no external
scripts, no nested frames; images/media may load from `data:`/`blob:`/`http(s)`.

### 6. Sanitization & parameter substitution

- `$param$` substitution: `/\$(?!\{)([^$\n]{1,64})\$/g` — skips `${` (JS
  template literals are safe), max 64 chars between the `$`s, no newlines.
- The component's HTML is stripped of `script|iframe|object|embed|link|meta|style`
  tags and inline `on*=` handlers before rendering.

### 7. Could not confirm

The chunk that converts the emitted `<div data-story-frame-doc>` into the actual
`<iframe>` element was **not located** — no `sandbox`, `srcdoc`,
`createObjectURL('…html')`, or `data:text/html` literal appears in the chunks
pulled. So the iframe's exact **origin** (and thus whether component JS could
reach the app's `localStorage`/`indexedDB`/cookies at all) is **unverified**.
The architecture routes every stateful op through `postMessage` to the host,
which strongly implies isolation — but treat direct browser-storage access as
unsupported and unverified either way.

---

## Known discrepancies with this skill / template

- `types/bridge.d.ts` declares `saveToLocal`/`readFromLocal` and `getWorldInfo`
  with synchronous return types. For the compiled (iframe) path they are
  **`Promise<string>` / `Promise<string>` / `Promise<string[]>`**.
- `SKILL.md` labels `readFromLocal`/`getWorldInfo` "(use as arg)" without the
  iframe-mode async caveat above.
