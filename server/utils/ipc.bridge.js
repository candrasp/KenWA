'use strict';

const EventEmitter = require('events');


class IPCBridge extends EventEmitter {
  /**
   * Kirim event ke Tauri window / Frontend.
   * Gunakan send() bukan emit() agar tidak konflik dengan EventEmitter.emit()
   */
  send(event, payload) {
    const message = { event, payload };

    // 1. Broadcast ke SSE listeners (untuk dev mode / browser)
    super.emit('broadcast', message);

    // 2. Kirim ke stdout sebagai JSON agar ditangkap oleh Tauri Rust wrapper
    // Kita tetap cek process.send jika suatu saat kita pakai IPC channel sungguhan
    if (process.send) {
      process.send(message);
    }
  }

  // ── Shortcut helpers ──────────────────────────────────────────────────────
  qr(qrDataUrl)          { this.send('wa:qr',       { qr: qrDataUrl }); }
  ready(info)            { this.send('wa:ready',     info); }
  disconnected(payload) { 
    const data = typeof payload === 'object' ? payload : { reason: payload };
    this.send('wa:disconnected', data); 
  }
  blastProgress(data)    { this.send('blast:progress',  data); }
  blastDone(data)        { this.send('blast:done',       data); }
}

module.exports = new IPCBridge();
