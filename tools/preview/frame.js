// Mount iframe-mode components.
//
// The runtime emits a placeholder:
//   <div class="story-inline-component story-inline-component-iframe"
//        data-story-component-frame="1" data-story-frame-id="sc_xxxx"></div>
// and stashes the built document in its own LRU, retrievable with the module's
// exported `h(frameId)` getter. The code that turns the placeholder into a real
// <iframe> was located in MessageBubble-lB0l6UTk.js on 2026-09-06. This mount is
// still reconstructed from the contract: the sandbox flags match the editor's own
// preview frame, and the resize protocol matches the document's own script.

const RESIZE_TYPE = 'story-component-resize';
const RESIZE_REQUEST = 'story-component-resize-request';

/**
 * Replace every frame placeholder inside `container` with a live iframe.
 * `getFrameDoc` is the runtime's exported `h`.
 */
export function mountFrames(container, getFrameDoc, { onMount } = {}) {
  const placeholders = container.querySelectorAll('[data-story-component-frame="1"]');

  for (const el of placeholders) {
    const id = el.getAttribute('data-story-frame-id') || '';
    const doc = id ? getFrameDoc(id) : '';
    if (!doc) {
      el.textContent = `[preview] no frame document for ${id || '(missing id)'}`;
      el.classList.add('preview-frame-error');
      continue;
    }

    const iframe = document.createElement('iframe');
    // Matches the editor's own preview frame: scripts allowed, but WITHOUT
    // allow-same-origin, so the document runs at an opaque origin and cannot
    // reach this page's storage. The runtime's own CSP is inside `doc`.
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('loading', 'lazy');
    iframe.className = 'preview-component-frame';
    // The document's resize listener drops any request whose id !== its own
    // frameId, so requestResize() needs this back. The placeholder carrying it
    // is replaced below, so stash it on the iframe.
    iframe.dataset.storyFrameId = id;
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.height = '0px';
    iframe.srcdoc = doc;

    el.replaceWith(iframe);
    onMount?.({ id, iframe, doc });
  }
}

/**
 * Listen for height reports and size the matching iframe.
 * The document posts { type, id, height } on every measurement.
 */
export function listenForFrameResize({ onResize } = {}) {
  const onMessage = (event) => {
    const data = event?.data;
    if (!data || data.type !== RESIZE_TYPE) return;

    const height = Number(data.height || 0);
    if (!Number.isFinite(height) || height <= 0) return;

    for (const iframe of document.querySelectorAll('iframe.preview-component-frame')) {
      if (iframe.contentWindow === event.source) {
        iframe.style.height = `${height}px`;
        onResize?.({ id: String(data.id || ''), height, iframe });
        return;
      }
    }
  };

  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

/**
 * Ask a mounted frame to re-measure (used after the bubble width changes).
 * `id` defaults to the id stashed at mount; an id the frame does not recognise
 * is silently ignored by its listener.
 */
export function requestResize(iframe, id = iframe?.dataset?.storyFrameId || '') {
  iframe.contentWindow?.postMessage({ type: RESIZE_REQUEST, id }, '*');
}
