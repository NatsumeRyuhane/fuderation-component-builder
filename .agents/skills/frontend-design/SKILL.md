---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

## Fuderation Workshop component constraints

When the target is a Fuderation Workshop component (this repo), it renders inside a chat message — sized to the **bubble width with content-driven height**, not a fixed canvas. The runtime evidence is in the component-builder skill's [RUNTIME_INTERNALS.md](../fuderation-component-builder/RUNTIME_INTERNALS.md#9-rendering--sizing-fluid-width-content-height-auto-downscale). Design within these constraints:

- **⚠️ Your CSS is only a real stylesheet in iframe mode.** The runtime has two render modes. In the inline "DSL" mode it does not emit a `<style>` element at all — it parses your CSS, matches each selector with `querySelectorAll`, and merges the declarations into inline `style` attributes. In that mode **only the first 1000 characters of CSS are read**, `@media`/`@keyframes`/`@font-face` are skipped, and `:hover`, `:focus`, `::before` and `::after` **never apply**. A component lands in iframe mode when it has a script with any native JS, or (with no script) when its CSS exceeds 1000 chars, uses an at-rule, or targets `html`/`body`/`:root`. So: **if the design depends on hover, motion, or depth, make sure the component is in iframe mode** — one `@media` block is enough to force it. `npm run build` prints the mode and warns when CSS would be truncated. Details: [Execution modes](../fuderation-component-builder/SKILL.md#execution-modes).
- **One outer wrapper element.** The auto-downscale logic measures `root.firstElementChild`, so a bare list of siblings measures wrong. Wrap everything in a single `div`.
- **A restricted tag set in DSL mode.** `canvas`, `form`, `main`, `header`, `footer`, `nav`, `article`, `aside`, `dialog` and `iframe` are stripped by the sanitizer; `div`, `section`, `svg` and the basic SVG shapes are fine. Inline `on*` handlers are always removed.
- **Fluid, mobile-first width.** Assume a narrow bubble (~320 px on mobile; wider on desktop). Outer wrapper: `width:100%` with `max-width` ~320–360 px. **Never a large fixed px width** — if the outer element is wider than the bubble, the runtime scales the *entire* component down (`transform: scale`), making everything tiny.
- **No horizontal overflow.** Wrap text (`overflow-wrap:anywhere`/`word-break`), avoid `white-space:nowrap` long strings and wide/fixed tables, use responsive grids. Overflow triggers the same downscale.
- **Content-driven height.** No fixed heights, no `vh`/viewport units, no aspect-ratio assumptions — the iframe auto-grows to fit; tall is fine.
- **Relative units + border-box.** Prefer `%`/`rem`/`clamp()`/flex/grid; `box-sizing:border-box` is already enforced, so padding won't blow out width.
- **Readable type & touch targets.** Body ~13–15 px; interactive targets ≥ ~40 px (mobile-first).
- **Self-contained.** No networking, no external fonts/scripts/CDN, no real auth/payment — inline everything (the iframe CSP blocks network and external sources, including Google Fonts: `font-src` is `data:` only). System font stacks and `@font-face` with a `data:` URI are the only options.
- **Theme from a param via CSS custom properties.** `setStyle` accepts `--custom-props`, so `setStyle('@host', '--accent', '$Color$')` re-skins a whole component in one bridge call — the cleanest way to make an AI-supplied colour drive the design.