'use strict';

const { getDb } = require('./db');

const Setting = {
  findByUserId(user_id) {
    const db = getDb();
    let setting = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(user_id);
    
    // Auto-initialize if not found
    if (!setting) {
      db.prepare(`
        INSERT INTO settings (user_id, blast_delay, verification_delay, random_blast_delay, random_verification_delay)
        VALUES (?, 7000, 5000, 2000, 2000)
      `).run(user_id);
      
      setting = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(user_id);
    }
    
    return setting;
  },

  update(user_id, data) {
    const { blast_delay, verification_delay, random_blast_delay, random_verification_delay } = data;
    return getDb().prepare(`
      UPDATE settings 
      SET blast_delay = ?, verification_delay = ?, random_blast_delay = ?, random_verification_delay = ?
      WHERE user_id = ?
    `).run(blast_delay, verification_delay, random_blast_delay, random_verification_delay, user_id);
  }
};

module.exports = { Setting };
