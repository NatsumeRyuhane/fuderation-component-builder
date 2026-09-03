# Example: Password Gate Component

A storyline gate: the AI shows a lock panel, the user types a code, a correct
answer plays a progress bar and reveals a success message. The script uses only
bridge functions, so it ships as `src/script.js` (verbatim → DSL mode).

This is the same `src/` layout the repo uses. Authored files below; `npm run
build` assembles them into `component.json`.

> **Mode note.** Four whitelisted calls, no native JS → this stays in **DSL
> mode**. That means the script runs **when the user clicks the component**, and
> the CSS is flattened into inline `style` attributes with only the first 1000
> characters read. The stylesheet below is deliberately kept under that cap and
> uses no `:hover` or `@keyframes`, because neither would survive. See
> [SKILL.md → Execution modes](SKILL.md#execution-modes).

## Parameters

| Name | Required | Purpose | Example |
|---|---|---|---|
| `Prompt` | yes | Instruction shown to user | `Enter the lab access code` |
| `Password` | yes | Correct answer | `7319` |
| `SuccessText` | yes | Text on success | `Underground lab unlocked` |

## `src/meta.json`

```json
{
  "name": "PasswordGate",
  "description": "Cyber door-lock verification panel for storyline gates."
}
```

## `src/markup.html`

```html
<div class="door-box">
  <div class="door-title">Security Verification</div>
  <div class="door-desc">$Prompt$</div>
  <input data-pass-field placeholder="Enter password" />
  <button data-component-trigger="1">Verify</button>
  <div class="door-bar-wrap">
    <div class="door-bar" data-progress-bar></div>
  </div>
  <div class="door-pct" data-progress-text>0%</div>
  <div class="door-result" data-result style="display:none;"></div>
  <!-- Parameter carriers. Substitution HTML-escapes into `html` but inserts
       RAW into `script`, so an apostrophe or newline in a value would break a
       JS string literal. Reading them back out of the DOM sidesteps that. -->
  <span data-pass-expected hidden>$Password$</span>
  <span data-success-text hidden>$SuccessText$</span>
</div>
```

> **Why the two hidden spans.** `$Password$` and `$SuccessText$` are free text
> the AI writes. Dropped straight into a JS string literal they are an injection
> hole; parked in markup they are escaped by the runtime, and `.textContent`
> gives them back verbatim. The DSL script below still passes `'$Password$'`
> inline — DSL statements are matched with `^name(...)$`, so a value containing
> a quote or a newline breaks the statement and silently drops the component
> into iframe mode. **If you keep the DSL version, constrain the parameter**
> (document it as digits/letters only, as the table above does). The iframe
> version has no such restriction because it reads from the DOM.

## `src/styles.css`

```css
.door-box {
  width: 100%; max-width: 340px; padding: 14px;
  border: 1px solid #22c55e; border-radius: 16px;
  background: linear-gradient(180deg, #08130f, #0f1f18); color: #d1fae5;
}
.door-title { font-size: 15px; font-weight: 700; color: #86efac }
.door-desc { margin-top: 6px; font-size: 13px; color: #a7f3d0 }
.door-box input, .door-box button {
  width: 100%; margin-top: 10px; padding: 10px 12px;
  border-radius: 10px; border: none;
}
.door-box input { background: #ecfdf5; color: #14532d }
.door-box button {
  background: #16a34a; color: #fff; font-weight: 700; cursor: pointer;
}
.door-bar-wrap {
  margin-top: 12px; height: 8px; border-radius: 999px;
  overflow: hidden; background: rgba(255,255,255,.12);
}
.door-bar { width: 0%; height: 100%; background: #22c55e }
.door-pct { margin-top: 6px; font-size: 12px; color: #bbf7d0 }
.door-result {
  margin-top: 12px; padding: 10px; border-radius: 10px;
  background: rgba(34,197,94,.12); color: #dcfce7; white-space: pre-wrap;
}
```

**988 characters** — under the 1000-char DSL flattening cap, with room to spare.
Had it gone over, everything after `.door-bar` would have rendered unstyled with
no error anywhere.

## `src/script.js`

```js
requireInputEquals('[data-pass-field]', '$Password$', 'Wrong password')
progress('[data-progress-bar]', '[data-progress-text]', 1500)
setText('[data-result]', '$SuccessText$')
show('[data-result]')
```

Four calls, one per line, all whitelisted → lightweight DSL mode (no iframe). If
this were complex logic instead, you'd write `src/script.ts` and esbuild would
compile it (running in iframe mode).

Because this is DSL mode, the script fires **on click** — clicking anywhere on
the component, with `data-component-trigger="1"` on the button so that pressing
Enter in the input doesn't send a chat message instead.

## `src/ai_prompt.md`

```text
When you need the user to perform a door lock, terminal, safe, or access verification, use the "PasswordGate" component.
Output format:
<$PasswordGate$>
  <Prompt>description of what to verify</Prompt>
  <Password>correct password</Password>
  <SuccessText>text shown on success</SuccessText>
</$PasswordGate$>
Do not omit the outer tags. Parameter names must match exactly.
```

## Build → `component.json`

```bash
npm run build
```

Produces the importable envelope (html/css/script abbreviated):

```json
{
  "type": "fuderation_story_component",
  "version": 1,
  "exported_at": "",
  "creator": { "username": "", "display_id": 0 },
  "component": {
    "name": "PasswordGate",
    "html": "<div class=\"door-box\">…</div>",
    "css": ".door-box { … }",
    "script": "requireInputEquals('[data-pass-field]', '7319', 'Wrong password')\n…",
    "source": "",
    "ai_prompt": "When you need the user to perform a door lock…",
    "description": "Cyber door-lock verification panel for storyline gates."
  }
}
```

## AI invocation (in a live chat)

```html
<$PasswordGate$>
  <Prompt>Enter the underground lab access code</Prompt>
  <Password>7319</Password>
  <SuccessText>Underground lab unlocked</SuccessText>
</$PasswordGate$>
```

## Bridge functions used

- `requireInputEquals` — validates the password input; shows an error toast and halts the remaining calls on mismatch. (The halt is DSL-mode behaviour; in iframe mode it merely returns `false`.)
- `progress` — animates the progress bar and syncs the percentage text.
- `setText` — sets the success message in the result element.
- `show` — reveals the hidden result element.

## Turning this into an iframe component

If you later want hover states, a keyframe animation, or the panel to render its
state before the user clicks, move the script to `src/script.ts`. Everything else
stays; the compiled output trips the advanced-JS detector, the CSS becomes a real
stylesheet, and `requireInputEquals` stops halting — so branch on its return
value:

```ts
const text = (sel: string) =>
  document.querySelector(sel)?.textContent ?? ''

// Read the parameters out of the escaped markup — never interpolate them into
// the script source, where a quote or newline would break the literal.
const expected = text('[data-pass-expected]')
const success = text('[data-success-text]')

const btn = document.querySelector('[data-component-trigger]')!
btn.addEventListener('click', async () => {
  if (!requireInputEquals('[data-pass-field]', expected, 'Wrong password')) return
  await progress('[data-progress-bar]', '[data-progress-text]', 1500)
  setText('[data-result]', success)
  show('[data-result]')
})
```
