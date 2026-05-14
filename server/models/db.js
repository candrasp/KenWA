'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// Gunakan AppData/Roaming untuk menyimpan database di production (Windows)
// Agar tidak kena error Permission Denied saat di-install di Program Files
const DATA_DIR = process.env.NODE_ENV === 'production' 
  ? path.join(process.env.APPDATA || process.env.HOME || '.', 'KenWA', 'data')
  : path.join(__dirname, '..', 'data');

const DB_PATH  = path.join(DATA_DIR, 'kenwa.db');

let _db = null;

function getDb() {
  if (!_db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    _db = new Database(DB_PATH, { verbose: process.env.NODE_ENV === 'development' ? console.log : null });
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

module.exports = { getDb };
