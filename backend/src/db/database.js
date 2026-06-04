const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/jobradar.db');

let db;

function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      source      TEXT NOT NULL,
      external_id TEXT,
      title       TEXT NOT NULL,
      company     TEXT,
      location    TEXT,
      contract    TEXT,
      salary      TEXT,
      url         TEXT,
      description TEXT,
      score       INTEGER,
      score_reason TEXT,
      cover_letter TEXT,
      scraped_at  TEXT NOT NULL DEFAULT (datetime('now')),
      emailed     INTEGER NOT NULL DEFAULT 0,
      UNIQUE(source, external_id)
    );

    CREATE TABLE IF NOT EXISTS scrape_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      source     TEXT NOT NULL,
      status     TEXT NOT NULL,
      count      INTEGER DEFAULT 0,
      error      TEXT,
      ran_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { getDb };
