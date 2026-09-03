# Local component preview

```bash
npm run preview          # http://localhost:5173
npm run preview -- --open --port 5199
```

Renders `src/` inside a mock chat bubble using the **real Fuderation runtime**,
frozen in [`vendor/`](../../vendor/). Edits to `src/` reload automatically.

Workshop's own preview mounts everything in an iframe, does not substitute
`$param$` placeholders, and cannot run the host bridge. This one does all three,
so it shows what a playtest would — including the failure modes that are
invisible until you playtest.

## What is real vs. simulated

| | Source |
|---|---|
| Message parsing, `$param$` substitution, escaping, code-fence handling | **Vendored runtime**, unmodified |
| DSL-vs-iframe mode dispatch | **Vendored runtime** |
| CSS flattening to inline styles (DSL mode) | **Vendored runtime** |
| HTML sanitizing (DSL mode) | **Vendored runtime** + DOMPurify |
| The iframe document, its CSP, the resize protocol | **Vendored runtime** |
| Injected `[组件使用说明]` system prompt | **Vendored runtime** |
| Mounting the iframe, sizing it | Ours — the site's mount code is not in any reachable chunk |
| DSL interpreter and click binding | Ours — same reason ([`dsl.js`](dsl.js)) |
| The host: toast, fillInput, changeMsg, storage, world book | Ours — a simulation ([`host.js`](host.js)) |
| The bubble chrome | Ours, and deliberately not styled like the real app |

Anything marked *ours* is reconstructed from the observed contract and recorded
in [`RUNTIME_INTERNALS.md`](../../.agents/skills/fuderation-component-builder/RUNTIME_INTERNALS.md).
Treat those details as best-effort; everything else behaves exactly as it will
in a real chat.

## What it catches that a playtest makes you hunt for

- **Which mode you are in**, and why — shown in the Render mode panel.
- **CSS silently truncated** at the 1000-char DSL cap, or `:hover`/`@keyframes`
  quietly doing nothing because you are in DSL mode.
- **Auto-downscale**: switch the bubble to 320px and watch a fixed-width
  component get scaled into unreadability.
- **Tags stripped by the sanitizer** — `canvas`, `form`, `header` and friends.
- **`getMsgContent()` returning empty** on a top-level call in iframe mode.
- **`changeMsg` round-trips**: a self-switching component actually switches,
  repeatedly, because the message box is rewritten and re-parsed for real.
- **An empty `ai_prompt`**, flagged as a warning — the component would never be
  invoked in play.

## The panels

**Chat bubble** — the component at a chosen bubble width (320 / 360 / 480 / 680).
The width is what the runtime's `autoScaleRoot()` measures against, so switching
it is the fastest way to find layout that breaks on mobile.

**Chat input** — `fillInput()` writes here, as it would in the real client.

**Message source** — the raw assistant message being parsed. Edit it to change
parameters, add prose around the component, or invoke it twice in one message.
`changeMsg()` rewrites this box for real, which is what makes state machines
testable.

**Render mode** — the resolved mode, the reason, and warnings.

**Injected system prompt** — exactly what the storyline tells the model about
this component. Empty `ai_prompt` shows up here as nothing at all.

**Host activity** — every bridge call that reached the host: toasts, clipboard,
storage reads/writes, world-book lookups, message edits. `reset storage` clears
the preview's `localStorage` namespace.

## Trying a component without touching `src/`

The page exposes a debug hook:

```js
__preview.setComponent(
  { name: 'Demo', html: '<div>$T$</div>', css: '.x{}', script: '' },
  '<$Demo$><T>hello</T></$Demo$>',
);
```

Useful for pasting someone else's component in, or for driving the page from a
headless browser.

## Refreshing the frozen runtime

```bash
npm run vendor:runtime              # verify the committed copy
npm run vendor:runtime -- --update  # re-fetch from the live site
```

See [`vendor/README.md`](../../vendor/README.md) — including the licensing note,
which matters if you fork this repo.
