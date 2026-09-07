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
regardless of aesthetic, and §3's warning about the grey accent applies to
any component that borrows the site's tokens; everything from §8 onward is
opinion.

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
| [`assets/site-native/tokens.css`](assets/site-native/tokens.css) | iframe | 3834 |
| [`assets/site-native/patterns.css`](assets/site-native/patterns.css) | iframe | 16989 |
| [`assets/site-native/dsl-core.css`](assets/site-native/dsl-core.css) | DSL | 270 |

"Counted size" is after the build strips comments — the number that actually
spends budget. Comments are free; whitespace is not (§7).

**Sources.** Token values, palette and skin behaviour were read from the live
`main-CXuixjDb.css` (sha256 `6936dbcc…`, 495992 bytes — the same build
`vendor/runtime.lock.json` pins, verified by hash). Behavioural claims about
the flattener are verified against `vendor/storyComponents.js`; the functions
named below (`Ce`, `ve`, `k`, `be`, `Q`) are the real minified identifiers.

---

## 1. Where the component actually renders

Everything below follows from one asymmetry.

| | DSL mode | iframe mode |
|---|---|---|
| Host | `.story-inline-component`, inside `.markdown-body`, inside the message | `srcdoc` iframe, opaque origin |
| Site `:root` tokens | **visible** — same document | **absent** — nothing crosses the boundary |
| Site skin rules (§4) | **apply to your elements** | **inert** |
| Inherited type | prose: 14–15px / 1.75 / `--tw-prose-body` | **nothing**; only a margin+`box-sizing` reset |
| Webfont (Inter) | inherited from the page | unavailable — CSP `font-src: data:` |
| Your CSS | flattened into inline `style` attributes | a real stylesheet |

So in DSL mode the component is *already* inside the design system and mostly
needs to stop fighting it. In iframe mode it is on bare metal and has to
restate the contract from scratch.

## 2. The alias rule

Declare tokens **on the component's own wrapper**, never on `:root`:

```css
.sn {
  --sn-ink: var(--text-primary, 30 41 59);
  --sn-surface: var(--bg-elevated, 255 255 255);
}
```

Two reasons, both mechanical:

- A scriptless component whose CSS matches `html`, `body` or `:root` is forced
  into iframe mode (regex `Q`). A `:root` token block silently changes the
  render mode.
- DSL mode never emits a `<style>` element. It runs each selector through
  `querySelectorAll` and merges the declarations into matching elements'
  inline `style`. A `:root` rule matches nothing and vanishes. A `.sn` rule
  lands on the wrapper as inline custom properties, which children inherit.

Custom properties and `var()` both survive the declaration filter (`Ce` admits
`^--[A-Za-z0-9_-]{1,64}$`; `ve` rejects only `javascript:`, `expression(`,
`@import` and over-256-char values). Verified — the flattened `stat-card`:

```html
<div class="sn" style="--nk:var(--bg-sunken,241 245 249);--na:59 130 246;…">
  <div class="sn-card" style="background:rgb(var(--nk));border:1px solid rgb(var(--nl));…">
```

## 3. Colour: the site is many-coloured, not one-accented

**The most important thing to get right, and the easiest to get wrong.**

`--color-primary-*` ships as a **zinc ramp** and is never overridden anywhere
in the stylesheet — there is exactly one definition of `--color-primary-500`
in all 5548 rules. It themes the user's message bubble
(`--bg-bubble-user: rgb(var(--color-primary-600))`) and very little else.

The vivid look of the real settings panel and function menu does **not** come
from an accent token. It comes from per-feature Tailwind hues applied
element by element: an amber toggle next to a violet one next to a blue one, a
wash-tinted icon tile per menu entry, tinted metric pills on a model card. A
settings list is deliberately many-coloured.

So a component that drives everything from `rgb(var(--color-primary-500))`
renders **grey and anonymous** beside the real UI. That is the single failure
mode this kit exists to prevent.

The kit therefore ships:

- `--sn-accent` — the chrome accent, **blue** (`59 130 246`), what the site
  uses for the active nav item and the send button. The default for buttons,
  focus rings and nav.
- `--sn-theme` — `var(--color-primary-500, 82 82 91)`, the separate hook for
  the few things that genuinely should follow the storyline's theme.
- **14 hue classes** — `.sn-hue-blue`, `-indigo`, `-violet`, `-purple`,
  `-pink`, `-red`, `-orange`, `-amber`, `-green`, `-emerald`, `-teal`,
  `-cyan`, `-sky`, `-slate`. Each sets four variables on the element:

  | Variable | Tailwind step | Used for |
  |---|---|---|
  | `--sn-h` | 500 | solid fills: toggle on, primary button, meter, dial arc |
  | `--sn-h-ink` | 600 | glyphs and pill text |
  | `--sn-h-tint` | 100 | pill backgrounds |
  | `--sn-h-wash` | 50 | icon-tile backgrounds |

  Put one on a row, tile, pill or card and every child follows. That is how
  you get the real UI's texture rather than a monochrome panel.

Structural colours stay on the site tokens, so they track the user's skin:
surfaces (`--bg-elevated`/`--bg-sunken`), ink (`--text-*`), and hairlines.

**Hairlines are the exception to the RGB-triple convention.**
`--border-subtle`, `--border-default` and `--border-strong` already carry
their own alpha (`0 0 0 / .06`), so they are used as `rgb(var(--sn-line))`
with **no** trailing slash. `rgb(var(--sn-line) / .5)` is invalid and drops
the whole declaration.

## 4. Free skinning: the site's own `data-ui-*` system

The client has a 22-axis skin system driven by attributes on `html`, with
**hook classes any element can opt into**:

| Hook class | Put it on |
|---|---|
| `.theme-surface-decorated` | panels and cards |
| `.theme-list-item` | rows |
| `.theme-button` | buttons |
| `.theme-input` | inputs and selects |
| `.theme-tab` | tab strips |
| `.theme-badge-decorated` | pills |

The axes include `data-ui-dialog`, `-button`, `-input`, `-list`, `-tab`,
`-surface-style`, `-control-style`, `-navbar`, `-bubble`, `-pattern`,
`-density`, `-motion` — values like `glass`, `brutal`, `luxury`, `storybook`,
`technical`, `editorial`, `pressed`, `ruled`.

The rules are written `html[data-ui-list=brutal] .theme-list-item { … }`, i.e.
plain descendant selectors. **In DSL mode your elements are in that document,
so adding the hook class inherits whatever skin the user picked** — radius,
shadow, border treatment and motion — for free. They set no colour or layout,
so your own rules still apply on top.

This is the cheapest way to look native, and the kit's patterns carry the
hooks where they make sense. In iframe mode the classes are inert: harmless,
but they do nothing, which is one more reason a DSL-mode component blends in
more convincingly than an iframe one.

## 5. Type

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

## 6. Space, radius, elevation, motion

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
transition at all (§7).

## 7. The DSL flattener: five verified constraints

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

## 8. Patterns

[`patterns.css`](assets/site-native/patterns.css) is a **menu, not a bundle**.
Taken whole it is 16989 of the 20000 combined `html`+`css`+`script` budget —
enough to put even a small component over the ceiling on its own. Copy the
blocks you use; the `choice-list` example does exactly that and lands at 5199.

| Class | Use |
|---|---|
| `.sn` | Wrapper. Restates the prose contract (iframe only) and holds the tokens. |
| `.sn-sheet` / `--modal` | Panel; the modal variant uses the site's own deep shadow. |
| `.sn-sheet-head`, `-icon`, `-title`, `-close` | Panel header. |
| `.sn-group`, `.sn-group-label` | Titled section. |
| `.sn-rows`, `.sn-row` + `--stack` / `--plain` | **The signature settings row**: hue-tinted surface, glyph, title, description, control. |
| `.sn-row-icon`, `-main`, `-title`, `-desc`, `-ctl`, `-head` | Row parts. |
| `.sn-hint` | Small grey advisory under a control. |
| `.sn-pill` + `--solid` / `--quiet`, `.sn-pills` | Value and metric pills. |
| `.sn-toggle` | Switch; on-state takes the row's hue. |
| `.sn-slider`, `.sn-scale` | Range with end/middle labels underneath. |
| `.sn-tiles`, `.sn-tile`, `-icon`, `-label` | Function-menu grid, auto-fit so it reflows instead of overflowing. |
| `.sn-nav`, `.sn-nav-item` | Sidebar; active is a solid accent fill. |
| `.sn-cards`, `.sn-card`, `.sn-card-title` | Model-picker card. |
| `.sn-tabs`, `.sn-tab`, `.sn-panel` | Tabs. |
| `.sn-btn` + `--primary` / `--soft` / `--secondary` / `--ghost` | Buttons, `min-height: 2.75em` ≈ the 41px touch floor. |
| `.sn-field`, `.sn-label`, `.sn-input`, `.sn-select`, `.sn-select-wrap` | Form controls. |
| `.sn-seg`, `.sn-step`, `.sn-check` | Segmented control, stepper, checkbox row. |
| `.sn-dials`, `.sn-dial`, `-svg`, `-arc`, `-knob`, `-val`, `-cap` | 270° gauge, draggable. |
| `.sn-bar`, `.sn-bar-fill` | Meter. |
| `.sn-kv`, `.sn-kv-k`, `.sn-kv-v` | Key/value rows. |
| `.sn-choices`, `.sn-list`, `.sn-option`, `.sn-option-idx` | Story choice list. |
| `.sn-table-wrap`, `.sn-table` | Table mirroring `.markdown-body table` exactly. |
| `.sn-rule`, `.sn-code` | Divider and inline code, both mirroring the prose. |

**Mirror the prose, don't reinvent it.** `.sn-table`, `.sn-rule` and
`.sn-code` copy `.markdown-body`'s own values (8px/12px cells, `#d1d5db`
borders, a `rgba(0,0,0,.04)` header, the `#ea580c` inline-code orange), so a
table inside a component and one written in the message are indistinguishable.

Two rules the runtime enforces for you, painfully, if you break them:

- **One wrapper element, `width: 100%`, no fixed px width.** The runtime
  measures `root.firstElementChild` and scales the *entire* component down if
  it overflows the bubble — everything becomes tiny at once.
- **No horizontal overflow.** Long URLs, IDs and unbroken CJK runs trigger the
  same downscale, which is why `.sn p/li/td` set `overflow-wrap: anywhere` and
  every grid is `auto-fit`. Wrap tables in `.sn-table-wrap`.

## 9. Worked examples

Build either with `node scripts/build.mjs <dir>`.

- [`examples/stat-card`](assets/site-native/examples/stat-card) — DSL tier,
  scriptless. **DSL mode, 632/1000 CSS chars** with the token core included.
  Sets no font-family: it inherits the prose.
- [`examples/choice-list`](assets/site-native/examples/choice-list) — iframe
  tier, **5199/20000**, copying only the kit blocks it uses rather than the
  whole of `patterns.css`.

`src/` is left to whatever component this repo is actually building; the kit is
never wired into it by default.

## 10. Checklist

- [ ] Tokens on the wrapper, never `:root`.
- [ ] Every structural alias is `var(--site-token, default)`.
- [ ] Colours as `rgb(var(--x) / a)`; hairlines without the slash.
- [ ] **Not driven by `--color-primary`.** Hue classes carry the colour;
      `--sn-accent` (blue) is the chrome default. A monochrome panel is the
      tell that this went wrong.
- [ ] Skin hooks (`.theme-list-item`, `.theme-button`, …) added where they
      apply — free in DSL mode, inert in iframe.
- [ ] DSL tier: no `font-family`, no base `font-size`, no hover, no motion,
      no data URIs, no `@media`, compact declarations.
- [ ] iframe tier: restate font, size, leading and colour on `.sn`.
- [ ] One wrapper, `width: 100%`, no fixed px width, no horizontal overflow;
      tables wrapped, grids `auto-fit`.
- [ ] Only the pattern blocks actually used were copied.
- [ ] `npm run build` reports the mode you intended and prints no warnings.
- [ ] `npm run preview` at a narrow width — no downscale, no clipped CSS.
