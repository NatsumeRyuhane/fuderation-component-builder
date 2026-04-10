# Fuderation Workshop Component Development

This repository is a workspace for building Fuderation Workshop components — interactive UI widgets that render inside chat messages in storylines.

## Skills

When working in this repo, always load and follow these skills:

- **fuderation-component-builder** — the primary workflow for creating, debugging, and iterating on Workshop components. Defines the file output convention (`components/<name>/component.html` + `ai_additional_prompt.md`), bridge function DSL reference, and phased build process.
- **frontend-design** — design tokens, component patterns, and styling constraints. Use when writing or refining the HTML/CSS in `component.html` files.

## Project structure

```
components/                  # All components live here, one directory each
  <component-name>/
    component.html           # Source code (HTML + <style> + <script>)
    ai_additional_prompt.md  # AI supplementary prompt for the storyline model
```

## Rules

- Always follow the phased build workflow from `fuderation-component-builder` — do not jump straight to a finished component.
- Every new or imported component must produce both `component.html` and `ai_additional_prompt.md` in its own directory under `components/`.
- When the user provides existing component code, organize it into this structure before making changes.
- Keep styles chat-bubble-friendly. No networking, no real auth, no real payment.