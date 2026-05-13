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

  // POST /api/wa/connect
  async connect(req, res) {
    const logger = require('../utils/logger');
    logger.info('[Controller] Endpoint /api/wa/connect dipanggil');
    try {
      // async fire-and-forget dengan error catching
      waService.connect().catch(err => {
        logger.error({ err }, '[Baileys] Gagal start socket');
      });
      res.json({ message: 'Connecting…' });
    } catch (err) {
      logger.error({ err }, 'Error di endpoint connect');
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
