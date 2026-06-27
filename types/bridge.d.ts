// Ambient declarations for Fuderation Workshop bridge functions.
//
// The Workshop runtime injects these as globals into the component's execution
// scope (in iframe mode, as `window.*`). They are provided for you — never
// `import` them and never redefine them. These declarations are type-only and
// are erased at compile time; they exist so `script.ts` type-checks.

declare global {
  // ── DOM ──────────────────────────────────────────────────────────────────
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
  /** Set one allow-listed (safe) CSS property. */
  function setStyle(selector: string, prop: string, value: string): void;

  // ── Flow control ─────────────────────────────────────────────────────────
  /** Animate a progress bar and sync its percentage text. */
  function progress(barSelector: string, textSelector: string, durationMs: number): void;
  /** Pause (max 10000 ms). */
  function wait(ms: number): void;
  /** Validate an input; toast `errorText` and halt the script on mismatch. trim defaults true. */
  function requireInputEquals(
    selector: string,
    expected: string,
    errorText: string,
    trim?: boolean,
  ): void;

  // ── Chat / host ──────────────────────────────────────────────────────────
  /** Write text into the chat input box. */
  function fillInput(text: string): void;
  /** Copy text to the clipboard. */
  function copyText(text: string): void;
  /** Show a toast. */
  function toast(text: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
  /** Append to the current assistant message (persisted). */
  function appendMsg(text: string): void;
  /** Replace the current assistant message (persisted). */
  function changeMsg(text: string): void;
  /** Append to the current assistant message (local only, not persisted). */
  function tempAppendMsg(text: string): void;
  /** Replace the current assistant message (local only, not persisted). */
  function tempChangeMsg(text: string): void;
  /** Read the current message text (best used as an argument to another fn). */
  function getMsgContent(): string;
  /** Current storyline character avatar URL string (use as arg). */
  function getCharAvatar(): string;
  /** Current logged-in user avatar URL string (use as arg). */
  function getUserAvatar(): string;
  /** Alias of getCharAvatar(). */
  function getCurrentCharAvatar(): string;
  /** Alias of getUserAvatar(). */
  function getCurrentUserAvatar(): string;
  /** Enabled world-book entries matching a trigger word; returns an array. */
  function getWorldInfo(trigger: string): string[];
  /** Open an http/https link. */
  function openUrl(url: string): void;
  /** Save a value to device-local IndexedDB (key max 128 chars). */
  function saveToLocal(key: string, value: string): void;
  /** Read a value from device-local IndexedDB (use as arg). */
  function readFromLocal(key: string): string;
}

export {};
