# Runtime internals (reverse-engineered)

> ⚠️ **UNOFFICIAL — NOT FROM THE OFFICIAL DOCUMENTATION.**
> Everything below was reverse-engineered by reading Fuderation's shipped,
> minified client bundle — **not** the published guide. The platform can change
> any of it **without notice**, so treat this as a point-in-time snapshot that
> may already be stale or wrong. **Re-validate before relying on a detail**
> (see [How to verify](#how-to-verify-a-finding)). When this conflicts with the
> official guide — vendored verbatim at
> [reference/OFFICIAL_GUIDE_zh.md](reference/OFFICIAL_GUIDE_zh.md), live at
> <https://chat.fuderation.com/guide#component-guide-section-1> — the guide wins
> on *intent*; this file wins on *observed behaviour*.

- **Analyzed:** 2026-09-03 (full re-verification; supersedes the 2026-06-27 snapshot)
- **Source chunks:**
  - `assets/storyComponents-DHDQXgJC.js` — the component runtime (parser,
    sanitizer, mode dispatch, DSL bridge, iframe document builder)
  - `assets/StoryComponentEditor-BDSa5M3v.js` — the Workshop editor (field
    limits, single-field source splitting, preview iframe)
  - `assets/ComponentPreviewFrame-Bl5nDadz.js` — the market/preview iframe host
  - `assets/UserGuide-Do5tSyvX.js` — the official guide text

  Content hashes change on every site rebuild — re-derive them (below) rather
  than assuming them.

---

## How this was fetched (reproduce it)

The site is a Vue SPA; the runtime lives in a lazy-loaded, content-hashed chunk.

```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'

# 1. The router/manifest chunk lists every lazy chunk by hashed name.
curl -s -A "$UA" https://chat.fuderation.com/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js'

# 2. Grep that manifest for the chunks you want.
curl -s -A "$UA" https://chat.fuderation.com/assets/index-Bj6BLPUC.js \
  | grep -oE '(storyComponents|StoryComponentEditor|UserGuide)-[A-Za-z0-9_-]+\.js'

# 3. Download.
curl -s -A "$UA" https://chat.fuderation.com/assets/storyComponents-DHDQXgJC.js -o storyComponents.js

# 4. The chunks are minified to one line. esbuild re-prints them readably:
npx --no-install esbuild --format=esm --target=esnext storyComponents.js > pretty.js
```

The guide text lives in `UserGuide-*.js` as a template literal opened by an
`=` + backtick + `# Workshop 组件创作指南`. Walk forward to the closing unescaped
backtick, un-escaping backslash sequences for backtick, `n`, backslash and `$`.
As of this snapshot the extraction is **byte-identical** to
`reference/OFFICIAL_GUIDE_zh.md`.

---

## How to verify a finding

| Finding | Grep marker in `storyComponents.js` |
|---|---|
| Bridge whitelist | `new Set(["fillInput` |
| Advanced-JS detector regex | `(const\|let\|var\|function` |
| Pure-DSL check / 32-call cap | `.slice(0, 32)` near `K.test` |
| Mode dispatch | `story-inline-component-iframe` |
| CSS→inline-style flattening | `wrapperStyle` |
| Sanitizer tag allowlist | `"abbr", "audio", "b", "blockquote"` |
| Component tag regex | `<\$\s*([A-Za-z0-9_` |
| Param substitution | `t[i + 1] !== "{"` |
| `\$…\$` escape handling | `"\\".repeat(` |
| Code-fence exclusion | `^\s*(` + backtick + `{3,}\|~{3,})` |
| Async host requests | `__storyComponentRequest` |
| Cached avatar/message getters | `window.getCharAvatar = function` |
| iframe CSP | `Content-Security-Policy` |
| Auto-downscale to fit width | `autoScaleRoot` |
| Iframe height reporting | `story-component-resize` |
| Injected storyline prompt block | `组件使用说明` |

If a marker no longer matches, the runtime was rebuilt — re-fetch and re-read
before trusting anything here.

---

# Findings (snapshot 2026-09-03)

## 1. Execution modes — the dispatch is broader than the guide says

The guide says a component switches to an isolated iframe when it detects native
JS. That is only one of **four** triggers. The real dispatch (`Ne`):

```js
const script = substitute(component.script, args)     // params substituted first
const isPureDsl = !!script && Se(script)

if ( (script && (hasNativeJs(script) || !isPureDsl))   // script-driven triggers
     || (!script && needsIframe(component)) )          // markup/CSS-driven triggers
  → iframe mode
else
  → DSL mode (inline)
```

**With a script**, iframe mode when either:

1. the advanced-JS detector matches:
   ```js
   /(?:^|[\s;(])(const|let|var|function|if|for|while|return)\b|=>|document\.|window\.|setInterval\s*\(|setTimeout\s*\(|requestAnimationFrame\s*\(|new\s+Date\s*\(/i
   ```
   (broader than the guide's `const/function/if/for/document./window.`), **or**
2. the script is not "pure DSL" — `Se()` splits on `[\r\n;]+`, drops blanks and
   `//` lines, **takes only the first 32 statements**, and requires *every* one
   to match `^name(...)$` with `name` in the bridge whitelist (or registered on
   `window.storyComponentFns`). More than 32 calls, or one unknown/mis-shaped
   call, and the whole thing goes to an iframe.

**With no script at all**, iframe mode when (`_e`):

3. the HTML contains `<html`, `<head` or `<body`, **or**
4. **the CSS is longer than 1000 characters**, **or**
5. the CSS contains `@media`, `@supports`, `@keyframes`, `@font-face`, `@layer`,
   `@container` or `@property`, **or**
6. the CSS targets `html`, `body` or `:root`.

Any compiled `script.ts` output matches trigger 1 → **always iframe mode**.

### Why this matters more than it looks

DSL mode has **no stylesheet**. See §2. Iframe mode is the only mode where your
CSS is a real stylesheet, so triggers 4–6 are the levers for a *static* component
that needs real CSS — a `@media` block or 1 KB of CSS is enough.

## 2. DSL mode flattens CSS into inline `style` attributes

In DSL mode the runtime never emits a `<style>` element. `Ee()` + `be()` parse
the CSS field into `{selector, declarations}` pairs, `querySelectorAll` each
selector against the markup, and merge the declarations into each match's inline
`style` attribute:

```js
const o = String(css).replace(/\/\*[\s\S]*?\*\//g, "").slice(0, 1000)   // ← 1 KB cap
for (const [, selector, body] of o.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const style = sanitizeDeclarations(body)
  for (const sel of selector.split(",").map(s => s.trim()).filter(s => !s.startsWith("@")))
    push({ selector: sel, style })
}
```

Consequences for a DSL-mode component:

- **Only the first 1000 characters of CSS are read.** Everything after is
  silently dropped. (Consistent with trigger 4: exceed 1 KB *with no script* and
  you get an iframe instead — but a component **with** a pure-DSL script and
  >1 KB of CSS stays in DSL mode and loses the tail.)
- `@media`, `@keyframes`, `@font-face` … are skipped.
- **Pseudo-classes and pseudo-elements never apply** — `:hover`, `::before`,
  `:nth-child` are matched with `querySelectorAll` against a static template, so
  `:hover` matches nothing and `::before` throws (that selector is skipped).
- Each declaration is filtered: the property must match `^--[A-Za-z0-9_-]{1,64}$`
  or `^[A-Za-z][A-Za-z-]{0,63}$`, the value must be ≤256 chars and must not
  contain `javascript:`, `expression(`, `@import` or `url(javascript:)`.
- Your own inline `style` attributes are merged with (and can be overwritten by)
  the flattened rules.

**Rule of thumb: if the component's look depends on hover states, animation, or
more than ~1 KB of CSS, make sure it is in iframe mode.**

## 3. DSL mode runs on click; iframe mode runs on mount

- **DSL mode** emits
  `<div class="story-inline-component is-clickable" data-story-component="1"
  data-component-name="…" data-component-script="…" role="button" tabindex="0">`.
  The script rides along in an attribute and the whole component is the click
  target.
- **iframe mode** emits a placeholder div
  (`data-story-component-frame="1" data-story-frame-id="sc_<hash>"`) and stores
  the built document in an in-memory LRU (256 entries, keyed by a DJB2 hash of
  `{renderScope,name,html,css,script,args,occurrence}`). The mounted document
  runs your `<script>` **immediately on load**.

So a DSL script is a click handler and an iframe script is an init routine. A
component that must render its state before any interaction (title from a param,
avatar, etc.) needs iframe mode or plain `$param$` substitution in the HTML.

> **Not located.** The code that turns the placeholder div into an `<iframe>`,
> binds the DSL click handler, and honours `data-component-trigger="1"` is not
> in any chunk reachable from the manifest. So the DSL interpreter's exact
> semantics (notably whether `requireInputEquals` truly halts the remaining
> calls) remain unverified from source. The guide asserts it does.

## 4. Bridge whitelist (26 names, incl. 2 undocumented aliases)

```js
new Set(["fillInput","saveToLocal","readFromLocal","getWorldInfo","copyText",
  "toast","appendMsg","changeMsg","tempAppendMsg","tempChangeMsg","getMsgContent",
  "getUserAvatar","getCurrentUserAvatar","getCharAvatar","getCurrentCharAvatar",
  "openUrl","setText","setValue","show","hide","addClass","removeClass","setStyle",
  "progress","wait","requireInputEquals"])
```

`getCurrentUserAvatar` / `getCurrentCharAvatar` are undocumented aliases
(`window.getCurrentCharAvatar = window.getCharAvatar`).

### `openUrl` is DSL-only

The whitelist is the *parser's* list of legal DSL call names. The **iframe
bridge does not define `openUrl`** — it is the one whitelisted name with no
`window.openUrl = …` in the injected document. Calling it from a compiled
`script.ts` throws `ReferenceError`. Everything else in the list is defined in
both modes.

## 5. Iframe-mode bridge semantics (differs from the guide)

The guide's examples are synchronous. In the iframe document:

| Function | Iframe-mode reality |
|---|---|
| `saveToLocal(k, v)` | `Promise<string>` |
| `readFromLocal(k)` | `Promise<string>` |
| `getWorldInfo(t)` | `Promise<string[]>` |
| `progress(bar, text, ms)` | `Promise<void>`, duration clamped 200–10000 ms |
| `wait(ms)` | `Promise<void>`, clamped 0–10000 ms |
| `requireInputEquals(...)` | returns `boolean`; toasts on mismatch but **does not halt** |
| `getMsgContent()` / `getCharAvatar()` / `getUserAvatar()` | sync, return a **cached** value, fire a background refresh |

`saveToLocal` / `readFromLocal` / `getWorldInfo` `postMessage` to the host via
`__storyComponentRequest`, which uses a 3 s default timeout (clamped 300 ms–10 s)
and **resolves to `''` on timeout** — failures look like empty data, not errors.

```js
window.readFromLocal = function (variable) {
  return window.__storyComponentRequest('readFromLocal', { variable: String(variable || '') })
    .then((ret) => String(ret || ''))
}
```

So `setValue('[x]', readFromLocal('k'))` only works in DSL mode (the interpreter
awaits it). In a compiled component you must `await readFromLocal('k')`.

### The cached getters are not equally reliable

Avatars are **pre-seeded** into the iframe document at build time, so they are
correct on the first synchronous call. **Message content is not:**

```js
window.__storyComponentMsgContent = ''                       // hardcoded
window.__storyComponentUserAvatar = ${JSON.stringify(c)}     // real value
window.__storyComponentCharAvatar = ${JSON.stringify(i)}     // real value
```

`getMsgContent()` posts a request to the host and *synchronously returns that
cached empty string*; the reply arrives later and only updates the cache. So a
top-level `const raw = getMsgContent()` **always reads `''`**, on every mount —
not just the first. Confirmed by running the shipped runtime under
`npm run preview`.

This silently breaks the common "read my own invocation back out of the message"
pattern (see [EXAMPLES.md](EXAMPLES.md#4-two-component-state-machine-cyberpanelalphabeta),
where it makes a shipped component pair drop its state entirely). Either defer
the read:

```js
getMsgContent();                          // fire the request
setTimeout(() => {
  const raw = getMsgContent() || '';      // now populated
}, 60);
```

…or avoid the round-trip altogether by taking state from `$param$` placeholders,
which are substituted before the document is built.

### Selector and value rules (both modes)

- `@host` resolves to `#story-component-root`; any other string goes to
  `document.querySelector` — **single element only**, never a NodeList.
- Selectors longer than 200 characters are ignored.
- `setValue` writes `src` on `img`/`video`/`audio`/`source` (rejecting
  `javascript:`, `data:text/html`, `data:application/javascript`), `.value` on
  `input`/`textarea`/`select`, otherwise `textContent`.
- `setStyle(sel, 'src', v)` is **special-cased to `setValue`** — it now works,
  contrary to the guide. Prefer `setValue` anyway; it is the documented path.
- `setStyle` accepts **CSS custom properties** (`--foo`), which makes
  `setStyle('@host', '--accent', '#f00')` a clean way to re-theme a component
  from a param.

## 6. Sanitization — DSL path only

In **DSL mode** the substituted HTML goes through DOMPurify plus a second
hand-rolled attribute pass. In **iframe mode** it does not — the HTML is injected
into the sandboxed document as-is, and the CSP does the containment.

DOMPurify config:

```js
ALLOWED_TAGS:  a abbr audio b blockquote br button caption cite code col colgroup
               dd del details div dl dt em figcaption figure h1–h6 hr i img input
               ins kbd label li mark ol option p pre progress q s samp section
               select small source span strong sub summary sup table tbody td
               textarea tfoot th thead time tr u ul var video
               svg circle ellipse g line path polygon polyline rect text
FORBID_TAGS:   form iframe object embed script style template math
FORBID_ATTR:   action formaction srcdoc
ALLOW_ARIA_ATTR / ALLOW_DATA_ATTR: true
```

Notably **absent** from the allowlist: `canvas`, `form`, `main`, `header`,
`footer`, `nav`, `article`, `aside`, `dialog`, `iframe`, `style`. Use `div`/
`section` instead. `KEEP_CONTENT: true`, so a stripped tag's children survive.

Attribute pass (`I`): rejects anything starting `on`, plus `action`/`formaction`/
`srcdoc`; otherwise the name must be in the ~90-entry allowlist or start with
`aria-`/`data-`. `href` is restricted to `http/https/mailto/tel`; `src`/`poster`
to `http/https/blob`, or a `data:` URL whose MIME matches the element
(`data:image/*` for `img`/`poster`, `data:video|audio/*` for media). `style`
values go through the same declaration sanitizer as §2. `target` may only be
`_blank`/`_self`, and `<a target="_blank">` gets `rel="noopener noreferrer"`.

The sanitizer also decodes HTML entities before URL checks
(`&#106;avascript:` won't slip through) and strips `<script|style|iframe|object|
embed|template|noscript|math>` blocks wholesale in the no-DOMPurify fallback.

## 7. Parsing: component tags, parameters, escaping

### Component tag

```js
/<\$\s*([A-Za-z0-9_\-一-龥]{1,32})\s*\$>/g
```

- Name: 1–32 chars, ASCII alnum + `-` `_` + CJK **U+4E00–U+9FA5** (note: *not*
  U+9FFF — a few rare CJK ideographs are excluded).
- Whitespace inside the delimiters is tolerated: `<$ Name $>` works.
- Matching against your stored component name is **case-insensitive**.
- **Nesting of the same name is supported** — the closer is found by depth
  counting, not by first match.
- A `<$Name$>` with no closer, while the message is still streaming, renders a
  `component-loading` placeholder.

### Parameters

```js
/<([A-Za-z0-9_\-一-龥]{1,64})>([\s\S]*?)<\/\1>/g
```

Name 1–64 chars, value trimmed, non-greedy. **Duplicate tags: last one wins.**
An omitted parameter substitutes to `''` — never to the literal placeholder.

### Placeholder substitution

Scans `$` positions and pairs them up. A pair substitutes when the text between
is 1–64 chars, contains no newline, and does not start with `{` (so JS template
literals `${…}` are safe).

**Escaping is official and backslash-based.** `C()` counts the backslashes
preceding each `$`; an odd count means escaped, the escape is removed and a
literal `$` is emitted. `\$Name\$` therefore renders as `$Name$` in HTML, CSS and
script alike. `String.fromCharCode(36)` is an equally valid workaround.

**Params are HTML-escaped into `html`, and raw into `css` and `script`:**

```js
const html   = C(component.html,   args, /* escapeHtml */ true)
const css    = C(component.css,    args, false)
const script = C(component.script, args, false)
```

So a param value containing `"` or `'` will break an inline script string
literal. Park such values in a hidden element and read them back from the DOM.

### `<$…$>` inside code blocks — mostly not rendered, with a real bug

The parser computes fenced (```` ``` ````/`~~~`) and inline-backtick spans and
skips any component tag inside one. Inline code and correctly-detected fences
protect their contents. **But fence detection has a bug**, verified by driving
the shipped module directly:

```text
protects:  hi\n```\n<$X$>…\n```           (fence on the line right after text)
protects:  hi\n\n```js\n<$X$>…\n```       (blank line, but a language tag)
LEAKS:     hi\n\n```\n<$X$>…\n```         (blank line, no language tag)
LEAKS:     hi\n\n~~~\n<$X$>…\n~~~         (same, tildes)
LEAKS:     hi\n\n\n```\n<$X$>…\n```       (any amount of blank space)
```

The opener regex is `/^\s*(`{3,}|~{3,})/` applied to `o.slice(t)` at a position
that already follows a newline. When a blank line precedes the fence, `\s*`
consumes that second newline, so the subsequent `o.indexOf("\n", t)` finds *the
same newline* and `m` lands just past it — meaning the fence's own opening line
is then tested as, and accepted as, its closing line:

```js
const d = o.indexOf(`\n`, t), m = d < 0 ? o.length : d + 1;
e.push([u, m, true]), t = m;      // fence opened … and immediately
// next iteration: o.slice(t, u) === "```"  → matches the closer regex → closed
```

The fence is recorded as closed-and-empty, so everything "inside" it is ordinary
text and the component **renders**. A language tag prevents this, because
`"```js"` fails the closer regex.

Practical consequence: a creator documenting a component *inside a chat message*
with idiomatic markdown (blank line, bare fence) gets a live component instead of
a code sample. Write ` ```text ` rather than ` ``` `.

`He()` auto-escapes `<$…$>` to `<\$…\$>` outside code spans — the message-edit
path, which is why hand-editing a message containing a component call can turn it
into literal text. It shares `O()`, so it inherits the same bug from the other
side: in the blank-line-plus-bare-fence case it **escapes** a tag that a reader
intended as a code sample, mangling the block on edit.

## 8. Iframe sandbox and CSP

The mounted document carries:

```
default-src 'none'; img-src data: blob: http: https:; media-src data: blob: http: https:;
font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';
connect-src 'none'; frame-src 'none';
```

→ **no networking** (`connect-src 'none'`: no fetch/XHR/WebSocket/EventSource),
no external scripts, no external fonts, no nested frames; images and media may
load from `data:`/`blob:`/`http(s)`.

**Origin (previously unconfirmed):** the editor and market preview frames mount
as `<iframe sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="…">` —
`allow-scripts` **without** `allow-same-origin`, i.e. a unique opaque origin with
no access to the app's `localStorage`/`indexedDB`/cookies. The chat-path mount
code was not located (§3), but it uses the same builder and the same
`postMessage`-only architecture, so treat direct browser-storage access as
unsupported in every mode.

## 9. Rendering & sizing (fluid width, content height, auto-downscale)

DSL mode renders inline as `<div class="story-inline-component">` — it flows at
the message's content width. iframe mode mounts a document that fixes layout:

```css
html { margin:0; padding:0; min-height:0 !important; height:auto !important }
body { margin:0; padding:0; min-height:0 !important; height:auto !important;
       overflow:hidden !important }
#story-component-root { transform-origin:top left; display:block;
                        width:100%; max-width:100%; box-sizing:border-box }
#story-component-root *, ::before, ::after { box-sizing: inherit }
```

- **Width = the chat bubble's available width** (the iframe viewport). No fixed
  width, no aspect ratio.
- **Auto-downscale.** On every resize the runtime runs `autoScaleRoot()`: if your
  *first child element*'s natural width exceeds the viewport, the whole root is
  scaled down — shrinking everything, so text and controls become tiny:

  ```js
  const childW = child.scrollWidth || child.offsetWidth
  const viewW  = documentElement.clientWidth || innerWidth
  if (childW > viewW) { root.style.transform = 'scale(' + viewW / childW + ')'; root.style.width = childW + 'px' }
  ```

  Triggered by fixed px widths wider than the bubble, wide tables, `nowrap` long
  strings, or any horizontal overflow. Note it measures `root.firstElementChild`
  — which is why the guide insists on a single outer wrapper `div`.
- **Height is content-driven and unbounded.** The document measures its content
  (range rects + max descendant bottom, scaled) and posts
  `{ type:'story-component-resize', id, height }`. The host sizes the iframe to
  match. Measurement is driven by a ResizeObserver, a MutationObserver
  (`style`/`class`/childList/characterData, subtree), `load`/`resize`/
  `transitionend`/`animationend`, plus an active poll (12 ticks × 350 ms) that
  restarts on mutation, plus one-shot re-measures at 80/300/800 ms.
  `body{overflow:hidden}` clips horizontal overflow rather than scrolling it.

## 10. Editor fields, limits, and the single-field source

Defaults from `StoryComponentEditor` props: `maxComponents: 30`,
`componentTotalLimit: 20000` (site-configurable — these are the shipped
defaults, not hard limits in the protocol).

| Field | Limit | Notes |
|---|---|---|
| `name` | 32 | The `<$…$>` tag; unique per storyline |
| `alias` | 64 | **Component-market display name only** — AI still calls `name` |
| `tags` | 8 tags × 20 chars | Market categorisation; comma-separated input, ≤200 chars |
| `description` | 120 | Creator's note |
| `ai_prompt` | 1000 | Injected into the system prompt; counts to the storyline budget |
| `html`+`css`+`script` | 20000 combined | Live counter in the editor |

**The single source field.** The editor keeps a `source` string (what you typed)
and derives the three fields from it on every keystroke: strip comments, pull out
every `<style>…</style>` into `css` (joined by blank lines), every
`<script>…</script>` into `script` (joined by newlines), and the remainder —
unwrapped from `<!doctype>/<html>/<head>/<body>` — into `html`. A full HTML
document pastes in cleanly. Exported JSON carries all four; this repo's build
emits `source: ""` and the three derived fields directly, which the importer
accepts.

**Import repair.** `Me()` converts literal `\n` escape sequences into real
newlines for `html`/`css`/`ai_prompt` when the field contains no real newline,
and does the same for `script` with a string-aware scanner that leaves `\n`
inside quotes alone. **Import filter:** `$()` drops any component without both a
`name` and a non-empty `html`.

**Component market.** Components can be uploaded for admin review and sold for
points. A `market_locked` component (bought and imported) has hidden, immutable,
non-exportable source; the buyer can still edit its `ai_prompt` and preview it.
Relevant fields: `component_id` (UUID), `market_item_id`, `market_revision`,
`market_locked`.

**Editor preview ≠ playtest.** The preview always mounts an iframe (regardless
of the component's real mode), does **not** substitute `$param$` placeholders,
and clamps height to 100–1200 px. It shows layout only.

## 11. The injected storyline prompt block

Components with a non-empty `ai_prompt` are concatenated into the system prompt
as:

```
[组件使用说明]
当需要调用组件时，使用以下格式：
<$组件名$>
  <参数名>参数值</参数名>
  </$组件名$>
- 组件 <Name>：使用 "<$<Name>$>...</$<Name>$>" 包裹，内部可用 <参数>值</参数> 传值。<ai_prompt>
```

One bullet per component, so the per-component `ai_prompt` is a *suffix* to a
line that already names the component and restates the call shape. A component
with an empty `ai_prompt` contributes nothing and the AI will not know it exists.

## 12. `data-component-trigger="1"` — what it is actually for

Per the editor's own help text: it marks the submit/trigger button so that
**pressing Enter inside a component's input does not fire the global chat send**.
It is a recommendation for components containing an `<input>`, not a requirement
for a button to work. (The handler itself lives in the un-located chunk, §3.)

---

## Known discrepancies with this skill / template

All of the following have been reconciled in this repo as of 2026-09-03; the
list is kept so a future re-verification can tell what was already corrected.

- `types/bridge.d.ts` declared `saveToLocal`/`readFromLocal`/`getWorldInfo`/
  `progress`/`wait` as synchronous `void`. In iframe mode — the only mode
  `script.ts` ever runs in — they are Promise-returning. **Fixed.**
- `types/bridge.d.ts` declared `openUrl`. It is undefined in iframe mode.
  **Fixed** (documented as DSL-only).
- `requireInputEquals` was documented as halting the script. That is DSL-mode
  behaviour; in iframe mode it returns `false`. **Fixed.**
- `scripts/build.mjs` validated component names against `[一-鿿]`; the
  runtime's regex is `[一-龥]`. **Fixed.**
- `SKILL.md` presented iframe mode as purely script-driven. Markup and CSS also
  trigger it (§1), and DSL mode flattens CSS (§2). **Fixed.**
- `EXAMPLE_PASSWORD_GATE.md` shipped 1102 chars of CSS with a pure-DSL script —
  ~100 chars would have been silently dropped by the 1 KB flattening cap.
  **Fixed.**
