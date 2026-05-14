'use strict';

const { getDb } = require('./db');

// ── Contacts ────────────────────────────────────────────────────────────────
const Contact = {
  findAndCountAll(user_id, filter = {}) {
    const db = getDb();

    // Base WHERE
    let whereClause = `WHERE c.user_id = ?`;
    const params = [user_id];

    if (filter.tag) {
      whereClause += ` AND c.id IN (
        SELECT ct2.contact_id FROM contact_tags ct2 
        JOIN tags t2 ON ct2.tag_id = t2.id 
        WHERE t2.name = ?
      )`;
      params.push(filter.tag);
    }
    if (filter.search) {
      whereClause += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
      params.push(`%${filter.search}%`, `%${filter.search}%`);
    }

    // 1. Get Total Count
    const countSql = `SELECT COUNT(DISTINCT c.id) as total FROM contacts c ${whereClause}`;
    const totalRow = db.prepare(countSql).get(...params);
    const total = totalRow ? totalRow.total : 0;

    // 2. Get Paginated & Sorted Data
    const sortKey = filter.sortKey || 'name';
    const sortDir = (filter.sortDir || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Validate sortKey to prevent SQL injection
    const validSortKeys = ['name', 'phone', 'verification_status', 'created_at', 'id'];
    const finalSortKey = validSortKeys.includes(sortKey) ? `c.${sortKey}` : 'c.name';

    const pageNum = Math.max(1, parseInt(filter.page) || 1);
    const limitNum = Math.max(1, parseInt(filter.limit) || 20);
    const offsetNum = (pageNum - 1) * limitNum;

    const dataSql = `
      SELECT c.*, GROUP_CONCAT(t.name) as tags
      FROM contacts c
      LEFT JOIN contact_tags ct ON c.id = ct.contact_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      ${whereClause}
      GROUP BY c.id
      ORDER BY ${finalSortKey} COLLATE NOCASE ${sortDir}
      LIMIT ? OFFSET ?
    `;

    // Gunakan salinan params agar tidak merusak query berikutnya jika ada
    const queryParams = [...params, limitNum, offsetNum];
    const rows = db.prepare(dataSql).all(...queryParams);

    // 3. Get Unverified Count (Total, not just this page)
    // Counts anything that is NOT verified (1) and NOT failed (2).
    // This matches the frontend logic where anything else is "Belum Verifikasi".
    const unverifiedSql = `
      SELECT COUNT(*) as unverified 
      FROM contacts 
      WHERE user_id = ? 
        AND IFNULL(verification_status, 0) NOT IN (1, 2)
    `;
    const unverifiedRow = db.prepare(unverifiedSql).get(user_id);
    const unverifiedCount = unverifiedRow ? (unverifiedRow.unverified || 0) : 0;

    return { rows, total, unverifiedCount };
  },

  findById(user_id, id) {
    const sql = `
      SELECT c.*, GROUP_CONCAT(t.name) as tags
      FROM contacts c
      LEFT JOIN contact_tags ct ON c.id = ct.contact_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      WHERE c.user_id = ? AND c.id = ?
      GROUP BY c.id
    `;
    return getDb().prepare(sql).get(user_id, id);
  },

  findByPhone(user_id, phone) {
    return getDb().prepare('SELECT * FROM contacts WHERE user_id = ? AND phone = ?').get(user_id, phone);
  },

  create({ user_id, name, phone, tags = '', notes = '' }) {
    const db = getDb();
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const insertContact = db.prepare('INSERT INTO contacts (user_id, name, phone, notes) VALUES (?, ?, ?, ?)');
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (user_id, name) VALUES (?, ?)');
    const getTagId = db.prepare('SELECT id FROM tags WHERE user_id = ? AND name = ?');
    const insertContactTag = db.prepare('INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)');

    const transaction = db.transaction(() => {
      const info = insertContact.run(user_id, name, phone, notes);
      const contactId = info.lastInsertRowid;

      for (const tagName of tagList) {
        insertTag.run(user_id, tagName);
        const tagObj = getTagId.get(user_id, tagName);
        if (tagObj) {
          insertContactTag.run(contactId, tagObj.id);
        }
      }
      return { lastInsertRowid: contactId };
    });

    return transaction();
  },

  update(user_id, id, { name, phone, tags = '', notes = '' }) {
    const db = getDb();
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const updateContact = db.prepare('UPDATE contacts SET name=?, phone=?, notes=? WHERE id=? AND user_id=?');
    const deleteContactTags = db.prepare('DELETE FROM contact_tags WHERE contact_id=?');
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (user_id, name) VALUES (?, ?)');
    const getTagId = db.prepare('SELECT id FROM tags WHERE user_id = ? AND name = ?');
    const insertContactTag = db.prepare('INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)');

    const transaction = db.transaction(() => {
      updateContact.run(name, phone, notes, id, user_id);
      deleteContactTags.run(id);

      for (const tagName of tagList) {
        insertTag.run(user_id, tagName);
        const tagObj = getTagId.get(user_id, tagName);
        if (tagObj) {
          insertContactTag.run(id, tagObj.id);
        }
      }
    });

    return transaction();
  },

  delete(user_id, id) {
    return getDb().prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?').run(id, user_id);
  },

  deleteMany(user_id, ids) {
    if (!Array.isArray(ids) || ids.length === 0) return { changes: 0 };
    const placeholders = ids.map(() => '?').join(',');
    const sql = `DELETE FROM contacts WHERE user_id = ? AND id IN (${placeholders})`;
    return getDb().prepare(sql).run(user_id, ...ids);
  },

  bulkAddTags(user_id, ids, tags) {
    const db = getDb();
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (tagList.length === 0 || ids.length === 0) return { changes: 0 };

    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (user_id, name) VALUES (?, ?)');
    const getTagId = db.prepare('SELECT id FROM tags WHERE user_id = ? AND name = ?');
    const insertContactTag = db.prepare('INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)');

    const transaction = db.transaction(() => {
      let count = 0;
      for (const id of ids) {
        for (const tagName of tagList) {
          insertTag.run(user_id, tagName);
          const tagObj = getTagId.get(user_id, tagName);
          if (tagObj) {
            insertContactTag.run(id, tagObj.id);
          }
        }
        count++;
      }
      return { changes: count };
    });

    return transaction();
  },


  countByTag(user_id, tagName) {
    const sql = `
      SELECT COUNT(*) as count 
      FROM contact_tags ct
      JOIN tags t ON ct.tag_id = t.id
      JOIN contacts c ON ct.contact_id = c.id
      WHERE c.user_id = ? AND t.name = ?
    `;
    return getDb().prepare(sql).get(user_id, tagName).count;
  },

  updateVerification(user_id, id, status) {
    return getDb().prepare('UPDATE contacts SET verification_status=? WHERE id=? AND user_id=?').run(status, id, user_id);
  },

  bulkCreate(user_id, contacts) {
    const db = getDb();
    const insert = db.prepare('INSERT OR IGNORE INTO contacts (user_id, name, phone) VALUES (?, ?, ?)');

    const transaction = db.transaction((list) => {
      let count = 0;
      for (const c of list) {
        const info = insert.run(user_id, c.name, c.phone);
        if (info.changes > 0) count++;
      }
      return count;
    });

    return transaction(contacts);
  },
};

module.exports = { Contact };
