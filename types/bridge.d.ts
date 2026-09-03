// Ambient declarations for Fuderation Workshop bridge functions.
//
// The Workshop runtime injects these as globals into the component's execution
// scope (in iframe mode, as `window.*`). They are provided for you — never
// `import` them and never redefine them. These declarations are type-only and
// are erased at compile time; they exist so `script.ts` type-checks.
//
// ── IMPORTANT: these signatures describe IFRAME MODE ──────────────────────────
// A compiled `script.ts` always trips the runtime's advanced-JS detector, so it
// always runs inside the sandboxed iframe. The iframe bridge differs from the
// official guide's synchronous examples:
//
//   * saveToLocal / readFromLocal / getWorldInfo / progress / wait return
//     Promises — `await` them. (They resolve to '' / [] on a 3s timeout, so a
//     failure is indistinguishable from empty data.)
//   * requireInputEquals returns a boolean and does NOT halt the script.
//   * openUrl is NOT DEFINED — it exists only in DSL mode. It is declared below
//     as `never` so calling it is a compile error.
//
// A `script.js` written as one-bridge-call-per-line runs in DSL mode instead,
// where all of these are synchronous and requireInputEquals does halt.
// See .agents/skills/fuderation-component-builder/RUNTIME_INTERNALS.md.

declare global {
  // ── DOM ──────────────────────────────────────────────────────────────────
  // Selectors resolve with querySelector — a SINGLE element, never a list —
  // scoped to the component document. '@host' means the component root.
  // Selectors longer than 200 characters are ignored.

  /** Set an element's text content. */
  function setText(selector: string, text: string): void;
  /** Set an input value; writes `src` for img/video/audio/source; else text. */
  function setValue(selector: string, value: string): void;
  /** Show an element (default display: block). */
  function show(selector: string, display?: string): void;
  /** Hide an element. */
  function hide(selector: string): void;
  /** Add a CSS class. */
  function addClass(selector: string, className: string): void;
  /** Remove a CSS class. */
  function removeClass(selector: string, className: string): void;
  /**
   * Set one CSS property. The name must match `--custom-prop` or a plain CSS
   * identifier; the value must be <= 256 chars and free of `javascript:`,
   * `expression(`, `@import` and `url(javascript:)`. `prop: 'src'` is
   * special-cased to behave like setValue — prefer setValue for that.
   */
  function setStyle(selector: string, prop: string, value: string): void;

  // ── Flow control ─────────────────────────────────────────────────────────
  /** Animate a progress bar and sync its percentage text. Duration clamped 200–10000 ms. */
  function progress(barSelector: string, textSelector: string, durationMs: number): Promise<void>;
  /** Pause. Clamped 0–10000 ms. */
  function wait(ms: number): Promise<void>;
  /**
   * Validate an input against `expected`; toasts `errorText` on mismatch.
   * Returns whether it matched. In iframe mode this does NOT halt the script —
   * branch on the result yourself. trim defaults to true.
   */
  function requireInputEquals(
    selector: string,
    expected: string,
    errorText: string,
    trim?: boolean,
  ): boolean;

  // ── Chat / host ──────────────────────────────────────────────────────────
  /** Write text into the chat input box. */
  function fillInput(text: string): void;
  /** Copy text to the clipboard. */
  function copyText(text: string): void;
  /** Show a toast. */
  function toast(text: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
  /** Append to the current assistant message (persisted). */
  function appendMsg(text: string): void;
  /**
   * Replace the current assistant message (persisted). Re-emitting your own
   * `<$Name$>` call here is how a component keeps state across renders — escape
   * the dollars as `\$Name\$` or build them with String.fromCharCode(36).
   */
  function changeMsg(text: string): void;
  /** Append to the current assistant message (local only, not persisted). */
  function tempAppendMsg(text: string): void;
  /** Replace the current assistant message (local only, not persisted). */
  function tempChangeMsg(text: string): void;
  /** Current message text. Synchronous but CACHED — stale right after changeMsg. */
  function getMsgContent(): string;
  /** Current storyline character avatar URL. Synchronous; pre-seeded at mount. */
  function getCharAvatar(): string;
  /** Current logged-in user avatar URL. Synchronous; pre-seeded at mount. */
  function getUserAvatar(): string;
  /** Undocumented alias of getCharAvatar(). */
  function getCurrentCharAvatar(): string;
  /** Undocumented alias of getUserAvatar(). */
  function getCurrentUserAvatar(): string;
  /** Enabled world-book entries matching a trigger. Resolves to [] on timeout. */
  function getWorldInfo(trigger: string): Promise<string[]>;
  /**
   * NOT AVAILABLE in iframe mode — the whitelist accepts the name but the
   * iframe bridge never defines it, so calling it throws a ReferenceError.
   * Only usable from a DSL-mode `src/script.js`.
   */
  const openUrl: never;
  /** Save to device-local IndexedDB (key max 128 chars). Resolves to '' on timeout. */
  function saveToLocal(key: string, value: string): Promise<string>;
  /** Read from device-local IndexedDB. Resolves to '' on miss OR timeout. */
  function readFromLocal(key: string): Promise<string>;
}

export {};
