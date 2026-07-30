const Database = require('better-sqlite3');
const db = new Database('cx_channel.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS requests (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    email     TEXT NOT NULL,
    subject   TEXT NOT NULL,
    priority  TEXT NOT NULL,
    status    TEXT NOT NULL DEFAULT 'pending',
    team      TEXT,
    details   TEXT,
    date      TEXT NOT NULL
  )
`);

module.exports = db;
