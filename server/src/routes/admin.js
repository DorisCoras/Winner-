// Kullanıcı yönetimi, sistem ayarları ve işlem geçmişi.
import { Router } from 'express';
import { z } from 'zod';
import { generatePassword, hashPassword, requireRole } from '../auth.js';
import { getSetting, setSetting } from '../db.js';
import { ROLES } from '../lib/constants.js';
import { HttpError, idParam, notFound, parseBody, zOptId } from '../http.js';
import { audit } from '../services.js';
import { PASSWORD_RULE } from './auth.js';

const SETTINGS = {
  app_name: { default: 'FIMAR Holding İK', schema: z.string().trim().min(1).max(80) },
  saturday_workday: { default: '0', schema: z.enum(['0', '1']) },
  employer_incentive: { default: '1', schema: z.enum(['0', '1']) },
  sicil_prefix: { default: 'FMR', schema: z.string().trim().regex(/^[A-Z0-9]{1,8}$/, 'Yalnızca büyük harf ve rakam (en fazla 8).') },
};

export default function adminRoutes(db) {
  const r = Router();
  const admin = requireRole('admin');
  const hr = requireRole('admin', 'ik');

  // --- Ayarlar ---
  r.get('/settings', hr, (_req, res) => {
    res.json(Object.fromEntries(Object.entries(SETTINGS).map(([k, v]) => [k, getSetting(db, k, v.default)])));
  });

  r.put('/settings', hr, (req, res) => {
    const shape = Object.fromEntries(Object.entries(SETTINGS).map(([k, v]) => [k, v.schema.optional()]));
    const b = parseBody(z.object(shape), req.body);
    for (const [k, v] of Object.entries(b)) if (v !== undefined) setSetting(db, k, v);
    audit(db, req, 'guncelle', 'ayarlar', null, b);
    res.json(Object.fromEntries(Object.entries(SETTINGS).map(([k, v]) => [k, getSetting(db, k, v.default)])));
  });

  // --- Kullanıcılar ---
  const USER_SELECT = `
    SELECT u.id, u.email, u.role, u.employee_id, u.active, u.must_change_password, u.last_login_at, u.created_at,
           e.first_name || ' ' || e.last_name AS employee_name, c.short_name AS company_name
    FROM users u LEFT JOIN employees e ON e.id = u.employee_id LEFT JOIN companies c ON c.id = e.company_id`;

  r.get('/users', admin, (_req, res) => {
    res.json(db.prepare(`${USER_SELECT} ORDER BY u.active DESC, u.email`).all());
  });

  const userSchema = z.object({
    email: z.string().trim().toLowerCase().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Geçerli bir e-posta giriniz.'),
    role: z.enum(Object.keys(ROLES), { message: 'Rol seçiniz.' }),
    employee_id: zOptId,
    active: z.boolean().optional().default(true),
  });

  function checkEmployeeLink(employeeId, userId = null) {
    if (!employeeId) return;
    if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(employeeId)) throw new HttpError(400, 'Personel bulunamadı.');
    const other = db.prepare('SELECT id FROM users WHERE employee_id = ? AND id IS NOT ?').get(employeeId, userId);
    if (other) throw new HttpError(409, 'Bu personel zaten başka bir kullanıcı hesabına bağlı.', { fields: { employee_id: 'Başka hesaba bağlı.' } });
  }

  r.post('/users', admin, (req, res) => {
    const b = parseBody(userSchema.extend({ password: PASSWORD_RULE.optional().or(z.literal('')) }), req.body);
    checkEmployeeLink(b.employee_id);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(b.email)) {
      throw new HttpError(409, 'Bu e-posta ile kayıtlı kullanıcı var.', { fields: { email: 'Bu e-posta kullanımda.' } });
    }
    const password = b.password || generatePassword();
    const info = db
      .prepare('INSERT INTO users (email, password_hash, role, employee_id, active, must_change_password) VALUES (?, ?, ?, ?, ?, 1)')
      .run(b.email, hashPassword(password), b.role, b.employee_id, b.active ? 1 : 0);
    const id = Number(info.lastInsertRowid);
    audit(db, req, 'olustur', 'kullanici', id, { email: b.email, role: b.role });
    res.status(201).json({ ...db.prepare(`${USER_SELECT} WHERE u.id = ?`).get(id), temp_password: password });
  });

  r.put('/users/:id', admin, (req, res) => {
    const id = idParam(req);
    const b = parseBody(userSchema, req.body);
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(id)) throw notFound('Kullanıcı');
    checkEmployeeLink(b.employee_id, id);
    if (id === req.user.id && (b.role !== 'admin' || !b.active)) {
      throw new HttpError(400, 'Kendi yönetici yetkinizi kaldıramaz veya hesabınızı pasife alamazsınız.');
    }
    db.prepare('UPDATE users SET email = ?, role = ?, employee_id = ?, active = ? WHERE id = ?').run(
      b.email,
      b.role,
      b.employee_id,
      b.active ? 1 : 0,
      id,
    );
    if (!b.active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    audit(db, req, 'guncelle', 'kullanici', id, { role: b.role, active: b.active });
    res.json(db.prepare(`${USER_SELECT} WHERE u.id = ?`).get(id));
  });

  r.post('/users/:id/reset-password', admin, (req, res) => {
    const id = idParam(req);
    const password = generatePassword();
    const info = db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(hashPassword(password), id);
    if (!info.changes) throw notFound('Kullanıcı');
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    audit(db, req, 'sifre_sifirla', 'kullanici', id);
    res.json({ temp_password: password });
  });

  r.delete('/users/:id', admin, (req, res) => {
    const id = idParam(req);
    if (id === req.user.id) throw new HttpError(400, 'Kendi hesabınızı silemezsiniz.');
    if (!db.prepare('DELETE FROM users WHERE id = ?').run(id).changes) throw notFound('Kullanıcı');
    audit(db, req, 'sil', 'kullanici', id);
    res.json({ ok: true });
  });

  // --- İşlem geçmişi ---
  r.get('/audit', admin, (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const where = [];
    const params = [];
    if (req.query.entity) {
      where.push('a.entity = ?');
      params.push(String(req.query.entity));
    }
    if (req.query.user_id) {
      where.push('a.user_id = ?');
      params.push(Number(req.query.user_id));
    }
    res.json(
      db
        .prepare(
          `SELECT a.*, u.email AS user_email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
           ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY a.id DESC LIMIT ${limit}`,
        )
        .all(...params),
    );
  });

  return r;
}
