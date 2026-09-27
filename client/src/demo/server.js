// Tarayıcı içi demo sunucusu: gerçek sunucunun API kodunu (server/src) SQLite (sql.js) üzerinde
// çalıştırır. Veriler kurgusaldır ve yalnızca bu tarayıcıda (localStorage) tutulur.
import initSqlJs from 'sql.js/dist/sql-asm-memory-growth.js';
import schemaSql from '../../../server/src/schema.sql?raw';
import { createApi } from '../../../server/src/api.js';
import { bootstrap } from '../../../server/src/bootstrap.js';
import { initSchema } from '../../../server/src/db.js';
import { seedDemo } from '../../../server/src/demo-data.js';
import { wrapDatabase } from './sqlite.js';

const DB_KEY = 'fimar-ik-demo-db-v1';
const COOKIE_KEY = 'fimar-ik-demo-cookies-v1';

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* depolama kapalı */
    }
  },
};

function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function startDemoServer() {
  const SQL = await initSqlJs();

  let raw = null;
  const saved = storage.get(DB_KEY);
  if (saved) {
    try {
      raw = new SQL.Database(fromBase64(saved));
    } catch {
      raw = null;
    }
  }
  const fresh = !raw;
  if (fresh) raw = new SQL.Database();
  const db = wrapDatabase(raw);
  initSchema(db, schemaSql);
  if (fresh) {
    bootstrap(db, { adminEmail: 'admin@fimar.com.tr', adminPassword: 'Demo1234', log: () => {} });
    seedDemo(db);
  }

  const config = { sessionDays: 7, cookieSecure: false, allowedOrigins: [] };
  const api = createApi(db, config);

  const jar = new Map();
  try {
    for (const [k, v] of JSON.parse(storage.get(COOKIE_KEY) ?? '[]')) jar.set(k, v);
  } catch {
    /* bozuk kayıt yok sayılır */
  }

  let persistTimer = null;
  const persist = () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      storage.set(DB_KEY, toBase64(db.export()));
      storage.set(COOKIE_KEY, JSON.stringify([...jar]));
    }, 400);
  };
  if (fresh) persist();

  /** fetch('/api' + path) karşılığı: { status, data } döner. */
  function request(path, { method = 'GET', body } = {}) {
    const url = new URL(path, 'http://demo.local');
    const query = Object.fromEntries(url.searchParams);
    const req = {
      method,
      path: url.pathname,
      url: url.pathname + url.search,
      query,
      params: {},
      body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)),
      ip: '127.0.0.1',
      headers: {
        host: 'demo.local',
        cookie: [...jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; '),
      },
    };
    const res = {
      statusCode: 200,
      body: null,
      finished: false,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        this.finished = true;
        return this;
      },
      setHeader() {},
      cookie(name, value) {
        jar.set(name, value);
      },
      clearCookie(name) {
        jar.delete(name);
      },
    };
    api(req, res, (err) => {
      if (!res.finished) res.status(err ? 500 : 404).json({ error: err ? 'Beklenmeyen bir hata oluştu.' : 'Bulunamadı.' });
    });
    if (method !== 'GET') persist();
    return { status: res.statusCode, data: res.body };
  }

  function reset() {
    storage.remove(DB_KEY);
    storage.remove(COOKIE_KEY);
  }

  return { request, reset };
}
