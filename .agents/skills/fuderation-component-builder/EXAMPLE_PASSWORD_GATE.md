# Example: Password Gate Component

A storyline gate: the AI shows a lock panel, the user types a code, a correct
answer plays a progress bar and reveals a success message. The script uses only
bridge functions, so it ships as `src/script.js` (verbatim → DSL mode).

This is the same `src/` layout the repo uses. Authored files below; `npm run
build` assembles them into `component.json`.

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
  <div class="door-progress-wrap">
    <div class="door-progress" data-progress-bar></div>
  </div>
  <div class="door-progress-text" data-progress-text>0%</div>
  <div class="door-result" data-result style="display:none;"></div>
</div>
```

## `src/styles.css`

```css
.door-box {
  border: 1px solid #22c55e; border-radius: 16px; padding: 14px;
  background: linear-gradient(180deg, #08130f, #0f1f18);
  color: #d1fae5; box-shadow: 0 8px 24px rgba(34,197,94,0.15);
}
.door-title { font-size: 15px; font-weight: 700; color: #86efac; }
.door-desc { margin-top: 6px; font-size: 13px; color: #a7f3d0; }
.door-box input, .door-box button {
  width: 100%; margin-top: 10px; padding: 10px 12px;
  border-radius: 10px; border: none;
}
.door-box input { background: #ecfdf5; color: #14532d; }
.door-box button {
  background: linear-gradient(90deg, #22c55e, #16a34a);
  color: white; font-weight: 700; cursor: pointer;
}
.door-progress-wrap {
  margin-top: 12px; height: 8px; border-radius: 999px;
  overflow: hidden; background: rgba(255,255,255,0.12);
}
.door-progress {
  width: 0%; height: 100%;
  background: linear-gradient(90deg, #86efac, #22c55e);
}
.door-progress-text { margin-top: 6px; font-size: 12px; color: #bbf7d0; }
.door-result {
  margin-top: 12px; padding: 10px; border-radius: 10px;
  background: rgba(34,197,94,0.12); color: #dcfce7; white-space: pre-wrap;
}
```

## `src/script.js`

```js
requireInputEquals('[data-pass-field]', '$Password$', 'Wrong password')
progress('[data-progress-bar]', '[data-progress-text]', 1500)
setText('[data-result]', '$SuccessText$')
show('[data-result]')
```

One bridge call per line, kept verbatim → lightweight DSL mode (no iframe). If
this were complex logic instead, you'd write `src/script.ts` and esbuild would
compile it (running in iframe mode).

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

- `requireInputEquals` — validates the password input; halts the script and shows an error toast on mismatch.
- `progress` — animates the progress bar and syncs the percentage text.
- `setText` — sets the success message in the result element.
- `show` — reveals the hidden result element.
