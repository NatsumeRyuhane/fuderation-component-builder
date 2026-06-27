---
name: fuderation-component-builder
description: Creates, debugs, and iterates on Fuderation Workshop components — interactive UI widgets inside chat messages. Covers source code, parameter design, AI prompts, and bridge function DSL.
---

# Fuderation Component Builder

A Workshop component is a **storyline-scoped widget** that renders inline in a single chat message. It is not a full page or app. Components do not work in VN mode.

Common uses: info cards, task panels, mock login screens, progress bars, copy-to-clipboard buttons, quizzes, verification panels.

## Repository layout

This repo is a **one-component-per-repo template**. Author source in `src/` at
the repo root; the build assembles a single importable `component.json`.

```text
src/
├── markup.html      # HTML only               -> component.html
├── styles.css       # styles                  -> component.css
├── script.ts        # compiled w/ esbuild     -> component.script  (iframe mode)
├── script.js        # OR verbatim passthrough -> component.script  (DSL mode)
├── ai_prompt.md     # AI supplementary prompt -> component.ai_prompt
└── meta.json        # { "name", "description" }
component.json       # BUILD OUTPUT (generated, gitignored) — import into Workshop
```

Use **either** `script.ts` **or** `script.js`, never both. Run `npm run build`
(or `node scripts/build.mjs`) to (compile and) assemble `component.json`; the
build validates the platform limits. `component.json` is generated and
gitignored — it does not exist until you build. Import the JSON into Workshop:
open the storyline → **Components** → import.

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

After delivering, suggest the user import `component.json` into Workshop and run a **playtest**. Explain that preview alone is insufficient — the real test is whether the AI invokes the component correctly in a live chat.

### Phase 3 — Add interactivity

Only after the static version renders correctly in playtest, add a script using bridge functions:

- **`src/script.js`** — passed through verbatim; write one bridge call per line to keep lightweight **DSL mode**. Prefer this for simple components, using the [safe default set](#safe-defaults).
- **`src/script.ts`** — compiled by esbuild to an inline IIFE (always **iframe mode**). Use for complex logic. Treat bridge functions as ambient globals (declared in `types/bridge.d.ts`); never `import` them, and do not use `fetch`/networking.

If the component has an input field, the trigger button **must** include `data-component-trigger="1"`. Re-run `npm run build` after changes.

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
2. Does the component name match exactly (case-sensitive)?
3. Are outer `<$...$>` tags closed?
4. Do all `$Param$` placeholders in source match `<Param>` tags in AI output?
5. Is VN mode off?
6. Does the AI supplementary prompt include a minimal invocation example?
7. Does the button have `data-component-trigger="1"` (if interactive)?

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

### Source code structure

Workshop's editor uses one combined block (HTML, then `<style>`, then `<script>`).
In this repo you author the equivalent as separate `src/` files, and the build
maps them onto the export's `html` / `css` / `script` fields:

- `src/markup.html` → the markup, with `$Param$` placeholders
- `src/styles.css` → the `<style>` contents
- `src/script.js` (verbatim, DSL mode) **or** `src/script.ts` (compiled, iframe mode) → the `<script>` contents

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

Keep width suitable for a chat bubble. Never use `fetch`, real auth, real payment, or networking — the iframe CSP blocks network anyway.

### AI supplementary prompt format

Always include these four items. Max 1,000 chars. This content counts toward the storyline prompt budget.

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

### Bridge function DSL

Prefer bridge functions over raw JS. One call per line. All selectors scoped to the current component. Use `@host` for the component root.

If raw JS is detected (`const`, `function`, `if`, `for`, `document.`, `window.`), the component switches to an isolated iframe.

> **In iframe mode (compiled `script.ts`), `saveToLocal` / `readFromLocal` / `getWorldInfo` are async (return Promises) — `await` them.** This and other reverse-engineered runtime behavior (cached avatar getters, the broader advanced-JS detector, the iframe CSP) are documented in [RUNTIME_INTERNALS.md](RUNTIME_INTERNALS.md). That file is unofficial and may be stale — verify before relying on it.

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
setStyle(selector, prop, value)      — set one allow-listed (safe) CSS property
```

**Media & avatars**: to set an image/media source, use `setValue` — not
`setStyle`. `src` is an element attribute, not a CSS property:

```
setValue('#avatar-img', getCharAvatar() || getUserAvatar())   // correct
setStyle('#avatar-img', 'src', url)                           // wrong
```

#### Flow control

```
progress(barSel, textSel, durationMs) — animate progress bar + sync % text
wait(ms)                              — pause (max 10000)
requireInputEquals(sel, expected, errMsg, trim?)
    — validate input; toast error + halt on mismatch; trim defaults true
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
getMsgContent()                — returns current message text (use as arg)
getCharAvatar()                — current storyline character avatar URL (use as arg)
getUserAvatar()                — current logged-in user avatar URL (use as arg)
getWorldInfo(trigger)          — enabled world-book entries matching trigger; returns array (use as arg)
openUrl(url)                   — http/https only
saveToLocal(key, value)        — IndexedDB; key max 128 chars
readFromLocal(key)             — returns stored value (use as arg)
```

Getter functions (`getMsgContent`, `getCharAvatar`, `getUserAvatar`,
`getWorldInfo`, `readFromLocal`) are designed to be passed as arguments to
other functions, not used on their own. Notes:
- Avatar values may be an `http`/`https` URL, a site-relative path, `blob:`, or
  `data:`. A `data:` URL renders offline inside the iframe; a remote URL only
  works if the browser can reach it.
- `getWorldInfo` returns an **array** of matched, enabled world-book entries.
  When passed to a text function (`setText`, `setValue`, `fillInput`,
  `appendMsg`, `changeMsg`) the array is auto-joined by newlines.

### Component editor fields

| Field | Purpose | Limit |
|---|---|---|
| Component name | The `<$...$>` tag the AI writes | 32 chars; `[a-zA-Z0-9_\-\u4e00-\u9fff]` only; unique per storyline |
| Description | Creator's notes | 120 chars |
| Source code | HTML + `<style>` + `<script>` in one block | 20,000 chars |
| AI supplementary prompt | Tells the AI when/how to invoke | 1,000 chars |

### Platform limits

- 30 components per storyline
- 20,000 chars per component (HTML + CSS + script combined)
- Component name: 32 chars max
- Description: 120 chars max
- AI supplementary prompt: 1,000 chars max (counts toward storyline total)
- `openUrl`: `http`/`https` only
- No real networking, auth, payment, or backend operations
- VN mode: components disabled

### Complete example

For a full working example (password gate with params, AI prompt, and a bridge-function script), see [EXAMPLE_PASSWORD_GATE.md](EXAMPLE_PASSWORD_GATE.md). It shows the `src/` files and the resulting `component.json`:

```
src/
├── markup.html
├── styles.css
├── script.js
├── ai_prompt.md
└── meta.json
component.json   # build output
```