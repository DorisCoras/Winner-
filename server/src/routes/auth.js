import { Router } from 'express';
import { z } from 'zod';
import {
  SESSION_COOKIE,
  createLoginLimiter,
  createSession,
  destroySession,
  hashPassword,
  hashToken,
  loadUser,
  publicUser,
  requireAuth,
  verifyPassword,
} from '../auth.js';
import { getSetting } from '../db.js';
import { HttpError, parseBody } from '../http.js';
import { audit } from '../services.js';

export const PASSWORD_RULE = z
  .string()
  .min(8, 'Şifre en az 8 karakter olmalı.')
  .max(128)
  .regex(/[A-Za-zÇĞİÖŞÜçğıöşü]/, 'Şifre en az bir harf içermeli.')
  .regex(/\d/, 'Şifre en az bir rakam içermeli.');

export default function authRoutes(db, config) {
  const r = Router();
  const limiter = createLoginLimiter();

  const cookieOptions = (expires) => ({
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    path: '/',
    ...(expires ? { expires: new Date(expires) } : {}),
  });

  r.get('/meta', (_req, res) => {
    res.json({
      appName: getSetting(db, 'app_name', 'FIMAR Holding İK'),
      demo: getSetting(db, 'demo_mode', '0') === '1',
    });
  });

  r.post('/auth/login', (req, res) => {
    const body = parseBody(
      z.object({ email: z.string().trim().min(1, 'E-posta gerekli.'), password: z.string().min(1, 'Şifre gerekli.') }),
      req.body,
    );
    const key = `${req.ip}|${body.email.toLowerCase()}`;
    if (!limiter.check(key)) throw new HttpError(429, 'Çok fazla başarısız deneme. Lütfen 15 dakika sonra tekrar deneyin.');

    const row = db.prepare('SELECT id, password_hash, active FROM users WHERE email = ?').get(body.email);
    if (!row || !verifyPassword(body.password, row.password_hash)) {
      limiter.fail(key);
      throw new HttpError(401, 'E-posta veya şifre hatalı.');
    }
    if (!row.active) throw new HttpError(403, 'Hesabınız pasif durumda. İK birimi ile iletişime geçin.');
    limiter.clear(key);

    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(row.id);
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
    const { token, expires } = createSession(db, row.id, config.sessionDays);
    res.cookie(SESSION_COOKIE, token, cookieOptions(expires));
    const user = loadUser(db, row.id);
    audit(db, { user }, 'giris', 'kullanici', row.id);
    res.json({ user: publicUser(user) });
  });

  r.post('/auth/logout', (req, res) => {
    destroySession(db, req.sessionToken);
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    res.json({ ok: true });
  });

  r.get('/auth/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  r.post('/auth/change-password', requireAuth, (req, res) => {
    const body = parseBody(
      z.object({ current_password: z.string().min(1, 'Mevcut şifrenizi girin.'), new_password: PASSWORD_RULE }),
      req.body,
    );
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!verifyPassword(body.current_password, row.password_hash)) {
      throw new HttpError(400, 'Mevcut şifre hatalı.', { fields: { current_password: 'Mevcut şifre hatalı.' } });
    }
    if (body.current_password === body.new_password) {
      throw new HttpError(400, 'Yeni şifre eskisiyle aynı olamaz.', { fields: { new_password: 'Yeni şifre eskisiyle aynı olamaz.' } });
    }
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(
      hashPassword(body.new_password),
      req.user.id,
    );
    // Diğer oturumları kapat, mevcut oturum açık kalsın.
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(
      req.user.id,
      hashToken(req.sessionToken),
    );
    audit(db, req, 'sifre_degistir', 'kullanici', req.user.id);
    res.json({ ok: true });
  });

  return r;
}
