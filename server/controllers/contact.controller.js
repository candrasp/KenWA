'use strict';

const { Contact } = require('../models/contact.model');
const { Setting } = require('../models/setting.model');
const { ActivityLog } = require('../models/activity.model');
const IPCBridge = require('../utils/ipc.bridge');
const waService = require('../services/wa.service');

function getUserId(res) {
  const status = waService.getStatus();
  // Gunakan sessionUser jika koneksi sedang terputus sementara (reconnecting)
  const user = status.user || status.sessionUser;

  if (!user) {
    if (res) res.status(401).json({ error: 'WhatsApp not connected' });
    return null;
  }
  return user.id.split(':')[0].split('@')[0];
}

const ContactController = {
  // GET /api/contacts
  list(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;
    
    const { tag, search, page, limit, sortKey, sortDir } = req.query;
    try {
      // Auto-init settings for this user if not exists
      Setting.findByUserId(user_id);

      const result = Contact.findAndCountAll(user_id, { tag, search, page, limit, sortKey, sortDir });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // GET /api/contacts/:id
  show(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    const row = Contact.findById(user_id, req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  },

  // GET /api/contacts/check?phone=...
  check(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    // Normalisasi: hanya ambil angka
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    try {
      const contact = Contact.findByPhone(user_id, cleanPhone);
      res.json({ exists: !!contact });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // POST /api/contacts
  create(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    const { name, phone, tags, notes } = req.body; // Changed 'tag' to 'tags' matching frontend
    if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' });
    try {
      const result = Contact.create({ user_id, name, phone, tags, notes });
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Phone already exists' });
      }
      res.status(500).json({ error: err.message });
    }
  },

  // PUT /api/contacts/:id
  update(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    const { name, phone, tags, notes } = req.body;
    try {
      Contact.update(user_id, req.params.id, { name, phone, tags, notes });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // DELETE /api/contacts/:id
  destroy(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    try {
      Contact.delete(user_id, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // DELETE /api/contacts
  bulkDestroy(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }

    try {
      const result = Contact.deleteMany(user_id, ids);
      res.json({ success: true, deleted: result.changes });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // POST /api/contacts/verify/:id
  async verify(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    const contact = Contact.findById(user_id, req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    try {
      const waStatus = await waService.onWhatsApp(contact.phone);
      const status = waStatus ? 1 : 2; // 1=terdaftar, 2=gagal
      Contact.updateVerification(user_id, req.params.id, status);
      res.json({ success: true, status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // POST /api/contacts/sync
  async sync(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    try {
      const contacts = await waService.syncContacts();
      if (contacts.length === 0) {
        return res.json({ success: true, count: 0, message: 'No contacts found to sync' });
      }

      const count = Contact.bulkCreate(user_id, contacts);
      if (count > 0) {
        ActivityLog.create({ user_id, type: 'sync', message: `Menambahkan ${count} kontak dari sync WA` });
        IPCBridge.send('activity:update', { type: 'sync' });
      }
      res.json({ success: true, count, total_found: contacts.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  // POST /api/contacts/bulk-tags
  bulkAddTags(req, res) {
    const user_id = getUserId(res);
    if (!user_id) return;

    const { ids, tags } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    if (!tags) return res.status(400).json({ error: 'tags is required' });

    try {
      const result = Contact.bulkAddTags(user_id, ids, tags);
      res.json({ success: true, updated: result.changes });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = ContactController;
