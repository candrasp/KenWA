'use strict';

const waService = require('../services/wa.service');

const WaController = {
  // GET /api/wa/status
  async getStatus(req, res) {
    try {
      res.json(waService.getStatus());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // GET /api/wa/qr — kembalikan QR terakhir yang di-cache
  async getQR(req, res) {
    try {
      const qr = waService.getLastQr();
      if (qr) {
        res.json({ qr });
      } else {
        res.status(204).end(); // No content — QR belum tersedia
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // POST /api/wa/connect
  async connect(req, res) {
    console.log('[Controller] Endpoint /api/wa/connect dipanggil');
    try {
      // async fire-and-forget dengan error catching
      waService.connect().catch(err => {
        console.error('[Baileys] Gagal start socket', err);
      });
      res.json({ message: 'Connecting…' });
    } catch (err) {
      console.error('Error di endpoint connect', err);
      res.status(500).json({ error: err.message });
    }
  },

  // POST /api/wa/disconnect
  async disconnect(req, res) {
    try {
      await waService.disconnect();
      res.json({ message: 'Disconnected' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = WaController;
