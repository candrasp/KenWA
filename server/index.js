'use strict';

const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const { initDb }  = require('./models/schema');
const logger      = require('./utils/logger');
const IPCBridge   = require('./utils/ipc.bridge');

// ── Routes ─────────────────────────────────────────────────────────────────
const waRoutes      = require('./routes/wa.routes');
const contactRoutes = require('./routes/contact.routes');
const blastRoutes   = require('./routes/blast.routes');
const tagRoutes     = require('./routes/tag.routes');
const settingRoutes = require('./routes/setting.routes');
const activityRoutes= require('./routes/activity.routes');
const waService     = require('./services/wa.service');

const PORT = process.env.PORT || 3721;
const app  = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static (optional, serve frontend jika standalone) ──────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/wa',       waRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/blast',    blastRoutes);
app.use('/api/tags',     tagRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/activity', activityRoutes);

// ── SSE Bridge for Events ───────────────────────────────────────────────────
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
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
    initDb();
    logger.info('Database initialized');

    app.listen(PORT, '127.0.0.1', () => {
      logger.info(`KenWA server listening on http://127.0.0.1:${PORT}`);
      
      // Auto-connect WhatsApp session on startup
      waService.connect().catch(err => {
        logger.error(err, 'Failed to auto-connect WhatsApp');
      });

      // Beritahu Tauri bahwa server sudah siap (jika berjalan sebagai sidecar)
      if (process.send) process.send({ event: 'server-ready', port: PORT });
    });
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();
