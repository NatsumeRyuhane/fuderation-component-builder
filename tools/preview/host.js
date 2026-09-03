// The mock host: everything the real chat app provides to a component.
//
// In iframe mode the component talks to us over postMessage with
//   { type:'story-component-action', action, requestId?, ...payload }
// and we answer requests with
//   { type:'story-component-action-result', requestId, action, value }
// Both shapes are read straight out of the vendored runtime's own bridge source,
// so this half is faithful. What the actions *do* is our simulation.

const STORE_PREFIX = 'fcb-preview:local:';

export function createHost({ onMessageChange, onLog, getState }) {
  const host = {
    toast(text, level = 'info') {
      onLog({ kind: 'toast', level, text: String(text ?? '') });
    },

    fillInput(text) {
      const box = document.querySelector('[data-chat-input]');
      if (box) box.value = String(text ?? '');
      onLog({ kind: 'fillInput', text: String(text ?? '') });
    },

    async copyText(text) {
      const value = String(text ?? '');
      try {
        await navigator.clipboard.writeText(value);
        onLog({ kind: 'copyText', text: value });
      } catch {
        onLog({ kind: 'copyText', text: value, note: 'clipboard blocked; value logged only' });
      }
    },

    // Persisted variants re-render the message, which is what makes
    // self-switching components round-trip locally.
    appendMsg(text) {
      onMessageChange(getState().message + String(text ?? ''), { persisted: true, action: 'appendMsg' });
    },
    changeMsg(text) {
      onMessageChange(String(text ?? ''), { persisted: true, action: 'changeMsg' });
    },
    tempAppendMsg(text) {
      onMessageChange(getState().message + String(text ?? ''), { persisted: false, action: 'tempAppendMsg' });
    },
    tempChangeMsg(text) {
      onMessageChange(String(text ?? ''), { persisted: false, action: 'tempChangeMsg' });
    },

    getMsgContent: () => getState().message,
    getUserAvatar: () => getState().userAvatar,
    getCharAvatar: () => getState().charAvatar,

    openUrl(url) {
      const value = String(url ?? '');
      if (!/^https?:\/\//i.test(value)) {
        onLog({ kind: 'openUrl', text: value, note: 'rejected — only http/https' });
        return;
      }
      onLog({ kind: 'openUrl', text: value, note: 'not opened in preview' });
    },

    // The real host uses IndexedDB scoped to device+browser. localStorage is the
    // same scope for preview purposes, and lets you inspect it in devtools.
    saveToLocal(key, value) {
      const k = String(key ?? '').slice(0, 128);
      if (!k) return '';
      localStorage.setItem(STORE_PREFIX + k, String(value ?? ''));
      onLog({ kind: 'saveToLocal', text: `${k} = ${String(value ?? '')}` });
      return String(value ?? '');
    },
    readFromLocal(key) {
      const k = String(key ?? '').slice(0, 128);
      const v = k ? localStorage.getItem(STORE_PREFIX + k) || '' : '';
      onLog({ kind: 'readFromLocal', text: `${k} -> ${v || '(empty)'}` });
      return v;
    },

    getWorldInfo(trigger) {
      const t = String(trigger ?? '').trim();
      const hits = getState().worldBook.filter(
        (e) => e.enabled && e.keys.some((k) => k && t.toLowerCase().includes(k.toLowerCase())),
      );
      onLog({ kind: 'getWorldInfo', text: `${t} -> ${hits.length} entr${hits.length === 1 ? 'y' : 'ies'}` });
      return hits.map((e) => e.content);
    },
  };

  return host;
}

/**
 * The host-bridged half of the DSL function table.
 *
 * In DSL mode these are synchronous (the runtime's interpreter awaits them
 * anyway), which is exactly the difference from iframe mode that trips people
 * up — see RUNTIME_INTERNALS.md §5.
 */
export function HOST_ACTIONS(host) {
  return {
    fillInput: (t) => host.fillInput(t),
    copyText: (t) => host.copyText(t),
    toast: (t, level) => host.toast(t, level),
    appendMsg: (t) => host.appendMsg(t),
    changeMsg: (t) => host.changeMsg(t),
    tempAppendMsg: (t) => host.tempAppendMsg(t),
    tempChangeMsg: (t) => host.tempChangeMsg(t),
    getMsgContent: () => host.getMsgContent(),
    getUserAvatar: () => host.getUserAvatar(),
    getCurrentUserAvatar: () => host.getUserAvatar(),
    getCharAvatar: () => host.getCharAvatar(),
    getCurrentCharAvatar: () => host.getCharAvatar(),
    openUrl: (u) => host.openUrl(u),
    saveToLocal: (k, v) => host.saveToLocal(k, v),
    readFromLocal: (k) => host.readFromLocal(k),
    getWorldInfo: (t) => host.getWorldInfo(t),
  };
}

/**
 * Answer `story-component-action` messages coming out of a mounted iframe.
 * Returns a teardown function.
 */
export function listenForFrameActions(host) {
  const onMessage = (event) => {
    const data = event?.data;
    if (!data || data.type !== 'story-component-action') return;

    const { action, requestId } = data;
    const reply = (value) => {
      event.source?.postMessage(
        { type: 'story-component-action-result', requestId, action, value },
        '*',
      );
    };

    switch (action) {
      case 'fillInput': return host.fillInput(data.value);
      case 'copyText': return void host.copyText(data.value);
      case 'toast': return host.toast(data.value, data.level);
      case 'appendMsg': return host.appendMsg(data.value);
      case 'changeMsg': return host.changeMsg(data.value);
      case 'tempAppendMsg': return host.tempAppendMsg(data.value);
      case 'tempChangeMsg': return host.tempChangeMsg(data.value);

      // Cached getters: the component already returned a stale value
      // synchronously and is refreshing in the background.
      case 'getMsgContent': return reply(host.getMsgContent());
      case 'getUserAvatar': return reply(host.getUserAvatar());
      case 'getCharAvatar': return reply(host.getCharAvatar());

      // Request/response: the component is awaiting a Promise.
      case 'saveToLocal': return reply(host.saveToLocal(data.variable, data.value));
      case 'readFromLocal': return reply(host.readFromLocal(data.variable));
      case 'getWorldInfo': return reply(host.getWorldInfo(data.trigger));

      default:
        return reply('');
    }
  };

  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
