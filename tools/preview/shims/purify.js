// Stands in for the app's bundled DOMPurify chunk.
//
// The runtime imports it as `p` and calls `p.sanitize(html, config)`. The site
// ships its own copy; we use the npm package instead so we are not vendoring a
// second third-party bundle. Same library, same API.
//
// If DOMPurify is ever unavailable the runtime falls back to its own hand-rolled
// sanitizer (`he()`), which implements the same allowlist — so a null export
// degrades gracefully rather than throwing.
import DOMPurify from 'dompurify';

export const p = DOMPurify;
