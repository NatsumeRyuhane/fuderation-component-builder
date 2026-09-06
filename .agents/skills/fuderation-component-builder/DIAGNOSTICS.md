# Self-diagnostic components

Use these fixtures when changing comment stripping, identifier renaming, mode
detection, dense data packing, or the preview bridge. Their source, build helper, and functional tests
live in this skill. They use the repository's normal assembler and vendored
runtime, so run the commands from the repository root after `npm ci`.

```bash
npm run build:diagnostics
npm run test:diagnostics
npm run preview
```

The build writes a `component.json` inside each directory below. Generated JSON
is gitignored; edit each fixture's authored `src/` files and rebuild. The
packed-data fixture also has two generated TypeScript modules; see regeneration
below. These
fixtures do not replace the component in the repository's root `src/`.

| Fixture directory | Import name | Mode | Expected functional result |
|---|---|---|---|
| [assets/diagnostics/dsl](assets/diagnostics/dsl) | `DiagnosticDSL` | DSL | Click **Run checks**: five assertions pass, progress reaches 100%, then a success toast appears. |
| [assets/diagnostics/dsl-guard](assets/diagnostics/dsl-guard) | `DiagnosticDSLGuard` | DSL | Click **Run negative control**: status becomes ARMED, an EXPECTED rejection toast appears, and NOT REACHED stays unchanged. |
| [assets/diagnostics/iframe](assets/diagnostics/iframe) | `DiagnosticIframe` | iframe | Mount runs ten checks automatically; each reports PASS or FAIL with a reason. The rerun button runs them again. |
| [assets/diagnostics/iframe-data](assets/diagnostics/iframe-data) | `DiagnosticPackedData` | iframe | Mount runs six data checks automatically; the rerun button resets and repeats them. |

In the local renderer, choose **载入 component.json…** or drag in the generated
file. Confirm the displayed mode. All four fixtures have no parameters, so the
renderer can compose their invocations automatically. In a Workshop storyline,
import the four exports and use:

```text
<$DiagnosticDSL$></$DiagnosticDSL$>
<$DiagnosticDSLGuard$></$DiagnosticDSLGuard$>
<$DiagnosticIframe$></$DiagnosticIframe$>
<$DiagnosticPackedData$></$DiagnosticPackedData$>
```

## What the components assert

The positive DSL fixture stays below 1,000 processed CSS characters and uses 31
top-level calls, within the 32-call limit. It calls `setValue`, `setText`,
`saveToLocal`/`readFromLocal`, `addClass`/`removeClass`, and `progress`, then checks
their results with `requireInputEquals`. A selector requiring the new class and
excluding the old class makes the class assertion inspect the resulting DOM.
Storage is reset before its round trip so an old saved success cannot pass.
Literal slashes, comment markers, Unicode, and exact input spaces must survive.
Its deliberately long CSS comment must disappear so the final swatch rule still
fits in the DSL CSS budget.

Each row becomes PASS only after its assertion succeeds. A failed assertion
halts subsequent calls: the summary remains RUNNING, the failing and remaining
rows remain PENDING, and the toast identifies the failed operation. Reload the
fixture before each DSL run to reset DOM state. `show`, `hide`, and `setStyle`
also run, with visible probes for manual confirmation. Dynamic class styling is
not expected: DSL CSS is flattened once before execution.

The negative control exercises `wait` and the rejection path of
`requireInputEquals`. All three displayed observations are required. NOT RUN
alone is not success. Pure DSL cannot write a PASS marker after a correct halt;
if execution continues, the following calls visibly write FAIL and REACHED.
Reload before rerunning this fixture as well.

The iframe fixture explicitly selects iframe mode with `(() => {})();`. Its ten
checks cover closures/shadowing/destructuring, public keys and inferred names,
literal preservation, text/input writes, both equality results, class mutation,
visibility/style changes, awaited storage, wait/progress sequencing, and a
registered click handler. Each check has a timeout and catches errors so later
checks can still run. Probe resets prevent previous runs from supplying stale
successes. The expected mismatch emits one rejection toast; iframe code asserts
the returned `false` itself. The fixture exercises selective local renaming,
including preservation of escaped component-tag literals and observable names.

## Packed-data diagnostic

`DiagnosticPackedData` is **iframe-only**: a decoder requires JavaScript beyond
pure DSL. The existing DSL fixtures cover their supported bridge behavior.
The data fixture carries 18,002 deterministic bytes (all 256 byte values) in
9,602 Base32768 characters, plus a separately packed UTF-8 JSON sample. The
complete export currently uses 16,379 characters including UI and codec; its
binary payload alone would need 24,004 characters in Base64.

Its six independent checks cover:

1. Exact byte length and every byte against a fixed expected pattern.
2. Decoded Chinese, emoji, combining marks, literal markup, dollar placeholders,
   newlines, and NUL; the readable sample is rendered as text.
3. An upstream known vector, 32 byte lengths spanning the padding cases, and
   stability under all four Unicode normalization forms.
4. Rejection of ASCII, a surrogate pair, bad padding, and a secondary character
   before the end of the input.
5. All 9,602 packed characters through input and text bridges, then byte validation.
6. Awaited device-local storage reset, exact string readback, and decoded bytes.

Each check reports PASS or FAIL with a reason, and later checks continue after a
failure. DOM probes and storage are reset so a previous success cannot satisfy
a rerun. The rerun button is disabled while running. Visual observations remain
manual; the textarea exposes the full packed string without creating a wall of
page-height text.

The generated `src/payload.ts` and `src/text-payload.ts` are checked in so the
normal assembler works directly. Do not edit their encoded strings. The binary
pattern lives in [scripts/generate-packed-diagnostic.mjs](scripts/generate-packed-diagnostic.mjs),
and the readable JSON source is [assets/diagnostics/iframe-data/data/text.json](assets/diagnostics/iframe-data/data/text.json).
After intentionally editing the source data, regenerate with:

```bash
node .agents/skills/fuderation-component-builder/scripts/generate-packed-diagnostic.mjs
npm run build:diagnostics
npm run test:diagnostics
npm run typecheck
```

The generator uses the same [pack-data.mjs](scripts/pack-data.mjs) helper as real
components. Tests check deterministic regeneration, the final character budget,
and literal Unicode after minification. If intentionally changing the payload's
size or pattern, update its independent runtime assertions and displayed counts.
The normal typecheck includes all diagnostic TypeScript modules.

## Visual checklist

Inspect each fixture at **320px and 480px bubble widths**. The border should be
fully visible, long text should wrap, and controls should remain readable. The
DSL sheet includes reveal/hide, color-change, and progress probes. The iframe
sheet also includes distinct color swatches, a checker pattern, CSS-generated
literal text, hover/focus outlines, and keyboard observations. Use Tab to reach
the buttons and checkboxes, Space to toggle, and Enter to activate a button.

Only mark the iframe's visual checkboxes after observing those results. Its
manual count is independent of the automatic result and persists across a rerun.
The DSL sheets display an observation checklist without claiming that DSL can
inspect layout or render a PASS after a guard has halted.

## Automated coverage and its limits

[tests/diagnostics.test.mjs](tests/diagnostics.test.mjs) builds the fixtures, then
renders their invocation through the checked-in runtime in JSDOM. It verifies
sanitization, actual mode dispatch, DSL CSS flattening, and the runtime's iframe
document and injected bridge. An in-memory host handles the iframe's real
asynchronous `postMessage` requests. Both comment-stripped and renamed iframe
scripts must pass. Reruns and manual-checklist state are also exercised.

[tests/packed-data.test.mjs](tests/packed-data.test.mjs) also verifies the packed
fixture after JSON export, with invalid and valid-but-corrupted payloads,
truncation, invalid UTF-8, broken DOM writes, corrupted storage, and stale reruns.
JSDOM lacks `TextDecoder`, so the harness supplies Node's standard implementation;
this does not establish browser API availability or CSP behavior.

Tests deliberately remove DSL operations and break iframe bridges/host storage
to prove that the checklists detect failures. The negative control is tested
both with a rejecting guard and a guard that permits execution to continue.

DSL execution uses the local preview's reconstructed interpreter, because the
site's click-handler/interpreter code is not available in the vendored assets.
Its halt behavior follows the documented contract; confirm the negative control
in a real storyline. JSDOM does not verify browser layout, CSP enforcement,
physical keyboard interaction, or visible rendering. The manual checklist and
a real storyline playtest remain necessary for those observations and for AI
invocation. `npm test` includes this suite in CI.

Fixtures use only `fcb.diagnostics.dsl.v1`, `fcb.diagnostics.iframe.v1`, and
`fcb.diagnostics.packed.v1` storage keys, plus diagnostic toasts. They do not exercise message editing, navigation,
clipboard actions, or world-info access. These are focused regression fixtures,
not exhaustive coverage of every bridge function.
