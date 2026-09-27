import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initSchema } from './db.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Node.js yerleşik SQLite ile veritabanını açar ve şemayı uygular. */
export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  initSchema(db, readFileSync(join(here, 'schema.sql'), 'utf8'));
  return db;
}
