'use strict';

const { ActivityLog } = require('../models/activity.model');
const IPCBridge = require('../utils/ipc.bridge');
const waService = require('../services/wa.service');

function getUserId() {
  const status = waService.getStatus();
  const user = status.user || status.sessionUser;
  return user ? user.id.split(':')[0].split('@')[0] : 'system';
}

const ActivityController = {
  async list(req, res) {
    try {
      const user_id = getUserId();
      const result = ActivityLog.findAndCountAll(user_id, req.query);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req, res) {
    try {
      const user_id = getUserId();
      const { type, message } = req.body;
      if (!type || !message) return res.status(400).json({ error: 'type and message required' });
      
      ActivityLog.create({ user_id, type, message });
      IPCBridge.emit('broadcast', { type: 'ACTIVITY_UPDATE' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async clear(req, res) {
    try {
      const user_id = getUserId();
      ActivityLog.clear(user_id);
      
      IPCBridge.emit('broadcast', { type: 'ACTIVITY_UPDATE' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = ActivityController;
