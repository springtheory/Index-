const Database = require('better-sqlite3');
const path = require('path');
const { CREATE_TABLES } = require('./schema');

// On Vercel, use /tmp/ for the database (ephemeral but writable)
// For persistent storage on Vercel, use an external DB (Turso, PlanetScale, etc.)
// Locally, store in the project root
const DB_PATH = process.env.VERCEL
  ? '/tmp/index.db'
  : process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'index.db');

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
