import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { HttpError } from './http.js';

export const SESSION_COOKIE = 'fimar_ik_sid';
const SCRYPT_KEYLEN = 64;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const hashToken = (token) => sha256(String(token ?? ''));

export function createSession(db, userId, days) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + days * 86_400_000).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expires);
  return { token, expires };
}

export function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    if (key) out[key] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const USER_SELECT = `
  SELECT u.id, u.email, u.role, u.employee_id, u.active, u.must_change_password,
         e.first_name, e.last_name, e.position, e.company_id, e.department_id, e.status AS employee_status
  FROM users u LEFT JOIN employees e ON e.id = u.employee_id`;

export function loadUser(db, userId) {
  return db.prepare(`${USER_SELECT} WHERE u.id = ?`).get(userId);
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    employee_id: u.employee_id,
    must_change_password: !!u.must_change_password,
    name: u.first_name ? `${u.first_name} ${u.last_name}` : u.email,
    position: u.position ?? null,
    company_id: u.company_id ?? null,
    department_id: u.department_id ?? null,
  };
}

/** Express middleware: attaches req.user when a valid session cookie exists. */
export function sessionMiddleware(db) {
  const lookup = db.prepare(`
    SELECT s.user_id FROM sessions s WHERE s.token_hash = ? AND s.expires_at > ?`);
  return (req, _res, next) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    req.sessionToken = token;
    if (token) {
      const row = lookup.get(sha256(token), new Date().toISOString());
      if (row) {
        const user = loadUser(db, row.user_id);
        if (user?.active) req.user = user;
      }
    }
    next();
  };
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Oturum açmanız gerekiyor.'));
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Oturum açmanız gerekiyor.'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Bu işlem için yetkiniz yok.'));
    next();
  };
}

export const isHR = (user) => user?.role === 'admin' || user?.role === 'ik';

/** Simple in-memory limiter for login attempts (per IP + e-posta). */
export function createLoginLimiter({ max = 10, windowMs = 15 * 60_000 } = {}) {
  const attempts = new Map();
  return {
    check(key) {
      const now = Date.now();
      const entry = attempts.get(key);
      if (!entry || entry.reset < now) return true;
      return entry.count < max;
    },
    fail(key) {
      const now = Date.now();
      const entry = attempts.get(key);
      if (!entry || entry.reset < now) attempts.set(key, { count: 1, reset: now + windowMs });
      else entry.count += 1;
    },
    clear(key) {
      attempts.delete(key);
    },
  };
}

/** Okunabilir geçici şifre: 8 harf + 2 rakam (karışması kolay karakterler hariç). */
export function generatePassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const bytes = randomBytes(10);
  let out = '';
  for (let i = 0; i < 8; i++) out += letters[bytes[i] % letters.length];
  return out + digits[bytes[8] % digits.length] + digits[bytes[9] % digits.length];
}
