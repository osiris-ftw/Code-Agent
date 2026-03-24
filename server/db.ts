import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import bcrypt from 'bcryptjs'

// Ensure data directory exists
const dataDir = path.join(import.meta.dirname, 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'cloudcodex.db')
const db = new Database(dbPath)

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ─── Schema ────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'plaintext',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

// ─── User helpers ───────────────────────────────────────────────────────
export function createUser(username: string, password: string) {
  const hash = bcrypt.hashSync(password, 10)
  const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
  const result = stmt.run(username, hash)
  return { id: result.lastInsertRowid as number, username }
}

export function verifyUser(username: string, password: string) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?')
  const user = stmt.get(username) as any
  if (!user) return null
  if (!bcrypt.compareSync(password, user.password_hash)) return null
  return { id: user.id as number, username: user.username as string }
}

export function getUserById(id: number) {
  const stmt = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?')
  return stmt.get(id) as { id: number; username: string; created_at: string } | undefined
}

// ─── File helpers ───────────────────────────────────────────────────────
export function getUserFiles(userId: number) {
  const stmt = db.prepare('SELECT id, name, content, language FROM files WHERE user_id = ? ORDER BY created_at ASC')
  return stmt.all(userId) as { id: string; name: string; content: string; language: string }[]
}

export function saveFile(userId: number, file: { id: string; name: string; content: string; language: string }) {
  const stmt = db.prepare(`
    INSERT INTO files (id, user_id, name, content, language) 
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      name = excluded.name,
      content = excluded.content,
      language = excluded.language,
      updated_at = CURRENT_TIMESTAMP
  `)
  stmt.run(file.id, userId, file.name, file.content, file.language)
}

export function deleteFile(userId: number, fileId: string) {
  const stmt = db.prepare('DELETE FROM files WHERE id = ? AND user_id = ?')
  stmt.run(fileId, userId)
}

// ─── Chat helpers ───────────────────────────────────────────────────────
export function getChatMessages(userId: number) {
  const stmt = db.prepare('SELECT id, role, content FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC')
  return stmt.all(userId) as { id: string; role: string; content: string }[]
}

export function saveChatMessage(userId: number, msg: { id: string; role: string; content: string }) {
  const stmt = db.prepare('INSERT OR REPLACE INTO chat_messages (id, user_id, role, content) VALUES (?, ?, ?, ?)')
  stmt.run(msg.id, userId, msg.role, msg.content)
}

export function clearChatMessages(userId: number) {
  const stmt = db.prepare('DELETE FROM chat_messages WHERE user_id = ?')
  stmt.run(userId)
}

export default db
