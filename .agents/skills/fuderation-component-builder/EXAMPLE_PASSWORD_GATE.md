# Example: Password Gate Component

## Component name

`PasswordGate`

## Parameters

| Name | Required | Purpose | Example |
|---|---|---|---|
| `Prompt` | yes | Instruction shown to user | `Enter the lab access code` |
| `Password` | yes | Correct answer | `7319` |
| `SuccessText` | yes | Text on success | `Underground lab unlocked` |

## Source code

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

<style>
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
</style>

<script>
requireInputEquals('[data-pass-field]', '$Password$', 'Wrong password')
progress('[data-progress-bar]', '[data-progress-text]', 1500)
setText('[data-result]', '$SuccessText$')
show('[data-result]')
</script>
```

## AI supplementary prompt

```
When you need the user to perform a door lock, terminal, safe, or access verification, use the "PasswordGate" component.
Output format:
<$PasswordGate$>
  <Prompt>description of what to verify</Prompt>
  <Password>correct password</Password>
  <SuccessText>text shown on success</SuccessText>
</$PasswordGate$>
Do not omit the outer tags. Parameter names must match exactly.
```

## AI invocation example

```html
<$PasswordGate$>
  <Prompt>Enter the underground lab access code</Prompt>
  <Password>7319</Password>
  <SuccessText>Underground lab unlocked</SuccessText>
</$PasswordGate$>
```

## Bridge functions used

- `requireInputEquals` — validates the password input; halts script and shows error toast on mismatch.
- `progress` — animates the progress bar and syncs the percentage text.
- `setText` — sets the success message in the result element.
- `show` — reveals the hidden result element.
