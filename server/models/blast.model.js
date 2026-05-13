'use strict';

const { getDb } = require('./db');

const BlastTemplate = {
  findAll(user_id) {
    return getDb().prepare('SELECT * FROM blast_templates WHERE user_id = ? ORDER BY created_at DESC').all(user_id);
  },
  findById(user_id, id) {
    return getDb().prepare('SELECT * FROM blast_templates WHERE id = ? AND user_id = ?').get(id, user_id);
  },
  create({ user_id, name, body }) {
    return getDb().prepare('INSERT INTO blast_templates (user_id, name, body) VALUES (?, ?, ?)').run(user_id, name, body);
  },
  update(user_id, id, { name, body }) {
    return getDb().prepare('UPDATE blast_templates SET name=?, body=? WHERE id=? AND user_id=?').run(name, body, id, user_id);
  },
  delete(user_id, id) {
    return getDb().prepare('DELETE FROM blast_templates WHERE id = ? AND user_id = ?').run(id, user_id);
  },
};

const BlastHistory = {
  findAndCountAll(user_id, filter = {}) {
    const db = getDb();
    
    let whereClause = `WHERE user_id = ?`;
    const params = [user_id];

    if (filter.search) {
      whereClause += ' AND (name LIKE ? OR phone LIKE ? OR message LIKE ? OR status LIKE ?)';
      params.push(`%${filter.search}%`, `%${filter.search}%`, `%${filter.search}%`, `%${filter.search}%`);
    }

    // 1. Get Totals
    const countSql = `
      SELECT 
        COUNT(id) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as totalSent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as totalFailed
      FROM blast_history
      ${whereClause}
    `;
    const totals = db.prepare(countSql).get(...params);

    // 2. Get Paginated Data
    const sortKey = filter.sortKey || 'created_at';
    const sortDir = (filter.sortDir || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const validSortKeys = ['created_at', 'status', 'name', 'phone'];
    const finalSortKey = validSortKeys.includes(sortKey) ? sortKey : 'created_at';

    const page = parseInt(filter.page) || 1;
    const limit = parseInt(filter.limit) || 10;
    const offset = (page - 1) * limit;

    const dataSql = `
      SELECT *
      FROM blast_history
      ${whereClause}
      ORDER BY ${finalSortKey} ${sortDir}
      LIMIT ? OFFSET ?
    `;
    
    const queryParams = [...params, limit, offset];
    const rows = db.prepare(dataSql).all(...queryParams);

    return { 
      rows, 
      total: totals.total || 0,
      totalSent: totals.totalSent || 0,
      totalFailed: totals.totalFailed || 0
    };
  },
  create({ user_id, name, phone, message, status }) {
    return getDb()
      .prepare('INSERT INTO blast_history (user_id, name, phone, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\', \'localtime\'), datetime(\'now\', \'localtime\'))')
      .run(user_id, name || 'unknown', phone, message, status || 'pending');
  },
  updateStatus(id, status) {
    return getDb()
      .prepare('UPDATE blast_history SET status=?, updated_at=datetime(\'now\', \'localtime\') WHERE id=?')
      .run(status, id);
  },
  getDailyStats(user_id) {
    const db = getDb();
    const sql = `
      SELECT 
        strftime('%Y-%m-%d', created_at) as date,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM blast_history
      WHERE user_id = ? AND created_at >= date('now', '-7 days')
      GROUP BY date
      ORDER BY date ASC
    `;
    return db.prepare(sql).all(user_id);
  }
};

module.exports = { BlastTemplate, BlastHistory };
