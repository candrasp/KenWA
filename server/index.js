'use strict';

const fs = require('fs');
const path = require('path');

// Deteksi otomatis mode Production vs Development
if (!process.env.NODE_ENV) {
  const isBundled = __dirname.includes('caxa') || !fs.existsSync(path.join(__dirname, '..', 'package.json'));
  process.env.NODE_ENV = isBundled ? 'production' : 'development';
}

// ── Watchdog: Pastikan server mati jika induknya (Tauri) ditutup ──────────────
// 1. Deteksi via stdin (Paling andal di Windows/Tauri)
process.stdin.on('close', () => {
  console.log('[Watchdog] Stdin closed, exiting...');
  process.exit(0);
});
process.stdin.resume(); // Pastikan stdin tetap terbuka untuk didengarkan

// 2. Deteksi via PPID (Cadangan)
if (process.env.NODE_ENV === 'production') {
  // Beri jeda 30 detik sebelum mulai mengecek agar proses stabil
  setTimeout(() => {
    setInterval(() => {
      try {
        if (process.ppid <= 1) throw new Error('Parent lost');
        process.kill(process.ppid, 0);
      } catch (e) {
        console.log('[Watchdog] Parent process lost, exiting...');
        process.exit(0);
      }
    }, 5000);
  }, 30000);
}

const GlobalConfig = require('./global-config');

const express = require('express');
const cors = require('cors');
const { initDb } = require('./models/schema');
const IPCBridge = require('./utils/ipc.bridge');

// ── Routes ─────────────────────────────────────────────────────────────────
const waRoutes = require('./routes/wa.routes');
const contactRoutes = require('./routes/contact.routes');
const blastRoutes = require('./routes/blast.routes');
const tagRoutes = require('./routes/tag.routes');
const settingRoutes = require('./routes/setting.routes');
const activityRoutes = require('./routes/activity.routes');
const waService = require('./services/wa.service');

const PORT = process.env.PORT || 3721;
const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static (optional, serve frontend jika standalone) ──────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/wa', waRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/blast', blastRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/activity', activityRoutes);

app.get('/api/config', (req, res) => {
  res.json(GlobalConfig);
});

// ── SSE Bridge for Events ───────────────────────────────────────────────────
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable buffering for Nginx/Proxies
  });

  // Kirim komentar kosong pertama untuk buka koneksi
  res.write(':\n\n');

  const onEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  IPCBridge.on('broadcast', onEvent);

  // Heartbeat / Ping setiap 20 detik agar koneksi tetap hidup
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    IPCBridge.off('broadcast', onEvent);
    res.end();
  });
});

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── Bootstrap ───────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    if (GlobalConfig.debug_log) console.log('[Bootstrap] Initializing database...');
    initDb();
    if (GlobalConfig.debug_log) console.log('[Bootstrap] Database initialized.');

    if (GlobalConfig.debug_log) console.log(`[Bootstrap] Starting express server on port ${PORT}...`);
    const server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`[Bootstrap] KenWA server listening on http://127.0.0.1:${PORT}`);

      // Auto-connect WhatsApp session on startup
      if (GlobalConfig.debug_log) console.log('[Bootstrap] Connecting to WhatsApp...');
      waService.connect().catch(err => {
        console.error('[Bootstrap] Failed to auto-connect WhatsApp:', err.message);
      });

      // Beritahu Tauri bahwa server sudah siap
      const readyMsg = { event: 'server-ready', payload: { port: PORT } };
      console.log(JSON.stringify(readyMsg));
      if (process.send) process.send(readyMsg);
    });

    server.on('error', (err) => {
      console.error('[Bootstrap] Server error:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`[Bootstrap] Port ${PORT} is already in use!`);
      }
      process.exit(1);
    });

  } catch (err) {
    console.error('[Bootstrap] Critical error during startup:', err.message);
    process.exit(1);
  }
}

bootstrap();
