'use strict';
/**
 * SQLite 数据库层。
 * 数据库文件路径由环境变量 DB_PATH 指定（默认 ./data/app.db）。
 * 在 Render / Railway 等平台上，请把 DB_PATH 指向「持久化磁盘」挂载点，
 * 否则每次重新部署数据会丢失（详见 README）。
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'app.db');

// 确保目录存在
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  role         TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_lists (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  title       TEXT NOT NULL DEFAULT '未命名价目表',
  data        TEXT NOT NULL,                    -- 完整草稿 JSON 字符串
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lists_user ON price_lists(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS product_pages (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  list_id    INTEGER NOT NULL,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (list_id) REFERENCES price_lists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pp_list ON product_pages(list_id);
`);

module.exports = db;
