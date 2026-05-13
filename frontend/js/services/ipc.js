/**
 * ipc.js — semua komunikasi __TAURI__.invoke() dan event listener Tauri.
 * Jika berjalan di luar Tauri (browser biasa), method ini gracefully no-op.
 */

function getTauri() {
  return window.__TAURI__ ?? null;
}

// ── SSE Bridge for Dev Mode ────────────────────────────────────────────────
const sse = new EventSource('/api/events');
const sseHandlers = new Set();

sse.onopen = () => console.log('[SSE] Connected to backend events');
sse.onerror = (e) => console.error('[SSE] Error / Disconnected', e);

sse.onmessage = (e) => {
  try {
    const { event, payload } = JSON.parse(e.data);
    console.log(`[SSE] Received event: ${event}`);
    sseHandlers.forEach(handler => {
      if (handler.event === event) handler.callback(payload);
    });
  } catch (err) {
    console.error('[SSE] Failed to parse message', err);
  }
};

const IPC = {
  /** Invoke Rust command dari frontend */
  async invoke(cmd, payload = {}) {
    const tauri = getTauri();
    if (!tauri) {
      console.warn(`[IPC] Not running in Tauri — invoke("${cmd}") skipped`);
      return null;
    }
    return tauri.core.invoke(cmd, payload);
  },

  /** Listen Tauri event dari Rust sidecar */
  async listen(event, callback) {
    // Daftarkan ke SSE handler (untuk dev)
    sseHandlers.add({ event, callback });

    const tauri = getTauri();
    if (!tauri) return () => sseHandlers.delete({ event, callback });

    return tauri.event.listen(event, (e) => callback(e.payload));
  },

  // ── Shortcut listeners ─────────────────────────────────────────────────
  onWaQR(cb)          { this.listen('wa:qr',          cb); },
  onWaReady(cb)       { this.listen('wa:ready',        cb); },
  onWaDisconnected(cb){ this.listen('wa:disconnected', cb); },
  onBlastProgress(cb) { this.listen('blast:progress',  cb); },
  onBlastDone(cb)     { this.listen('blast:done',      cb); },

  // ── Rust commands ──────────────────────────────────────────────────────
  getServerPort()     { return this.invoke('get_server_port'); },
  minimizeWindow()    { return this.invoke('minimize_window'); },
  closeWindow()       { return this.invoke('close_window'); },
};

export default IPC;
