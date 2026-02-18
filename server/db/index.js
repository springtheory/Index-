const Database = require('better-sqlite3');
const path = require('path');
const { CREATE_TABLES } = require('./schema');

const DB_PATH = path.join(__dirname, '..', '..', 'index.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(CREATE_TABLES);
  }
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
