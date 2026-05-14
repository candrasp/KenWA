'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// Gunakan folder data di root server (Portable)
const DATA_DIR = path.join(__dirname, '..', 'data');

const DB_PATH  = path.join(DATA_DIR, 'kenwa.db');

const GlobalConfig = require('../global-config');

let _db = null;

function getDb() {
  if (!_db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const verbose = GlobalConfig.debug_log ? console.log : null;
    _db = new Database(DB_PATH, { verbose });
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

module.exports = { getDb };
