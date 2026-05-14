'use strict';

const { getDb } = require('./db');

const Tag = {
  findAndCountAll(user_id, filter = {}) {
    const db = getDb();

    let whereClause = `WHERE t.user_id = ?`;
    const params = [user_id];

    if (filter.search) {
      whereClause += ' AND (t.name LIKE ? OR t.description LIKE ?)';
      params.push(`%${filter.search}%`, `%${filter.search}%`);
    }

    // 1. Fetch ALL matching rows (for JS-side natural sort)
    const allSql = `
      SELECT t.*, COUNT(ct.contact_id) as contact_count
      FROM tags t
      LEFT JOIN contact_tags ct ON t.id = ct.tag_id
      ${whereClause}
      GROUP BY t.id
    `;
    let allRows = db.prepare(allSql).all(...params);
    const total = allRows.length;

    // 2. Natural sort in JavaScript (handles odp1, odp2, odp10 correctly)
    const sortKey = filter.sortKey || 'name';
    const sortDir = (filter.sortDir || 'asc').toUpperCase() === 'DESC' ? -1 : 1;
    const validSortKeys = ['name', 'contact_count', 'id'];
    const key = validSortKeys.includes(sortKey) ? sortKey : 'name';

    allRows.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      // Numeric columns: sort numerically
      if (key === 'contact_count' || key === 'id') {
        return (Number(aVal) - Number(bVal)) * sortDir;
      }

      // String columns: use localeCompare with numeric option for natural sort
      return String(aVal).localeCompare(String(bVal), undefined, {
        numeric: true,
        sensitivity: 'base' // case-insensitive
      }) * sortDir;
    });

    // 3. Apply pagination in JS
    const page = parseInt(filter.page) || 1;
    const limit = parseInt(filter.limit) || 20;
    const offset = (page - 1) * limit;
    const rows = allRows.slice(offset, offset + limit);

    return { rows, total };
  },

  create({ user_id, name, description = '' }) {
    return getDb().prepare('INSERT INTO tags (user_id, name, description) VALUES (?, ?, ?)').run(user_id, name, description);
  },

  update(user_id, id, { name, description }) {
    return getDb().prepare('UPDATE tags SET name = ?, description = ? WHERE id = ? AND user_id = ?').run(name, description, id, user_id);
  },

  delete(user_id, id) {
    return getDb().prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, user_id);
  },
  
  bulkDelete(user_id, ids) {
    if (!ids || ids.length === 0) return { changes: 0 };
    const placeholders = ids.map(() => '?').join(',');
    const sql = `DELETE FROM tags WHERE user_id = ? AND id IN (${placeholders})`;
    return getDb().prepare(sql).run(user_id, ...ids);
  },

  findById(user_id, id) {
    return getDb().prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(id, user_id);
  }
};

module.exports = { Tag };
