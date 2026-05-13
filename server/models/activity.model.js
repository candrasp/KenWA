'use strict';

const { getDb } = require('./db');

const ActivityLog = {
  findAndCountAll(user_id, filter = {}) {
    const db = getDb();

    let whereClause = `WHERE (user_id = ? OR user_id = 'system')`;
    const params = [user_id];

    if (filter.type) {
      whereClause += ' AND type = ?';
      params.push(filter.type);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM activity_log ${whereClause}`).get(...params);
    const total = countRow.total;

    const page = parseInt(filter.page) || 1;
    const limit = parseInt(filter.limit) || 10;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT * FROM activity_log 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const rows = db.prepare(sql).all(...params);

    return { rows, total };
  },

  create({ user_id, type, message }) {
    return getDb().prepare('INSERT INTO activity_log (user_id, type, message) VALUES (?, ?, ?)')
      .run(user_id, type, message);
  },
  
  clear(user_id) {
    return getDb().prepare('DELETE FROM activity_log WHERE user_id = ?').run(user_id);
  }
};

module.exports = { ActivityLog };
