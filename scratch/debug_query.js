const sqlite3 = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../server/data/database.sqlite');
const db = new sqlite3(dbPath);

const user_id = '6285156548398'; // Ganti dengan user_id yang ada di db Anda

const sql = `
  SELECT c.*, GROUP_CONCAT(t.name) as tags
  FROM contacts c
  LEFT JOIN contact_tags ct ON c.id = ct.contact_id
  LEFT JOIN tags t ON ct.tag_id = t.id
  WHERE c.user_id = ?
  GROUP BY c.id
  LIMIT 5
`;

try {
    const rows = db.prepare(sql).all(user_id);
    console.log(JSON.stringify(rows, null, 2));
} catch (err) {
    console.error(err);
}
