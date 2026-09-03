# Reference material

Vendored, read-only source material for the `fuderation-component-builder`
skill. Nothing here is built or imported by this repo — it exists so the skill
can cite exact upstream text instead of paraphrasing it.

## `OFFICIAL_GUIDE_zh.md`

The official Workshop component creator guide, verbatim (Chinese). Extracted
from the shipped `assets/UserGuide-*.js` chunk on 2026-09-03 and byte-identical
to the copy distributed by Charlin.

This is the **source of truth for intent**. When it disagrees with
[`../RUNTIME_INTERNALS.md`](../RUNTIME_INTERNALS.md), the guide describes what
the platform means to do and RUNTIME_INTERNALS describes what the shipped code
actually does — both are worth knowing, and the mismatches are listed in
RUNTIME_INTERNALS' "Known discrepancies" section.

Do not edit. Re-fetch with the recipe in
[`../RUNTIME_INTERNALS.md`](../RUNTIME_INTERNALS.md#how-this-was-fetched-reproduce-it).

## `components/`

Six exported components contributed by Charlin, kept in their original
`fuderation_story_component` export envelopes. They are **study material, not
templates**: every one has an empty `ai_prompt`, and several carry issues
(fixed px widths, an external font the CSP blocks, a description that names a
different component) that are called out deliberately in
[`../EXAMPLES.md`](../EXAMPLES.md).

| File | Original name | Demonstrates |
|---|---|---|
| `VideoCom.json` | `VideoCom` | Media `src` from a param; optional params; copy-to-clipboard |
| `Dice.json` | `Dice` | `fillInput` driving the story; `$id$` scoping; a table packed into one param |
| `openning.json` | `openning` | A component that rewrites its own message to switch state |
| `CyberPanelAlpha.json` | `CyberPanelAlpha` | Two components calling each other; state read back out of the message text |
| `CyberPanelBeta.json` | `CyberPanelBeta` | The mirror half of the pair |
| `Word.json` | `word` | A whole HTML document pasted into the single source field |

File names are normalised to ASCII; the `component.name` inside each envelope is
untouched.
