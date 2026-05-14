'use strict';

const { getDb } = require('./db');

/**
 * Initialize all tables on first run.
 */
function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           TEXT    NOT NULL,
      name              TEXT    NOT NULL,
      phone             TEXT    NOT NULL,
      verification_status INTEGER DEFAULT 0, -- 0=none, 1=verified, 2=failed
      notes             TEXT    DEFAULT '',
      created_at        TEXT    DEFAULT (datetime('now', 'localtime')),
      UNIQUE(user_id, phone)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT    NOT NULL UNIQUE,
      blast_delay           INTEGER DEFAULT 7000,
      verification_delay    INTEGER DEFAULT 5000,
      random_blast_delay    INTEGER DEFAULT 2000,
      random_verification_delay INTEGER DEFAULT 2000
    );

    CREATE TABLE IF NOT EXISTS tags (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      description TEXT    DEFAULT '',
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS contact_tags (
      contact_id INTEGER,
      tag_id     INTEGER,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (contact_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS blast_templates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      body        TEXT    NOT NULL,
      created_at  TEXT    DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS blast_history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT    NOT NULL,
      name          TEXT    DEFAULT 'unknown',
      phone         TEXT    NOT NULL,
      message       TEXT    NOT NULL,
      status        TEXT    DEFAULT 'pending', -- 'success', 'failed'
      created_at    TEXT    DEFAULT (datetime('now', 'localtime')),
      updated_at    TEXT    DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT    NOT NULL,
      type          TEXT    NOT NULL,
      message       TEXT    NOT NULL,
      created_at    TEXT    DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // --- MIGRATIONS ---

  // 0. Migrate blast_history to individual log format
  const blastHistoryCols = db.prepare("PRAGMA table_info(blast_history)").all();
  if (blastHistoryCols.length > 0 && !blastHistoryCols.some(c => c.name === 'message')) {
    console.log('[Schema] Migrating blast_history to message-log format...');
    db.exec("DROP TABLE blast_history;");
    db.exec(`
      CREATE TABLE blast_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       TEXT    NOT NULL,
        name          TEXT    DEFAULT 'unknown',
        phone         TEXT    NOT NULL,
        message       TEXT    NOT NULL,
        status        TEXT    DEFAULT 'pending',
        created_at    TEXT    DEFAULT (datetime('now', 'localtime')),
        updated_at    TEXT    DEFAULT (datetime('now', 'localtime'))
      );
    `);
  }
  
  // 1. Migrate Settings (If old format exists)
  const settingsCols = db.prepare("PRAGMA table_info(settings)").all();
  if (settingsCols.length > 0 && !settingsCols.some(c => c.name === 'user_id')) {
    console.log('[Schema] Migrating old settings table...');
    db.exec("DROP TABLE settings;");
    db.exec(`
      CREATE TABLE settings (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT    NOT NULL UNIQUE,
        blast_delay           INTEGER DEFAULT 7000,
        verification_delay    INTEGER DEFAULT 5000,
        random_blast_delay    INTEGER DEFAULT 2000,
        random_verification_delay INTEGER DEFAULT 2000
      );
    `);
  }

  // 2. Ensure user_id on all tables
  const tables = ['contacts', 'tags', 'blast_templates', 'blast_history'];
  tables.forEach(table => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some(c => c.name === 'user_id')) {
      console.log(`[Schema] Adding user_id to ${table}`);
      db.exec(`ALTER TABLE ${table} ADD COLUMN user_id TEXT DEFAULT 'system';`);
    }
  });

  // 3. Ensure other columns
  const contactsCols = db.prepare("PRAGMA table_info(contacts)").all();
  if (!contactsCols.some(c => c.name === 'verification_status')) {
    db.exec("ALTER TABLE contacts ADD COLUMN verification_status INTEGER DEFAULT 0;");
  }

  const tagsCols = db.prepare("PRAGMA table_info(tags)").all();
  if (!tagsCols.some(c => c.name === 'description')) {
    db.exec("ALTER TABLE tags ADD COLUMN description TEXT DEFAULT '';");
  }

  console.log('[Schema] Initialization complete.');
}

module.exports = { initDb };
