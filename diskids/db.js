import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, 'diskids.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#7c5cff',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  username TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  content TEXT NOT NULL,
  flagged INTEGER NOT NULL DEFAULT 0,
  reasons TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS members (
  user_id INTEGER NOT NULL REFERENCES users(id),
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, server_id)
);

CREATE TABLE IF NOT EXISTS flagged_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Lightweight transaction helper (node:sqlite has no .transaction()).
function transaction(fn) {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
  };
}

// ---------- Users ----------
export function createUser(username, passwordHash, avatarColor) {
  const info = db
    .prepare('INSERT INTO users (username, password_hash, avatar_color) VALUES (?, ?, ?)')
    .run(username, passwordHash, avatarColor);
  return getUserById(info.lastInsertRowid);
}

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function getUserById(id) {
  return db.prepare('SELECT id, username, avatar_color, created_at FROM users WHERE id = ?').get(id);
}

// ---------- Servers ----------
export function createServer(name, icon, userId) {
  const tx = transaction(() => {
    const info = db
      .prepare('INSERT INTO servers (name, icon, created_by) VALUES (?, ?, ?)')
      .run(name, icon, userId);
    const serverId = info.lastInsertRowid;
    // creator is automatically a member + gets a default channel
    db.prepare('INSERT INTO members (user_id, server_id) VALUES (?, ?)').run(userId, serverId);
    db.prepare('INSERT INTO channels (server_id, name, topic) VALUES (?, ?, ?)').run(
      serverId,
      'welcome',
      'Say hi to everyone!'
    );
    return serverId;
  });
  return getServerById(tx());
}

export function getServerById(id) {
  return db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
}

export function getServersForUser(userId) {
  return db
    .prepare(
      `SELECT s.* FROM servers s
       JOIN members m ON m.server_id = s.id
       WHERE m.user_id = ?
       ORDER BY s.name ASC`
    )
    .all(userId);
}

export function joinServer(serverId, userId) {
  db.prepare('INSERT OR IGNORE INTO members (user_id, server_id) VALUES (?, ?)').run(
    userId,
    serverId
  );
}

// ---------- Channels ----------
export function createChannel(serverId, name, topic = '') {
  const info = db
    .prepare('INSERT INTO channels (server_id, name, topic) VALUES (?, ?, ?)')
    .run(serverId, name, topic);
  return getChannelById(info.lastInsertRowid);
}

export function getChannelById(id) {
  return db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
}

export function getChannelsForServer(serverId) {
  return db
    .prepare('SELECT * FROM channels WHERE server_id = ? ORDER BY id ASC')
    .all(serverId);
}

// ---------- Messages ----------
export function addMessage(channelId, user, content, flagged, reasons) {
  const info = db
    .prepare(
      `INSERT INTO messages (channel_id, user_id, username, avatar_color, content, flagged, reasons)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(channelId, user.id, user.username, user.avatar_color, content, flagged ? 1 : 0, reasons);
  return getMessageById(info.lastInsertRowid);
}

export function getMessageById(id) {
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}

export function getMessagesForChannel(channelId, limit = 50) {
  return db
    .prepare('SELECT * FROM messages WHERE channel_id = ? ORDER BY id DESC LIMIT ?')
    .all(channelId, limit)
    .reverse();
}

// moderation log (flagged or redacted messages)
export function logFlaggedMessage(message) {
  db.prepare('INSERT INTO flagged_log (message_id) VALUES (?)').run(message.id);
}

// ---------- Misc ----------
export function serverMemberCount(serverId) {
  return db.prepare('SELECT COUNT(*) AS c FROM members WHERE server_id = ?').get(serverId).c;
}

export { db };