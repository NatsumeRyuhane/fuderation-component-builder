---
name: fuderation-component-builder
description: Creates, debugs, and iterates on Fuderation Workshop components — interactive UI widgets inside chat messages. Covers source code, parameter design, AI prompts, and bridge function DSL.
---

# Fuderation Component Builder

A Workshop component is a **storyline-scoped widget** that renders inline in a single chat message. It is not a full page or app. Components do not work in VN mode.

Common uses: info cards, task panels, mock login screens, progress bars, copy-to-clipboard buttons, quizzes, verification panels.

## File output convention

Every component gets its own directory. Use the component name (kebab-case for English, original for Chinese) as the directory name:

```
components/
├── password-gate/
│   ├── component.html          # source code (HTML + <style> + <script>)
│   └── ai_additional_prompt.md # AI supplementary prompt
├── info-card/
│   ├── component.html
│   └── ai_additional_prompt.md
└── 登录验证/
    ├── component.html
    └── ai_additional_prompt.md
```

Create the `components/` directory at the project root if it does not exist. When creating or updating a component, always write both files.

### Importing preexisting components

When the user provides an existing component (raw code, a single file, or unorganized files):

1. Identify each distinct component by its `<$Name$>` invocation tag.
2. Create a directory per component under `components/`.
3. Split source code into `component.html` and the AI prompt into `ai_additional_prompt.md`.
4. If the AI prompt is missing, generate one following the [prompt format](#ai-supplementary-prompt-format).
5. Run the [debugging checklist](#debugging-checklist) on each component and fix issues before writing files.
6. Present a summary of what was organized and any fixes applied.

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

Produce a working component with **no `<script>` block**. This isolates rendering and parameter substitution issues before adding interactivity.

1. Create the component directory: `components/<component-name>/`
2. Write `component.html` — HTML + `<style>` only. Use `$ParamName$` for every AI-supplied value.
3. Write `ai_additional_prompt.md` — following the [prompt format](#ai-supplementary-prompt-format).
4. Tell the user which Workshop editor field each file maps to:
   - `component.html` → **Source code** field
   - `ai_additional_prompt.md` → **AI supplementary prompt** field

After delivering, suggest the user paste into Workshop and run a **playtest**. Explain that preview alone is insufficient — the real test is whether the AI invokes the component correctly in a live chat.

### Phase 3 — Add interactivity

Only after the static version renders correctly in playtest, add a `<script>` block to `component.html` using bridge functions. Use the [safe default set](#safe-defaults) unless the user's requirements demand otherwise.

If the component has an input field, the trigger button **must** include `data-component-trigger="1"`.

### Phase 4 — Iterate

After each change, suggest one of these next steps (pick whichever is most relevant):
- **Style refinement**: "Want me to restyle this as cyberpunk / magic scroll / pixel art / terminal?"
- **Interaction upgrade**: "I can add a progress animation, input validation, or clipboard copy."
- **Robustness check**: "Let me verify parameter names match between source code, AI prompt, and invocation example."
- **Debugging**: "If it's not rendering, paste the AI's raw output here and I'll diagnose the mismatch."

When iterating, **edit the existing files in place** — do not regenerate from scratch unless the user explicitly asks. Update `ai_additional_prompt.md` if parameters change.

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

Single block: HTML, then `<style>`, then `<script>`:

```html
<div class="wrapper">
  <div class="title">$Title$</div>
  <div class="body">$Content$</div>
</div>

<style>
.wrapper { border: 1px solid #3b82f6; border-radius: 14px; padding: 12px; }
</style>

<script>
setText('[data-result]', '$Title$')
show('[data-result]')
</script>
```

Keep width suitable for a chat bubble. Never use `fetch`, real auth, real payment, or networking.

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

#### Safe defaults

Use these first: `setText` · `show` · `hide` · `addClass` · `removeClass` · `setStyle` · `progress` · `wait` · `requireInputEquals`

#### DOM functions

```
setText(selector, text)              — set element text content
setValue(selector, value)            — set input value; falls back to text
show(selector)                       — display element (block)
hide(selector)                       — hide element
addClass(selector, className)        — add CSS class
removeClass(selector, className)     — remove CSS class
setStyle(selector, prop, value)      — set one CSS property
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
openUrl(url)                   — http/https only
saveToLocal(key, value)        — IndexedDB; key max 128 chars
readFromLocal(key)             — returns stored value (use as arg)
```

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

For a full working example (password gate with source, params, AI prompt, and script), see [EXAMPLE_PASSWORD_GATE.md](EXAMPLE_PASSWORD_GATE.md). In practice this would be output as:

```
components/password-gate/
├── component.html
└── ai_additional_prompt.md
```