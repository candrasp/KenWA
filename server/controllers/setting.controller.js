'use strict';

const { Setting } = require('../models/setting.model');
const waService = require('../services/wa.service');

function getUserId(res) {
  const status = waService.getStatus();
  if (!status.connected || !status.user) {
    if (res) res.status(401).json({ error: 'WhatsApp not connected' });
    return null;
  }
  return status.user.id.split(':')[0].split('@')[0];
}

const SettingController = {
  get(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;
    try {
      res.json(Setting.findByUserId(user_id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  update(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;
    try {
      Setting.update(user_id, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = SettingController;
