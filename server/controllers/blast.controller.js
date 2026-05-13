'use strict';

const blastService  = require('../services/blast.service');
const { BlastTemplate, BlastHistory } = require('../models/blast.model');
const { ActivityLog } = require('../models/activity.model');
const IPCBridge = require('../utils/ipc.bridge');
const waService = require('../services/wa.service');

function getUserId(res) {
  const status = waService.getStatus();
  const user = status.user || status.sessionUser;

  if (!user) {
    if(res) res.status(401).json({ error: 'WhatsApp not connected' });
    return null;
  }
  return user.id.split(':')[0].split('@')[0];
}

const BlastController = {
  // ── Templates ──────────────────────────────────────────────────────────────
  listTemplates(_req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;
    res.json(BlastTemplate.findAll(user_id));
  },

  createTemplate(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    const { name, body } = req.body;
    if (!name || !body) return res.status(400).json({ error: 'name and body are required' });
    const result = BlastTemplate.create({ user_id, name, body });
    ActivityLog.create({ user_id, type: 'template', message: `Menambahkan template pesan: ${name}` });
    IPCBridge.emit('broadcast', { type: 'ACTIVITY_UPDATE' });
    res.status(201).json({ id: result.lastInsertRowid });
  },

  updateTemplate(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    const { name, body } = req.body;
    BlastTemplate.update(user_id, req.params.id, { name, body });
    res.json({ success: true });
  },

  deleteTemplate(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    BlastTemplate.delete(user_id, req.params.id);
    res.json({ success: true });
  },

  // ── History ────────────────────────────────────────────────────────────────
  listHistory(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    const { page, limit, search, sortKey, sortDir } = req.query;
    const result = BlastHistory.findAndCountAll(user_id, { page, limit, search, sortKey, sortDir });
    res.json(result);
  },
  
  getStats(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;
    res.json(BlastHistory.getDailyStats(user_id));
  },

  async startBlast(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    const { templateId, targetTag, recipients, message } = req.body;
    
    // Validasi input: bisa via template/tag atau raw recipients/message
    const hasTemplate = templateId && targetTag;
    const hasRaw = recipients && message;

    if (!hasTemplate && !hasRaw) {
      return res.status(400).json({ error: 'Sediakan templateId/targetTag atau recipients/message' });
    }

    try {
      // Fire & forget — progress dikirim via IPC
      blastService.startBlast({ user_id, templateId, targetTag, recipients, message }).catch(console.error);
      ActivityLog.create({ user_id, type: 'blast', message: 'Berhasil mengirim blast' });
      IPCBridge.emit('broadcast', { type: 'ACTIVITY_UPDATE' });
      res.json({ message: 'Blast started' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = BlastController;
