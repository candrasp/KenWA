'use strict';

const { Tag } = require('../models/tag.model');
const { ActivityLog } = require('../models/activity.model');
const IPCBridge = require('../utils/ipc.bridge');
const waService = require('../services/wa.service');

function getUserId(res) {
  const status = waService.getStatus();
  const user = status.user || status.sessionUser;

  if (!user) {
    if (res) res.status(401).json({ error: 'WhatsApp not connected' });
    return null;
  }
  return user.id.split(':')[0].split('@')[0];
}

const TagController = {
  list(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;
    try {
      res.json(Tag.findAndCountAll(user_id, req.query));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  show(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    try {
      const tag = Tag.findById(user_id, req.params.id);
      if (!tag) return res.status(404).json({ error: 'Tag not found' });
      res.json(tag);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  create(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    try {
      const result = Tag.create({ user_id, name, description });
      ActivityLog.create({ user_id, type: 'tag', message: `Menambahkan tags: ${name}` });
      IPCBridge.emit('broadcast', { type: 'ACTIVITY_UPDATE' });
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Tag already exists' });
      }
      res.status(500).json({ error: err.message });
    }
  },

  update(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;
    const { name, description } = req.body;
    try {
      Tag.update(user_id, req.params.id, { name, description });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  destroy(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;
    try {
      Tag.delete(user_id, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  bulkDelete(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array is required' });
    try {
      const result = Tag.bulkDelete(user_id, ids);
      res.json({ success: true, deleted: result.changes });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

module.exports = TagController;
