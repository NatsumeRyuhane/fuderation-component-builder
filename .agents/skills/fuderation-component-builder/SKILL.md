---
name: fuderation-component-builder
description: Creates, debugs, and iterates on Fuderation Workshop components — interactive UI widgets inside chat messages. Covers source code, parameter design, AI prompts, and bridge function DSL.
---

# Fuderation Component Builder

A Workshop component is a **storyline-scoped widget** that renders inline in a single chat message. It is not a full page or app. Components do not work in VN mode.

Common uses: info cards, task panels, mock login screens, progress bars, copy-to-clipboard buttons, quizzes, verification panels.

## Reference material in this skill

| File | Use it for |
|---|---|
| `npm run preview` | **Render `src/` locally through the real runtime** in a mock chat bubble — shows the resolved mode, CSS truncation, auto-downscale, sanitizer stripping, and a working host bridge (`changeMsg` round-trips). See [tools/preview/README.md](../../../tools/preview/README.md). |
| [reference/OFFICIAL_GUIDE_zh.md](reference/OFFICIAL_GUIDE_zh.md) | The official creator guide, verbatim (Chinese). Source of truth for intent. |
| [RUNTIME_INTERNALS.md](RUNTIME_INTERNALS.md) | Reverse-engineered runtime behaviour: execution modes, sanitizer, sizing, async bridge. Source of truth for what actually happens. |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | The design system aligned with `chat.fuderation.com` — site token contract, the wrapper-alias rule that works in both render modes, DSL vs iframe tiers, and the pattern library in `assets/design-system/`. Load this before writing any HTML/CSS. |
| [EXAMPLES.md](EXAMPLES.md) | Four annotated real-world components (media card, dice, self-switching message, two-component state machine). |
| [EXAMPLE_PASSWORD_GATE.md](EXAMPLE_PASSWORD_GATE.md) | One complete `src/` → `component.json` walkthrough. |
| [DIAGNOSTICS.md](DIAGNOSTICS.md) | Build and run the skill's self-diagnostic DSL, negative-control, iframe, and packed-data components; functional assertions and manual visual checklists for build/runtime changes. |

## Repository layout

This repo is a **one-component-per-repo template**. Author source in `src/` at
the repo root; the build assembles a single importable `component.json`.

```text
src/
├── markup.html      # HTML comments stripped -> component.html
├── styles.css       # CSS comments stripped  -> component.css
├── script.ts        # compiled + MINIFIED     -> component.script  (iframe mode)
├── script.js        # OR stripped + iframe locals renamed -> component.script (DSL only if pure)
├── ai_prompt.md     # AI supplementary prompt -> component.ai_prompt
└── meta.json        # { "name", "description" }
component.json       # BUILD OUTPUT (generated, gitignored) — import into Workshop
```

Use **either** `script.ts` **or** `script.js`, never both. Run `npm run build`
(or `node scripts/build.mjs`) to (compile and) assemble `component.json`; the
build validates the platform limits and warns about mode-related footguns.
`component.json` is generated and gitignored — it does not exist until you build.
Import the JSON into Workshop: open the storyline → **Components** → import.

`script.ts` is the **only** file the build fully minifies. HTML, CSS and
`script.js` have comments stripped and outer whitespace trimmed. Iframe
`script.js` also shortens eligible local variables and parameters using Terser
for scope analysis, then applies only verified identifier edits to the source.
Top-level/public names, properties, shorthand bindings, function/class names,
labels, private names, dollar-bearing identifiers, strings, placeholders and
other formatting are preserved. Necessary JS
line breaks/spaces and empty CSS/HTML comment separators are retained. The
HTML pass leaves embedded JS/CSS alone; author those in their separate files.
Character budgets and mode analysis use the processed output, also used by
the local preview. Syntax minification of DSL scripts remains forbidden:
comma-merging adjacent bridge calls passes the runtime's DSL check but is
mis-parsed. Use `(() => {})();` in `script.js` to explicitly select iframe
mode; comment text or CSS length before stripping is not a stable trigger.

Optional `src/meta.json` settings: `build.renameIdentifiers` (boolean, default
`true`) and `build.reservedNames` (array of nonempty strings, default `[]`).
They apply only to `script.js`, are shared by preview/build, and are not exported.
Disable renaming when code relies on function-source reflection (`toString()`).
The renamer keeps the source if the AST changes beyond identifiers, the output
does not get shorter, or the detected mode would change. DSL scripts are never
renamed; TypeScript remains fully minified, with literal Unicode preserved by
esbuild's `charset: 'utf8'`.

### Workshop import can alter otherwise valid source

The site's import-time JavaScript comment stripper understands strings but not
regex literals. A regex containing adjacent slash characters can be truncated
as a comment and prevent the entire iframe script from starting. Use `new
RegExp(...)` with a quoted pattern for these cases. The editor also strips
comment-looking text inside CSS strings; use CSS slash escapes for literal
comment markers. Build warnings and the local preview model these transformations.
See [DIAGNOSTICS.md](DIAGNOSTICS.md#workshop-import-compatibility) for regressions.

### Packing large data payloads

When the user wants lots of embedded data, or a data-heavy component approaches
its character limit, try **Base32768** using the skill's
[scripts/pack-data.mjs](scripts/pack-data.mjs) helper. Read
[DATA_PACKING.md](DATA_PACKING.md) for generation, TypeScript integration, and
verification. Use the upstream codec's safe BMP alphabet and padding rules;
keep packing only when the final build is smaller after decoder overhead.
This is for mechanically generated data in iframe components, not AI prompts
or executable-source packing. Small plain literals usually need no encoding.

### Importing preexisting component code

When the user provides existing component code (raw HTML/CSS/JS, one combined
block, or an exported `component.json`):

1. Split it into the `src/` files above — HTML → `markup.html`, `<style>` →
   `styles.css`, `<script>` → `script.js` (or `script.ts`), the AI prompt →
   `ai_prompt.md` — and set `name`/`description` in `meta.json`.
2. If the AI prompt is missing, generate one following the [prompt format](#ai-supplementary-prompt-format).
3. Run the [debugging checklist](#debugging-checklist) and fix issues.
4. Run `npm run build` and confirm it passes validation.
5. Present a summary of what was organized and any fixes applied.

Workshop's own editor is a **single field** holding HTML + `<style>` + `<script>`
(or a complete HTML document); it splits those into the three fields on save. An
exported `component.json` may therefore carry a populated `source` alongside
`html`/`css`/`script` — split from `source` if the three are empty.

## Build workflow

Follow this sequence for every new component request. Do not skip phases. After each phase, present the output to the user and suggest concrete next steps.

### Phase 1 — Clarify intent and design parameters

Before writing any code:

1. Confirm the component's **purpose** in the storyline (what does it do narratively?).
2. Draft a **parameter table** with the user. Each parameter is a value the AI must supply at invocation time.
3. Present the table for approval before proceeding.

Parameter design guidelines:
- Display components: 2–4 params.
- Interactive components: 3–5 params.
- Hard ceiling: 8 params (AI accuracy drops beyond this).
- If a value never changes, hard-code it — do not make it a parameter.

Parameter table format:

| Name | Required | Purpose | Example value |
|---|---|---|---|
| `Title` | yes | Heading | `Mission Complete` |

### Phase 2 — Generate a static component first

Produce a working component with **no script file**. This isolates rendering and parameter substitution issues before adding interactivity.

1. Write `src/markup.html` and `src/styles.css`. Use `$ParamName$` for every AI-supplied value.
2. Write `src/ai_prompt.md` — following the [prompt format](#ai-supplementary-prompt-format).
3. Set `name` and `description` in `src/meta.json`.
4. Run `npm run build` and confirm `component.json` is produced within limits.

Check which [execution mode](#execution-modes) the static component lands in — a
scriptless component with small, plain CSS renders **inline, with its CSS
flattened into inline style attributes**, which silently kills hover states and
animation.

Run `npm run preview` to see it rendered by the real runtime at several bubble
widths before handing it over. Then suggest the user import `component.json` into Workshop and run a **playtest**. Local preview shows how it *renders*; only a playtest proves the AI will *invoke* it. Workshop's own editor preview proves neither — it always uses an iframe and never substitutes `$param$` values.

### Phase 3 — Add interactivity

Only after the static version renders correctly in playtest, add a script using bridge functions:

- **`src/script.js`** — comments stripped without rewriting code. Write one bridge call per line, using only whitelisted names, to keep lightweight **DSL mode**. (Production executes only the first **12 statements**. The separate mode check inspects 32; that is not the execution budget.) Prefer this for simple components, using the [safe default set](#safe-defaults). Remember a DSL script is a **click handler** — it runs when the user clicks the component, not on render.
- **`src/script.ts`** — compiled by esbuild to an inline IIFE (always **iframe mode**). Use for complex logic, event listeners, or anything that must run on mount. Treat bridge functions as ambient globals (declared in `types/bridge.d.ts`); never `import` them, and do not use `fetch`/networking.

If the component has an input field, give the trigger button `data-component-trigger="1"` — it stops Enter inside the input from firing the global chat send.

Re-run `npm run build` after changes.

### Phase 4 — Iterate

After each change, suggest one of these next steps (pick whichever is most relevant):
- **Style refinement**: "Want me to restyle this as cyberpunk / magic scroll / pixel art / terminal?"
- **Interaction upgrade**: "I can add a progress animation, input validation, or clipboard copy."
- **Robustness check**: "Let me verify parameter names match between source code, AI prompt, and invocation example."
- **Debugging**: "If it's not rendering, paste the AI's raw output here and I'll diagnose the mismatch."

When iterating, **edit the existing `src/` files in place** — do not regenerate from scratch unless the user explicitly asks. Update `src/ai_prompt.md` if parameters change, and re-run `npm run build`.

### Debugging checklist

When a component fails, check these in order:
1. Is the component saved in the current storyline?
2. Does the component name match? (Matching is case-insensitive, but stick to exact.)
3. Are outer `<$...$>` tags closed?
4. Is the invocation inside a markdown code block? Inline `` ` `` code and most fences suppress rendering — but a bare fence preceded by a blank line does **not** (a runtime bug, see [RUNTIME_INTERNALS.md](RUNTIME_INTERNALS.md#-inside-code-blocks--mostly-not-rendered-with-a-real-bug)). Add a language tag to fences you want treated as code.
5. Do all `$Param$` placeholders in source match `<Param>` tags in AI output?
6. Is VN mode off?
7. Does the AI supplementary prompt exist and include a minimal invocation example? An empty `ai_prompt` means the AI is never told the component exists.
8. **Styles missing or hover not working?** The component is in DSL mode — see [Execution modes](#execution-modes).
9. **Script does nothing until clicked?** That is DSL mode behaviour. Move to `script.ts` for on-mount execution.
10. **`ReferenceError: openUrl`?** `openUrl` is DSL-only; it does not exist in iframe mode.

---

## Reference

### Invocation format

The AI must output this exact tag structure for the system to render a component:

```html
<$ComponentName$>
  <Param1>value1</Param1>
  <Param2>value2</Param2>
</$ComponentName$>
```

Inside source code, `$Param1$` placeholders receive values via literal string substitution.

Details that matter:
- Component name: 1–32 chars, `[A-Za-z0-9_-]` plus CJK U+4E00–U+9FA5. Parameter names may be up to 64 chars.
- An omitted parameter substitutes to an **empty string**, never the literal `$Param$`.
- Duplicate parameter tags: the **last** one wins.
- Values are **HTML-escaped** when substituted into `markup.html`, but inserted **raw** into `styles.css` and the script. A value containing a quote will break an inline script literal — park such values in a hidden element and read them from the DOM instead.

#### Escaping a literal `$Name$`

To emit component-tag syntax from your own code (e.g. calling `changeMsg` to
re-invoke yourself), escape both `$` with a backslash:

```js
changeMsg('<\$MyPanel\$><title>Hi</title></\$MyPanel\$>')
```

The runtime strips the escapes and leaves a literal `$`. Works in HTML, CSS and
script. `String.fromCharCode(36)` is an equally valid, noisier alternative that
some creators prefer.

### Execution modes

The runtime picks one of two modes per render. **This is not purely script-driven** — markup and CSS trigger it too.

| | DSL mode (inline) | iframe mode (sandboxed) |
|---|---|---|
| CSS | **Flattened to inline `style` attributes**; first 1000 chars only; no `@`-rules, no `:hover`, no `::before` | A real `<style>` sheet — everything works |
| HTML | Sanitized (DOMPurify tag/attr allowlist) | Injected as-is; CSP contains it |
| Script runs | **On click** (the whole component is the click target) | **On mount** |
| Bridge fns | All 26, synchronous | All except `openUrl`; storage/world-info/progress/wait are async |

**You get iframe mode when any of these is true:**

1. The script matches the advanced-JS detector — `const let var function if for while return`, `=>`, `document.`, `window.`, `setInterval(`, `setTimeout(`, `requestAnimationFrame(`, `new Date(`.
2. The script is not pure DSL: any line among the first 32 that isn't `whitelistedName(args)`. (Length alone does not trigger this — validation slices to 32 statements first, so a longer all-whitelisted script still lands in DSL mode with its tail unvalidated.)
3. *(no script)* The HTML contains `<html`, `<head` or `<body`.
4. *(no script)* **The CSS exceeds 1000 characters.**
5. *(no script)* The CSS contains `@media`, `@supports`, `@keyframes`, `@font-face`, `@layer`, `@container` or `@property`.
6. *(no script)* The CSS targets `html`, `body` or `:root`.

Compiled `script.ts` always matches (1). For a **static** component that needs
real CSS, an `@media` block is enough; alternatively, add `(() => {})();` in
`script.js` to explicitly force iframe mode. CSS length here is after stripping.

⚠️ A component with a *pure-DSL script* and >1000 chars of CSS stays in DSL mode
and **silently loses the CSS tail**. The build warns about this.

### Source code structure

Workshop's editor uses one combined block (HTML, then `<style>`, then `<script>`).
In this repo you author the equivalent as separate `src/` files, and the build
maps them onto the export's `html` / `css` / `script` fields:

- `src/markup.html` → the markup, with `$Param$` placeholders
- `src/styles.css` → the `<style>` contents
- `src/script.js` (comments stripped, iframe locals renamed; DSL only if pure) **or** `src/script.ts` (compiled, iframe mode) → the `<script>` contents

```html
<!-- src/markup.html -->
<div class="wrapper">
  <div class="title">$Title$</div>
  <div class="body" data-result></div>
</div>
```

```css
/* src/styles.css */
.wrapper { border: 1px solid #3b82f6; border-radius: 14px; padding: 12px; }
```

```js
// src/script.js
setText('[data-result]', '$Content$')
show('[data-result]')
```

Always wrap everything in **one outer element** — the auto-downscale logic
measures `root.firstElementChild`, so a bare list of siblings measures wrong.

Components render at the **chat bubble's width with content-driven height** — design fluid (`width:100%` + `max-width` ~320–360px), avoid fixed px widths and horizontal overflow (the runtime scales over-wide components down), and don't assume a fixed height or aspect ratio. See [RUNTIME_INTERNALS.md → Rendering & sizing](RUNTIME_INTERNALS.md#9-rendering--sizing-fluid-width-content-height-auto-downscale) and the `frontend-design` skill's component constraints. Never use `fetch`, real auth, real payment, or networking — the iframe CSP blocks network anyway.

#### HTML that gets stripped (DSL mode)

The DSL path runs DOMPurify. **Not allowed:** `canvas`, `form`, `main`, `header`,
`footer`, `nav`, `article`, `aside`, `dialog`, `iframe`, `style`, `script`,
`template`, `object`, `embed`, `math`. Use `div`/`section` instead. `svg` and its
basic shapes *are* allowed. Inline `on*` handlers are always stripped — bind
events from the script (which puts you in iframe mode anyway).

### AI supplementary prompt format

Always include these four items. Max 1,000 chars. This content counts toward the storyline prompt budget, and a component with an **empty** `ai_prompt` is never mentioned to the AI at all.

1. **When** to use the component.
2. The **component name**.
3. **All parameter names** listed explicitly.
4. A **minimal invocation example**.

Template:

```
When you need to [scenario], use the "[Name]" component.
Output format:
<$Name$>
  <Param1>...</Param1>
  <Param2>...</Param2>
</$Name$>
Do not omit the outer tags. Parameter names must match exactly.
```

The platform wraps these into a `[组件使用说明]` block listing every component and
its call shape, then appends your text per component — so you do not need to
re-explain the `<$…$>` syntax, only *when* and *with what*.

### Bridge function DSL

Prefer bridge functions over raw JS. One call per line. All selectors scoped to the current component. Use `@host` for the component root.

Selectors resolve with `querySelector` — **a single element, never a list** — and are ignored past 200 characters.

> **In iframe mode (compiled `script.ts`), `saveToLocal` / `readFromLocal` / `getWorldInfo` / `progress` / `wait` return Promises — `await` them**, and `requireInputEquals` returns a boolean rather than halting. `openUrl` does not exist there at all. See [RUNTIME_INTERNALS.md](RUNTIME_INTERNALS.md#5-iframe-mode-bridge-semantics-differs-from-the-guide).

#### Safe defaults

Use these first: `setText` · `setValue` · `show` · `hide` · `addClass` · `removeClass` · `setStyle` · `progress` · `wait` · `requireInputEquals`

#### DOM functions

```
setText(selector, text)              — set element text content
setValue(selector, value)            — set input value; writes src for img/video/audio/source; else falls back to text
show(selector, display?)             — display element (default block)
hide(selector)                       — hide element
addClass(selector, className)        — add CSS class
removeClass(selector, className)     — remove CSS class
setStyle(selector, prop, value)      — set one sanitized CSS property (custom properties `--x` included)
```

**Media & avatars**: to set an image/media source, use `setValue`:

```
setValue('#avatar-img', getCharAvatar() || getUserAvatar())
```

`setStyle(sel, 'src', url)` is now special-cased to do the same thing, but
`setValue` remains the documented and clearer path.

**Theming from a param**: `setStyle` accepts CSS custom properties, so
`setStyle('@host', '--accent', '$Color$')` re-themes a whole component in one
call.

#### Flow control

```
progress(barSel, textSel, durationMs) — animate progress bar + sync % text (200–10000ms)
wait(ms)                              — pause (max 10000)
requireInputEquals(sel, expected, errMsg, trim?)
    — validate input; toast error on mismatch; trim defaults true
    — DSL mode: halts the remaining calls. iframe mode: returns false, halts nothing.
```

#### Chat / host bridge

```
fillInput(text)                — write into chat input box
copyText(text)                 — copy to clipboard
toast(text, type)              — type: info | success | warning | error
appendMsg(text)                — append to assistant message (persisted)
changeMsg(text)                — replace assistant message (persisted)
tempAppendMsg(text)            — append (local only, not persisted)
tempChangeMsg(text)            — replace (local only, not persisted)
getMsgContent()                — returns current message text (cached; use as arg)
getCharAvatar()                — current storyline character avatar URL (use as arg)
getUserAvatar()                — current logged-in user avatar URL (use as arg)
getWorldInfo(trigger)          — enabled world-book entries matching trigger; array (async in iframe mode)
openUrl(url)                   — http/https only — DSL MODE ONLY, undefined in iframe mode
saveToLocal(key, value)        — IndexedDB, THIS device+browser only; key max 128 chars (async in iframe mode)
readFromLocal(key)             — returns stored value, same device-local scope (async in iframe mode)
```

Getter functions (`getMsgContent`, `getCharAvatar`, `getUserAvatar`,
`getWorldInfo`, `readFromLocal`) are designed to be passed as arguments to
other functions, not used on their own. Notes:
- Avatar values may be an `http`/`https` URL, a site-relative path, `blob:`, or
  `data:`. A `data:` URL renders offline inside the iframe; a remote URL only
  works if the browser can reach it. Avatars are pre-seeded into the iframe, so
  they are correct on the first synchronous call.
- **`getMsgContent()` returns `''` on a top-level call in iframe mode.** It is
  synchronous but cached, and the cache starts empty (unlike the avatars, which
  are pre-seeded). Calling it fires a host request whose reply lands later, so
  reading it at the top of your script gets nothing — every time, not just the
  first. Defer the read (`getMsgContent(); setTimeout(() => { … }, 60)`) or take
  the value from a `$param$` instead. This silently breaks the popular
  "read my own invocation back out of the message" pattern — see
  [RUNTIME_INTERNALS.md](RUNTIME_INTERNALS.md#the-cached-getters-are-not-equally-reliable).
- `getWorldInfo` returns an **array** of matched, enabled world-book entries.
  When passed to a text function (`setText`, `setValue`, `fillInput`,
  `appendMsg`, `changeMsg`) the array is auto-joined by newlines.
- Host requests time out after 3 s and **resolve to `''`** — a failure is
  indistinguishable from empty data.

### Persisting state

Two options, and they are not equivalent:

- **`saveToLocal` / `readFromLocal`** — IndexedDB, scoped to *this device and
  browser*. Async in iframe mode. Lost on another device, and invisible to the AI.
- **`changeMsg` re-invoking your own component** — the message text becomes the
  store, so state survives reloads, follows the conversation, and is visible to
  the model. This is how switchable/multi-state components are built; see
  [EXAMPLES.md](EXAMPLES.md#3-self-switching-message-openning). Remember to
  escape the `$` (above) and to re-emit the component call, or the widget
  vanishes after the first click.

Two components can also hand off to each other by having each `changeMsg` a call
to the other, carrying state in the parameter tags — see
[EXAMPLES.md](EXAMPLES.md#4-two-component-state-machine-cyberpanelalpha--cyberpanelbeta).

### Component editor fields

| Field | Purpose | Limit |
|---|---|---|
| Component name | The `<$...$>` tag the AI writes | 32 chars; `[a-zA-Z0-9_\-一-龥]` only; unique per storyline |
| Alias | Component-market display name only; AI still calls the real name | 64 chars |
| Tags | Component-market categorisation | 8 tags, 20 chars each |
| Description | Creator's notes | 120 chars |
| Source code | HTML + `<style>` + `<script>` in one block, or a full HTML document | 20,000 chars |
| AI supplementary prompt | Tells the AI when/how to invoke | 1,000 chars |

### Platform limits

- 30 components per storyline (site-configurable default)
- 20,000 chars per component (HTML + CSS + script combined) — counted on **processed output** after comment stripping or TypeScript compilation
- Component name: 32 chars max
- Description: 120 chars max
- AI supplementary prompt: 1,000 chars max (counts toward storyline total)
- DSL mode: 1,000 chars of CSS max (after comment stripping — the overflow is dropped silently); only the first 32 **statements** are validated (not the first 32 bridge calls — a non-bridge line among them is exactly what fails validation). Production executes only the first **12 statements**; statements 13+ are silently skipped.
- `openUrl`: `http`/`https` only, DSL mode only
- No real networking, auth, payment, or backend operations
- VN mode: components disabled

### Complete examples

- [EXAMPLE_PASSWORD_GATE.md](EXAMPLE_PASSWORD_GATE.md) — one component end to end: `src/` files, AI prompt, bridge-function script, and the resulting `component.json`.
- [EXAMPLES.md](EXAMPLES.md) — four annotated components from the field, covering media, randomisers, self-switching messages, and two-component state machines.
