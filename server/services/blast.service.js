'use strict';

const waService        = require('../services/wa.service');
const { BlastTemplate, BlastHistory } = require('../models/blast.model');
const { Contact }      = require('../models/contact.model');
const IPCBridge        = require('../utils/ipc.bridge');
const logger           = require('../utils/logger');

const DELAY_MS = 2500; // jeda antar pesan (ms)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Memulai proses blast pesan.
 * Mendukung templateId/targetTag (legacy) atau recipients/message (raw).
 */
async function startBlast({ user_id, templateId, targetTag, recipients, message }) {
  let finalMessage = message;
  let finalContacts = [];

  // 1. Resolve Message & Contacts
  if (templateId) {
    const template = BlastTemplate.findById(user_id, templateId);
    if (!template) throw new Error(`Template ID ${templateId} not found`);
    finalMessage = template.body;

    if (targetTag) {
      const res = Contact.findAndCountAll(user_id, { tag: targetTag, limit: 10000 });
      finalContacts = res.rows || [];
    }
  } else if (recipients && message) {
    // Parsing manual recipients (#tag, @nama, 0812...)
    const items = recipients.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    const db = require('../models/db').getDb();

    for (const item of items) {
      if (item.startsWith('#')) {
        // Find by Tag
        const tagName = item.substring(1);
        const res = Contact.findAndCountAll(user_id, { tag: tagName, limit: 10000 });
        finalContacts.push(...(res.rows || []));
      } else if (item.startsWith('@')) {
        // Find by Name
        const contactName = item.substring(1);
        if (contactName.toLowerCase() === 'all') {
          // Find all verified contacts (status = 1)
          const allVerified = db.prepare('SELECT * FROM contacts WHERE user_id = ? AND verification_status = 1').all(user_id);
          finalContacts.push(...allVerified);
        } else {
          const contact = db.prepare('SELECT * FROM contacts WHERE user_id = ? AND name = ?').get(user_id, contactName);
          if (contact) finalContacts.push(contact);
        }
      } else {
        // Find by Phone or just use number
        const phone = item.replace(/[^0-9]/g, '');
        if (phone) {
          const contact = Contact.findByPhone(user_id, phone);
          if (contact) {
            finalContacts.push(contact);
          } else {
            finalContacts.push({ name: '', phone }); // No name contact
          }
        }
      }
    }
  }

  // Deduplicate contacts by phone
  const uniqueContacts = [];
  const seen = new Set();
  for (const c of finalContacts) {
    if (!seen.has(c.phone)) {
      seen.add(c.phone);
      uniqueContacts.push(c);
    }
  }

  if (!uniqueContacts.length) throw new Error('Tidak ada kontak yang valid untuk dikirim.');

  let sent   = 0;
  let failed = 0;

  // 3. Loop & Send
  for (const contact of uniqueContacts) {
    const displayName = contact.name && contact.name.trim() ? contact.name : 'Bapak/Ibu';
    const personalizedText = finalMessage
      .replace(/\{\{name\}\}/gi, displayName)
      .replace(/\{\{nama\}\}/gi, displayName);

    let status = 'success';
    try {
      await waService.sendText(contact.phone, personalizedText);
      sent++;
    } catch (err) {
      logger.error(err, `Failed to send to ${contact.phone}`);
      failed++;
      status = 'failed';
    }

    // Individual Logging
    try {
      BlastHistory.create({
        user_id,
        name: contact.name || 'unknown',
        phone: contact.phone,
        message: personalizedText,
        status
      });
    } catch (dbErr) {
      logger.error(dbErr, 'Failed to log message to blast_history');
    }

    IPCBridge.blastProgress({
      sent,
      failed,
      total:   uniqueContacts.length,
      percent: Math.round(((sent + failed) / uniqueContacts.length) * 100),
    });

    await sleep(DELAY_MS);
  }

  const status = failed === uniqueContacts.length ? 'failed'
               : failed > 0                     ? 'partial'
               :                                  'done';

  IPCBridge.blastDone({ sent, failed, total: uniqueContacts.length, status });

  return { sent, failed, total: uniqueContacts.length, status };
}

module.exports = { startBlast };
