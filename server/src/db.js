import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));
  return db;
}

const openTransactions = new WeakSet();

/** Runs fn inside a transaction; rolls back if it throws. Nested calls reuse the outer transaction. */
export function transaction(db, fn) {
  if (openTransactions.has(db)) return fn();
  db.exec('BEGIN');
  openTransactions.add(db);
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    openTransactions.delete(db);
  }
}

export function getSetting(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(db, key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value == null ? null : String(value));
}

// Tablo ve sütun adları her zaman koddan (zod şemalarının anahtarlarından) gelir, kullanıcı girdisinden değil.
export function insertRow(db, table, data) {
  const keys = Object.keys(data);
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((k) => `:${k}`).join(', ')})`;
  return Number(db.prepare(sql).run(data).lastInsertRowid);
}

export function updateRow(db, table, id, data) {
  const keys = Object.keys(data);
  if (!keys.length) return 0;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = :${k}`).join(', ')} WHERE id = :row_id`;
  return Number(db.prepare(sql).run({ ...data, row_id: id }).changes);
}
