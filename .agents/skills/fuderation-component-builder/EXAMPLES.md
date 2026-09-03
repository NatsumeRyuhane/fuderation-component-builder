# Component patterns (annotated real-world examples)

Working components contributed by **Charlin** (Fuderation site official), plus
the techniques they demonstrate. None of them were authored with this template —
they were pasted straight into the Workshop single-field editor — so each entry
shows how it maps onto this repo's `src/` layout and flags anything that would
break or behave surprisingly.

The exported JSON for each is vendored under
[`reference/components/`](reference/components/) if you need the exact source.

Verified against runtime `storyComponents-DHDQXgJC.js` on 2026-09-03; the
mechanics behind each note are in [RUNTIME_INTERNALS.md](RUNTIME_INTERNALS.md).

| Pattern | What it teaches | Mode |
|---|---|---|
| [Media card](#1-media-card-videocom) | `$param$` into `src`, optional params, click handlers | iframe |
| [Randomiser](#2-randomiser-dice) | `fillInput` to drive the story, `$id$` scoping, range tables | iframe |
| [Self-switching message](#3-self-switching-message-openning) | A component that rewrites its own message to change state | iframe |
| [Two-component state machine](#4-two-component-state-machine-cyberpanelalpha--cyberpanelbeta) | State carried in the message text, no `$param$` at all | iframe |
| [Full-document paste](#5-full-document-paste-word) | What the single-field editor does with a whole HTML file — and what the CSP eats | iframe |

> Every one of these is **iframe mode** — each has a real-JS script. Nothing
> here runs in DSL mode, so nothing here is subject to the DSL CSS flattening
> described in [SKILL.md → Execution modes](SKILL.md#execution-modes).

---

## 1. Media card (`VideoCom`)

A titled video player with an optional description and a copy-link button.

**`src/markup.html`**

```html
<div class="template-player">
  <div class="template-header">
    <span class="template-icon">▶</span>
    <span class="template-title">$标题$</span>
  </div>
  <video id="template-video" controls preload="metadata" width="100%"
         style="border-radius:12px;background:#0a0a0f;display:block;">
    <source id="video-source" src="$视频地址$" type="video/mp4">
    您的浏览器不支持视频播放。
  </video>
  <div class="template-desc" data-desc style="display:none;">$说明文字$</div>
  <div class="template-actions">
    <button class="btn-copy" data-copy-btn>复制视频链接</button>
  </div>
</div>
```

**`src/script.ts`** (original was raw JS in the single field)

```ts
const desc = '$说明文字$'
if (desc && desc.trim() !== '' && desc.trim() !== '$说明文字$') {
  setText('[data-desc]', desc)
  show('[data-desc]')
}

setValue('#template-video', '$视频地址$')
setValue('#video-source', '$视频地址$')

const btn = document.querySelector('[data-copy-btn]')
btn?.addEventListener('click', () => {
  const src = (document.getElementById('template-video') as HTMLVideoElement)?.src || ''
  if (src) { copyText(src); toast('视频链接已复制', 'success') }
  else { toast('未找到视频地址', 'error') }
})
```

### Techniques

- **Optional parameter idiom.** When the AI omits `<说明文字>`, the substitution
  yields an empty string — but authors often also guard against the *literal*
  `$说明文字$` leaking through. Only the empty case actually happens: an
  unsupplied param substitutes to `''`, never to itself. Keeping both checks is
  harmless and makes the intent obvious.
- **`src` via `setValue`, not `setStyle`.** `setValue` writes `src` for
  `img`/`video`/`audio`/`source`. Setting both `<video>` and its `<source>`
  covers browsers that ignore a late `<source>` change.
- **Click handlers require iframe mode.** `addEventListener` trips the
  advanced-JS detector, which is what you want here — a DSL script fires once,
  on click of the whole component, and cannot bind per-button behaviour.

### What to fix if you adapt it

- **`'$说明文字$'` and `'$视频地址$'` sit inside JavaScript string literals.**
  Parameters are inserted into `script` *raw* (only `html` is escaped), so an
  apostrophe, backslash or newline in either value breaks the literal — and a
  crafted value can append statements that run with the component's full bridge
  access. This is the shipped code, reproduced faithfully; do not copy it. Park
  the values in hidden markup and read them back:

  ```html
  <span data-desc-src hidden>$说明文字$</span>
  <span data-video-src hidden>$视频地址$</span>
  ```

  ```ts
  const desc = document.querySelector('[data-desc-src]')?.textContent ?? ''
  const src  = document.querySelector('[data-video-src]')?.textContent ?? ''
  ```

  `Dice` (`$id$`, `$sides$`), `openning` (`$selection$`) and `word`
  (`$finalChar$`) all have the same shape. See cross-cutting rule 4.
- The `<video>` carries an inline `style` attribute. That survives the DSL-path
  sanitizer, but put it in `styles.css` anyway — inline styles are the one thing
  the CSS-flattening path *also* writes to, so they can be silently merged over.
- `max-width` is `100%` but there is no cap; a wide bubble stretches the card.
  Add `max-width: 360px` per the bubble-width rules.
- **The `description` field disagrees with the component name.** The export is
  named `VideoCom`, but its description holds a sample invocation reading
  `<$模板预览$>…`. Descriptions are creator-facing notes that the AI never sees, so
  this costs nothing at runtime — but it is exactly the kind of drift that makes
  a component look broken. Keep the invocation example in `ai_prompt`, where the
  model actually reads it, and keep the name in it consistent.

---

## 2. Randomiser (`Dice`)

A d20-style roller. Animates, picks a number, matches it against a range table,
then **types the result into the chat input** so the story model reacts to it.

**Parameters:** `$id$` (unique suffix), `$label$`, `$sides$`, `$options$`.

**`src/script.ts`** (abridged)

```ts
const id = '$id$'
const sides = parseInt('$sides$') || 20
const btn = document.getElementById('roll_btn_' + id)
// …shake animation on an interval, then:
const finalPoint = Math.floor(Math.random() * sides) + 1
const raw = document.getElementById('opt_raw_' + id)!.innerText
const rangeRegex = /(\d+)\s*-\s*(\d+)\s*:\s*([^|]+)/g
let match, matchedDesc = ''
while ((match = rangeRegex.exec(raw)) !== null) {
  if (finalPoint >= +match[1] && finalPoint <= +match[2]) { matchedDesc = match[3].trim(); break }
}
fillInput('骰子结果：' + finalPoint + ' ' + matchedDesc)
```

### Techniques

- **`fillInput` as the story hook.** The component does not narrate the outcome
  itself; it stages text in the chat box so the *user* sends it and the model
  responds in character. This is the cleanest way to make a widget affect the
  plot.
- **A structured parameter.** `$options$` carries a whole table
  (`1-5:大失败|6-15:普通|16-20:大成功`) in one param, parsed client-side. Cheaper
  than eight separate params, and well under the 8-param accuracy ceiling.
- **Hidden param carrier.** `<div id="opt_raw_$id$" style="display:none">$options$</div>`
  parks the raw value in the DOM instead of inlining it into the script. This
  matters: params substituted into **HTML are escaped**, params substituted into
  **script are not**, so a value containing a quote would break an inline script
  literal. Reading it back out of the DOM is the safe idiom.
- **`$id$` scoping.** Every element id is suffixed with `$id$` so two dice in one
  message do not collide. The runtime does support repeated invocations of the
  same component in one message.

### What to fix if you adapt it

- `.dice-container { width: 260px }` is a **fixed** width. On a narrow bubble
  the runtime's `autoScaleRoot()` shrinks the entire component with a CSS
  transform, making the text unreadably small. Use `width:100%; max-width:260px`.
- `window.fillInput` / `window.tempAppendMsg` are accessed defensively via
  `if (window.fillInput)`. In iframe mode they are always defined; the guard is
  only needed if you expect to run outside the runtime.
- `<Achievement detail="…">今日手气</Achievement>` passed to `tempAppendMsg` is a
  separate storyline markup feature, not a component feature.

---

## 3. Self-switching message (`openning`)

Two pixel-art buttons that swap a storyline's opening text. Clicking a button
**rewrites the whole assistant message** to the new opening *plus a fresh call
to the same component* — so the switcher stays on screen, ready for the next
click.

**`src/script.ts`**

```ts
const selected = '$selection$'
const btn1 = document.querySelector('[data-choice="1"]')!
const btn2 = document.querySelector('[data-choice="2"]')!

btn1.removeAttribute('data-active'); btn2.removeAttribute('data-active')
;(selected === '2' ? btn2 : btn1).setAttribute('data-active', 'true')

const text1 = '【开场白 1】\n你站在一片像素废墟之中…'
const text2 = '【开场白 2】\n雨夜，霓虹灯在积水路面倒映出破碎的光…'

const d = String.fromCharCode(36)          // '$' — see "Escaping" below
const call = (n: string) =>
  '<' + d + 'openning' + d + '>' +
  '  <selection>' + n + '</selection>' +
  '</' + d + 'openning' + d + '>'

btn1.addEventListener('click', () => changeMsg(text1 + '\n\n' + call('1')))
btn2.addEventListener('click', () => changeMsg(text2 + '\n\n' + call('2')))
```

### Techniques

- **Re-invocation is the state mechanism.** There is no component-local state.
  `changeMsg` persists new message text; the runtime re-parses it and re-renders
  the component with the new `<selection>` value. The message *is* the store.
- **Always re-emit the component call.** Drop it and the switcher disappears
  after the first click.
- **CSS attribute selector for the active state** (`[data-active="true"]`) rather
  than a class — set with `setAttribute`, styled entirely in CSS.

### Escaping `$` — two ways, prefer the first

Writing `<$openning$>` literally inside your source would be eaten by the
parameter substituter, which treats `$…$` as a placeholder. Two workarounds:

```js
changeMsg('<\$openning\$><selection>1</selection></\$openning\$>')   // ✅ official
```

Backslash-escaping is documented in the official guide and implemented in the
substituter: it counts preceding backslashes, strips the escape, and leaves a
literal `$`. Works in HTML, CSS and script.

```js
var d = String.fromCharCode(36)                                       // ⚠️ also works
changeMsg('<' + d + 'openning' + d + '>…')
```

Charlin's note recommends this one, and it is bulletproof (the substituter never
sees two `$` on one line). It is just noisier. Use `\$…\$` unless you are pasting
through a toolchain that mangles backslashes.

---

## 4. Two-component state machine (`CyberPanelAlpha` / `CyberPanelBeta`)

Two separate components that call each other. Alpha renders a cyan "online"
terminal with a *switch to Beta* button; Beta renders an amber "standby"
terminal with a *back to Alpha* button. Clicking either replaces the message
with a call to the other, carrying the current title and subtitle across.

**`src/script.ts`** (Alpha; Beta is the mirror image)

```ts
const raw = getMsgContent() || ''
const d = String.fromCharCode(36)

function extract(tag: string): string {
  const m = raw.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'i'))
  return m ? m[1].trim() : ''
}

setText('#alphaTitle', extract('title') || 'Alpha 终端')
setText('#alphaSubText', extract('subText') || '主链路已激活 · 数据加密通道稳定')

document.getElementById('alphaSwitchBtn')!.addEventListener('click', () => {
  changeMsg(
    '<' + d + 'CyberPanelBeta' + d + '>' +
    '<title>' + (extract('title') || 'Alpha 终端') + '</title>' +
    '<subText>' + (extract('subText') || '主链路已激活 · 数据加密通道稳定') + '</subText>' +
    '</' + d + 'CyberPanelBeta' + d + '>'
  )
})
```

### Techniques

- **No `$param$` placeholders at all.** The scripts read the *raw message text*
  with `getMsgContent()` and regex out `<title>` / `<subText>` themselves. The
  *idea* is sound — after `changeMsg` the message body literally is the component
  invocation, tags and all, so one regex serves both the AI's first call and
  every self-call. The *execution* is broken; see the caveat below.
- **State travels in the tags.** Each switch re-emits the current values, so the
  panel keeps its content across an unlimited number of flips.
- **Scoped class names** (`.cyber-*-alpha` vs `.cyber-*-beta`) keep two sibling
  components from bleeding styles into each other.
- **Nesting.** Charlin notes you can nest `<div>` structures to compose panels
  within a single component; the parser also supports nesting the *same*
  component tag inside itself via depth counting.

### Caveats

- **⚠️ This pair does not actually carry its state — the top-level
  `getMsgContent()` always returns `''`.** In iframe mode the generated document
  hardcodes `window.__storyComponentMsgContent = ''` (unlike the avatars, which
  *are* seeded with real values). `getMsgContent()` posts a request to the host
  and synchronously returns that cached empty string; the reply lands later. So
  `var raw = getMsgContent()` at the top of the script reads `''` on **every**
  mount, `extract()` finds nothing, and both panels always fall back to their
  hardcoded defaults. The title/subText handed over in the tags is silently
  dropped. Verified by running the real runtime under `npm run preview`.

  The fix is to defer the read until after the host has answered:

  ```js
  getMsgContent();                    // fire the request
  setTimeout(function () {
    var raw = getMsgContent() || '';  // now populated
    // …render from raw…
  }, 60);
  ```

  Or, better for this particular job, take the state from `$param$`
  placeholders instead — they are substituted into the HTML before the document
  is ever built, so they need no round-trip at all.
- `.cyber-*-container { max-width: 400px }` is wider than the ~320–360 px this
  repo recommends; on a narrow bubble it triggers the auto-downscale.
- Both scripts run **on mount**, which is why the panel renders its title before
  any click. A DSL-mode script would not — it only fires on click.

---

## 5. Full-document paste (`word`)

A cyberpunk "letters freeze into place" animation, pasted into the editor as a
**complete HTML file** — `<!DOCTYPE html>`, `<head>`, `<link>`, `<style>`,
`<body>`, `<script>`, the lot. Parameters: `$finalChar$`.

The editor accepted it and split it automatically:

| Export field | Contents |
|---|---|
| `source` | 15 276 chars — the whole document exactly as typed |
| `html` | 1 211 chars — the body, unwrapped |
| `css` | 7 481 chars — every `<style>` block, concatenated |
| `script` | 6 211 chars — every `<script>` block, concatenated |

### Techniques

- **Whole-file paste works.** You do not have to hand-split a design into three
  parts; `<!doctype>/<html>/<head>/<body>` are stripped and the rest is sorted by
  tag. This repo's build produces `html`/`css`/`script` directly and leaves
  `source` empty, which the importer accepts equally.
- **`description` as a parameter reminder.** The author put
  `请传入<finalChar>HELLO</finalChar>参数` in the description field. That is a note
  to *the creator*, not to the AI — the AI only ever sees `ai_prompt`, which is
  empty here, so the model would never invoke this component on its own.

### What to fix if you adapt it

- **The web font never loads.** The document pulls Orbitron from
  `fonts.googleapis.com`. The iframe CSP is `style-src 'unsafe-inline'` and
  `font-src data:` — an external stylesheet link is blocked outright, silently,
  with no console error visible to the creator. Every `font-family: 'Orbitron'`
  falls back to `monospace`. Inline an `@font-face` with a `data:` URI, or design
  around a system font stack.
- **`html`+`css`+`script` totals 14 903 chars** against a 20 000 limit. A design
  this heavy leaves little headroom; most of the CSS is animation keyframes that
  a shorter rule set would cover.
- `ai_prompt` is empty. Add one, or the component is unreachable in play.

---

## Cross-cutting rules these examples establish

1. **Anything with a click handler is an iframe component.** Accept it and use
   real CSS; do not contort the script back into DSL form.
2. **Pick the store by what the state is for.** `saveToLocal`/`readFromLocal`
   persist across reloads too, but only on *this device and browser*, and the
   model never sees them — right for per-player preferences, wrong for story
   state. `changeMsg` + re-emitting your own tag puts the state in the message
   text, so it follows the conversation across devices and is visible to the AI;
   that is the storyline's real memory, and the only option for anything the
   model must be able to read back.
3. **Escape `$` when writing component tags from a script** — `\$Name\$`, or
   `String.fromCharCode(36)`.
4. **Params go into HTML escaped, into script raw.** Park untrusted or
   punctuation-heavy values in a hidden element and read them from the DOM.
5. **Never a fixed outer width.** Three of these examples get this wrong and pay
   for it with the auto-downscale.
6. **No external fonts, ever.** `font-src` is `data:` only and external
   stylesheets are blocked — a Google Fonts link fails silently and you get the
   fallback stack. Design for system fonts or inline the face as a `data:` URI.
7. **An empty `ai_prompt` makes the component invisible.** Only components with a
   non-empty prompt are listed to the model. **All six** of these exports ship
   with an empty `ai_prompt` — they were shared as source to learn from, not as
   drop-in imports. Write one before you play-test anything adapted from them.
