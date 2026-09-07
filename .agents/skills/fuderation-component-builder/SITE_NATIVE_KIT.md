# Site-native UI kit

> **This is one option, not this repo's house style.** It is for components that
> should disappear into the page — that read as something the chat renderer
> emitted, using the same surfaces, hairlines, radii and accent as the
> surrounding site. Plenty of good components want the opposite. Pick
> deliberately; see [§0](#0-when-to-use-this-kit-and-when-not-to).

This document defines how to get the site-native look, and why the usual
approach — a `:root` token block — is the one thing you must not do here.

## 0. When to use this kit (and when not to)

**Use it when** the component is chrome: a status panel, a stat readout, a
choice list, a settings row, an inventory table — anything whose job is to
present information the storyline owns, where a distinct visual identity would
read as noise. These want the site's tokens so that a theme change carries
them along for free.

**Do not use it when** the component *is* the content: a magic scroll, a
terminal, a pixel-art inventory, a cursed diary page, a neon quest board. A
storyline component is often supposed to be a set piece, and the
`frontend-design` skill's advice — commit hard to one aesthetic — applies in
full. Reaching for `sn-card` there produces exactly the anonymous, tasteful,
forgettable box that skill warns against.

**The middle path is common and supported.** Take `tokens.css` alone and skip
`patterns.css`: you inherit the theme's accent, the site's radii and the prose
type contract, then style the component however the storyline demands. That
keeps a set piece from clashing with the page around it without flattening it
into site chrome. §2's wrapper-alias rule is the part worth stealing
regardless of aesthetic; everything from §7 onward is opinion.

Nothing here is loaded automatically. `src/` does not depend on it, and a
component that ignores this file entirely is not doing anything wrong.

The token values here are taken from [`vendor/site-chat.css`](../../../vendor/site-chat.css),
extracted from the live client. Behavioural claims are verified against
[`vendor/storyComponents.js`](../../../vendor/storyComponents.js); the
functions named below (`Ce`, `ve`, `k`, `be`, `Q`) are the real minified
identifiers.

**Files**

| File | Tier | Counted size |
|---|---|---|
| [`assets/site-native/tokens.css`](assets/site-native/tokens.css) | iframe | 1993 |
| [`assets/site-native/patterns.css`](assets/site-native/patterns.css) | iframe | 5473 |
| [`assets/site-native/dsl-core.css`](assets/site-native/dsl-core.css) | DSL | 220 |

"Counted size" is after the build strips comments — the number that actually
spends budget. Comments are free; whitespace is not (see §6).

---

## 1. Where the component actually renders

Everything below follows from one asymmetry.

| | DSL mode | iframe mode |
|---|---|---|
| Host | `.story-inline-component`, inside `.markdown-body`, inside the message | `srcdoc` iframe, opaque origin |
| Site `:root` tokens | **visible** — same document | **absent** — nothing crosses the boundary |
| Inherited type | prose: 14–15px / 1.75 / `--tw-prose-body` | **nothing**; only a margin+`box-sizing` reset |
| Webfont (Inter) | inherited from the page | unavailable — CSP `font-src: data:` |
| Your CSS | flattened into inline `style` attributes | a real stylesheet |

So in DSL mode the component is *already* in the design system and mostly needs
to stop fighting it. In iframe mode the component is on bare metal and has to
restate the contract from scratch.

## 2. The alias rule

Declare tokens **on the component's own wrapper**, never on `:root`:

```css
.sn {
  --sn-ink: var(--text-primary, 30 41 59);
  --sn-accent: var(--color-primary-500, 82 82 91);
}
```

Two reasons, both mechanical:

- A scriptless component whose CSS matches `html`, `body` or `:root` is forced
  into iframe mode (regex `Q`). A `:root` token block silently changes your
  render mode.
- DSL mode never emits a `<style>` element. It runs each selector through
  `querySelectorAll` and merges the declarations into matching elements'
  inline `style`. A `:root` rule matches nothing and vanishes. A `.sn` rule
  lands on the wrapper as inline custom properties, which children inherit
  normally.

The `var(--site-token, default)` shape is what makes one file work in both
modes: in DSL mode the site token wins and the component tracks the live
storyline theme; in iframe mode the fallback wins. Verified — this is the
flattened output of the `stat-card` example:

```html
<div class="sn" style="--nk:var(--bg-sunken,241 245 249);--na:var(--color-primary-500,82 82 91);…">
  <div class="sn-card" style="background:rgb(var(--nk));border:1px solid rgb(var(--nl));…">
```

Custom properties and `var()` both survive the declaration filter (`Ce` admits
`^--[A-Za-z0-9_-]{1,64}$`; `ve` rejects only `javascript:`, `expression(`,
`@import` and over-256-char values).

## 3. Colour

Colours are **space-separated RGB triples**, consumed as `rgb(var(--x) / a)`.
That is the site's own convention and it is what makes alpha tints possible.

| Alias | Site token | Default |
|---|---|---|
| `--sn-surface` | `--bg-elevated` | `255 255 255` |
| `--sn-surface-sunken` | `--bg-sunken` | `241 245 249` |
| `--sn-surface-app` | `--bg-app` | `248 250 252` |
| `--sn-ink-strong` | `--text-strong` | `15 23 42` |
| `--sn-ink` | `--text-primary` | `30 41 59` |
| `--sn-ink-muted` | `--text-secondary` | `71 85 105` |
| `--sn-ink-faint` | `--text-tertiary` | `148 163 184` |
| `--sn-ink-on-accent` | `--text-on-brand` | `255 255 255` |
| `--sn-accent-soft` | `--color-primary-100` | `228 228 231` |
| `--sn-accent-muted` | `--color-primary-300` | `161 161 170` |
| `--sn-accent` | `--color-primary-500` | `82 82 91` |
| `--sn-accent-strong` | `--color-primary-700` | `39 39 42` |

**Hairlines are the exception.** `--border-subtle`, `--border-default` and
`--border-strong` already carry their own alpha (`0 0 0 / .06`), so they are
used as `rgb(var(--sn-line))` with **no** trailing slash. `rgb(var(--sn-line) / .5)`
is invalid and drops the whole declaration.

### Tint, don't pick

A container background of `rgb(var(--sn-accent) / .04)` reads as part of the
theme; `#f6f5fc` reads as a foreign box that happens to match today's theme.
Under an indigo theme the tint is lavender, under a crimson one it is blush,
and neither needed a second rule. Prefer accent-alpha over fixed greys for any
surface that should feel owned by the storyline.

### The accent default is deliberately quiet

`--color-primary-*` is what a storyline theme overrides — the shipped default
is a zinc ramp, which is why themed pages look indigo or crimson while the
extracted stylesheet does not. **An iframe-mode component cannot see that
override.** The defaults above are the shipped zinc ramp rather than a guessed
indigo, because a neutral accent stays quiet under every theme while a
hardcoded indigo actively clashes with half of them.

When an iframe-mode component genuinely must match the theme, pass the colour
in as a parameter and let the AI supply it:

```css
.sn { --sn-accent: $AccentRgb$; }   /* AI supplies e.g. 99 102 241 */
```

Parameter values are inserted into CSS **raw**, not escaped — keep such a
parameter to a documented, narrow shape and never interpolate free text.

## 4. Type

The base is `--chat-message-font-size` (default 15px) at `line-height: 1.75`,
in `--font-ui` (Inter first, then system stack).

- **DSL tier: set no `font-family` and no base `font-size`.** Both are already
  inherited from `.markdown-body`, correctly, including the user's font-size
  setting. Size leaf elements in `em` only.
- **iframe tier: restate it** — nothing is inherited. `patterns.css` sets
  `15px / 1.75 / var(--sn-font)` on `.sn`.

Leaf scale, in `em` so it composes with the inherited base (do not nest these —
`em` compounds):

| Role | Size | Weight | Colour |
|---|---|---|---|
| Title | `.9375em` | 600 | `--sn-ink-strong` |
| Body | `1em` | 400 | `--sn-ink` |
| Control label | `.875em` | 600 | `--sn-ink-muted` |
| Meta / caption | `.8125em` | 400 | `--sn-ink-faint` |
| Badge | `.75em` | 600 | `--sn-accent-strong` |

**Inter reaches DSL-mode components and not iframe-mode ones** (`font-src` is
`data:` only, and `@font-face` with a data URI is the only workaround). The
same component therefore sets slightly differently in the two modes. This is
not fixable; it is worth knowing before you blame your line-height.

## 5. Space, radius, elevation, motion

**Space is `em`, radius is `rem`.** Not an aesthetic preference:
`--chat-message-font-size` is a user setting, so `em` padding grows with the
message text and stays in proportion to the prose, while `rem` radii stay
locked to the site's chrome at 16px root in both modes. Scale:
`.25 / .375 / .5 / .75 / 1 / 1.25 / 1.75em` (`--sn-space-1` … `-7`).

Radii map straight through: `--sn-r-xs` `.25rem` → `--sn-r-2xl` `1.25rem`,
plus `--sn-r-full`. Cards use `--sn-r-xl`, rows and inputs `--sn-r-lg`/`-md`,
pills `--sn-r-full`.

Elevation is the site's four `--shadow-*` values. Inside a chat bubble the
bubble already carries the page's elevation, so a component should rarely go
past `--sn-shadow-sm`; use a hairline before you reach for a shadow.

Motion is `--duration-base` (.2s) on `--ease-out`
(`cubic-bezier(.16, 1, .3, 1)`), `--duration-fast` (.15s) for pressed states.
**Motion exists only in iframe mode** — DSL mode has no hover, focus or
transition at all (§6).

## 6. The DSL flattener: five verified constraints

These are the ones that bite. All confirmed by running the real `be()`/`k()`
logic from `storyComponents.js`.

1. **Comments are free, whitespace is not.** The build strips comments before
   counting, then trims — internal newlines and indentation are preserved and
   spend the 1000-char cap. Document DSL CSS generously; write the
   declarations compactly. This is why `dsl-core.css` is a dense one-liner.

2. **`@media` blocks do not protect their contents.** The docs say at-rules are
   "skipped"; what is actually skipped is the `@media (…)` *selector*. `be()`
   scans for any `selector{declarations}` pair, so the **nested rule is applied
   unconditionally, with the media condition discarded**:

   ```
   .sn{color:red}@media (min-width:0px){.sn{font-size:15px}}
   →  [{.sn, color:red}, {.sn, font-size:15px}]
   ```

   A component with a pure-DSL script keeps DSL mode even with an at-rule
   present, so its mobile overrides silently apply at every width. Do not put
   responsive styles in a component that might land in DSL mode.

3. **Vendor-prefixed properties are dropped.** `Ce` requires a property to
   start `[A-Za-z]`, so `-webkit-*` fails the filter and disappears. Write the
   unprefixed property; if you need both, iframe mode is the only place the
   prefixed one survives.

4. **A `;` inside a value corrupts the rest of the rule.** `k()` splits on `;`
   with no quote or paren awareness, so a data URI takes its own declaration
   *and its successors* down with it:

   ```
   .b{background:url("data:image/svg+xml;base64,AAA");color:blue}
   →  background:url("data:image/svg+xml    ← and color:blue is gone
   ```

   Keep data URIs out of DSL-mode CSS entirely.

5. **Only structural selectors match, once.** `:hover`, `:focus`, `:active`
   match nothing (the template is never rendered); `::before`/`::after` throw
   and skip the rule. `:nth-child()` and friends *do* match, but resolve at
   flatten time and never re-apply — so a DSL script that changes the DOM will
   not restyle it. Change appearance with `addClass`/`setStyle`, never by
   relying on a selector to re-match.

Design consequence: **a DSL-tier component must be flat.** No hover, no
motion, no pseudo-element ornament. Carry state with an explicit class the
script toggles. If the design needs any of that, put it in iframe mode
(`(() => {})();` in `script.js` is the cheapest way) and use the full tier.

## 7. Patterns

[`patterns.css`](assets/site-native/patterns.css) is a **menu, not a
bundle** — copy the blocks you use. Taken whole it costs 5473 of the 20000
combined `html`+`css`+`script` budget, which is affordable but rarely
necessary.

| Class | Use |
|---|---|
| `.sn` | Wrapper. Restates the prose contract (iframe only) and holds the tokens. |
| `.sn-card` / `--plain` | Accent-tinted container / white elevated container. |
| `.sn-head`, `.sn-title`, `.sn-meta` | Heading row. |
| `.sn-list`, `.sn-option`, `.sn-option-idx` | Choice rows. |
| `.sn-btn` + `--primary` / `--secondary` / `--ghost` | Buttons, `min-height: 2.75em` ≈ the 41px touch floor. |
| `.sn-badge` / `--quiet` | Status pill. |
| `.sn-field`, `.sn-label`, `.sn-input` | Form control. |
| `.sn-kv`, `.sn-kv-k`, `.sn-kv-v` | Key/value rows. |
| `.sn-bar`, `.sn-bar-fill` | Meter. |
| `.sn-rule` | Divider matching `.markdown-body hr`. |
| `.sn-code` | Inline code matching `.markdown-body code`, orange included. |

Two rules the runtime enforces for you, painfully, if you break them:

- **One wrapper element, `width: 100%`, no fixed px width.** The runtime
  measures `root.firstElementChild` and scales the *entire* component down if
  it overflows the bubble — everything becomes tiny at once. A bare list of
  siblings measures wrong.
- **No horizontal overflow.** Long URLs, IDs and unbroken CJK runs trigger the
  same downscale, which is why `.sn p/li/td` set `overflow-wrap: anywhere`.
  That rule is load-bearing, not cosmetic.

The index in `.sn-option` is a real `<span>`, not `::marker` or `::before`,
so the markup stays portable to DSL mode.

## 8. Worked examples

Both build clean with no warnings (`node scripts/build.mjs <dir>`).

- [`examples/stat-card`](assets/site-native/examples/stat-card) — DSL tier,
  scriptless. Lands in DSL mode at **632/1000 CSS chars**, token core
  included, 368 spare. Sets no font-family: it inherits the prose.
- [`examples/choice-list`](assets/site-native/examples/choice-list) — iframe
  tier. The themed option list, **8729/20000** total, with hover, focus rings
  and `fillInput` on click.

## 9. Checklist

- [ ] Tokens on the wrapper, never `:root`.
- [ ] Every alias is `var(--site-token, default)`.
- [ ] Colours as `rgb(var(--x) / a)`; hairlines without the slash.
- [ ] Accent tints instead of fixed greys for themed surfaces.
- [ ] DSL tier: no `font-family`, no base `font-size`, no hover, no motion,
      no data URIs, no `@media`, compact declarations.
- [ ] iframe tier: restate font, size, leading and colour on `.sn`.
- [ ] One wrapper, `width: 100%`, no fixed px width, no horizontal overflow.
- [ ] `npm run build` reports the mode you intended and prints no warnings.
- [ ] `npm run preview` at a narrow width — no downscale, no clipped CSS.
