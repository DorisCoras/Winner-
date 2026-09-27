// Duyurular ve performans değerlendirmeleri.
import { Router } from 'express';
import { z } from 'zod';
import { isHR, requireAuth, requireRole } from '../auth.js';
import { insertRow, updateRow } from '../db.js';
import { REVIEW_CRITERIA } from '../lib/constants.js';
import { HttpError, idParam, notFound, parseBody, zBool, zOptId, zOptText, zText } from '../http.js';
import { audit, subordinateIds, visibleEmployeeIds } from '../services.js';

const announcementSchema = z.object({
  company_id: zOptId,
  title: zText(200, 'Başlık zorunludur.'),
  body: zText(10000, 'Duyuru metni zorunludur.'),
  pinned: zBool,
});

const reviewSchema = z.object({
  employee_id: z.coerce.number({ message: 'Personel seçiniz.' }).int().positive('Personel seçiniz.'),
  period: zText(60, 'Dönem zorunludur (ör. 2026 Yıl Sonu).'),
  scores: z.record(z.string(), z.coerce.number().int().min(1).max(5)).default({}),
  strengths: zOptText(3000),
  improvements: zOptText(3000),
  goals: zOptText(3000),
  status: z.enum(['taslak', 'tamamlandi']).optional().default('taslak'),
});

const REVIEW_SELECT = `
  SELECT pr.*, e.first_name || ' ' || e.last_name AS employee_name, e.position, e.sicil_no,
         e.department_id, d.name AS department_name, c.name AS company_name,
         COALESCE(re.first_name || ' ' || re.last_name, u.email) AS reviewer_name
  FROM performance_reviews pr
  JOIN employees e ON e.id = pr.employee_id
  JOIN companies c ON c.id = e.company_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN users u ON u.id = pr.reviewer_id
  LEFT JOIN employees re ON re.id = u.employee_id`;

function overallScore(scores) {
  const values = REVIEW_CRITERIA.map((c) => scores[c.code]).filter((v) => typeof v === 'number');
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

const parseReview = (row) => row && { ...row, scores: JSON.parse(row.scores || '{}') };

export default function engagementRoutes(db) {
  const r = Router();
  const hr = requireRole('admin', 'ik');

  // --- Duyurular ---
  r.get('/announcements', requireAuth, (req, res) => {
    const companyFilter = isHR(req.user) ? '' : 'WHERE a.company_id IS NULL OR a.company_id = ?';
    const params = isHR(req.user) ? [] : [req.user.company_id ?? -1];
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json(
      db
        .prepare(
          `SELECT a.*, c.name AS company_name,
             COALESCE(e.first_name || ' ' || e.last_name, u.email) AS author_name
           FROM announcements a
           LEFT JOIN companies c ON c.id = a.company_id
           LEFT JOIN users u ON u.id = a.created_by
           LEFT JOIN employees e ON e.id = u.employee_id
           ${companyFilter}
           ORDER BY a.pinned DESC, a.created_at DESC LIMIT ${limit}`,
        )
        .all(...params),
    );
  });

  r.post('/announcements', hr, (req, res) => {
    const b = parseBody(announcementSchema, req.body);
    const id = insertRow(db, 'announcements', { ...b, created_by: req.user.id });
    audit(db, req, 'olustur', 'duyuru', id, b.title);
    res.status(201).json(db.prepare('SELECT * FROM announcements WHERE id = ?').get(id));
  });

  r.put('/announcements/:id', hr, (req, res) => {
    const id = idParam(req);
    const b = parseBody(announcementSchema, req.body);
    if (!updateRow(db, 'announcements', id, b)) throw notFound('Duyuru');
    audit(db, req, 'guncelle', 'duyuru', id, b.title);
    res.json(db.prepare('SELECT * FROM announcements WHERE id = ?').get(id));
  });

  r.delete('/announcements/:id', hr, (req, res) => {
    const id = idParam(req);
    if (!db.prepare('DELETE FROM announcements WHERE id = ?').run(id).changes) throw notFound('Duyuru');
    audit(db, req, 'sil', 'duyuru', id);
    res.json({ ok: true });
  });

  // --- Performans değerlendirmeleri ---

  function canWriteReview(user, employeeId) {
    if (employeeId === user.employee_id) return false; // kimse kendini değerlendiremez
    if (isHR(user)) return true;
    return user.role === 'yonetici' && subordinateIds(db, user.employee_id).includes(employeeId);
  }

  r.get('/reviews', requireAuth, (req, res) => {
    const where = [];
    const params = [];
    const visible = visibleEmployeeIds(db, req.user);
    if (visible) {
      const ids = [...visible];
      where.push(`pr.employee_id IN (${ids.map(() => '?').join(',') || 'NULL'})`);
      params.push(...ids);
    }
    // Çalışan (İK dahil) kendi değerlendirmesini yalnızca tamamlandığında görür.
    where.push("(pr.employee_id != ? OR pr.status = 'tamamlandi')");
    params.push(req.user.employee_id ?? -1);
    if (req.query.employee_id) {
      where.push('pr.employee_id = ?');
      params.push(Number(req.query.employee_id));
    }
    if (req.query.period) {
      where.push('pr.period = ?');
      params.push(String(req.query.period));
    }
    const rows = db
      .prepare(`${REVIEW_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY pr.updated_at DESC`)
      .all(...params)
      .map(parseReview)
      .map((row) => ({ ...row, can_edit: canWriteReview(req.user, row.employee_id) && (row.status === 'taslak' || isHR(req.user)) }));
    res.json(rows);
  });

  r.get('/reviews/:id', requireAuth, (req, res) => {
    const id = idParam(req);
    const row = parseReview(db.prepare(`${REVIEW_SELECT} WHERE pr.id = ?`).get(id));
    if (!row) throw notFound('Değerlendirme');
    const visible = visibleEmployeeIds(db, req.user);
    if (visible && !visible.has(row.employee_id)) throw new HttpError(403, 'Bu değerlendirmeyi görüntüleme yetkiniz yok.');
    if (row.employee_id === req.user.employee_id && row.status !== 'tamamlandi') throw notFound('Değerlendirme');
    res.json({ ...row, can_edit: canWriteReview(req.user, row.employee_id) && (row.status === 'taslak' || isHR(req.user)) });
  });

  r.post('/reviews', requireAuth, (req, res) => {
    const b = parseBody(reviewSchema, req.body);
    if (!canWriteReview(req.user, b.employee_id)) throw new HttpError(403, 'Yalnızca ekibinizdeki personeli değerlendirebilirsiniz.');
    const id = insertRow(db, 'performance_reviews', {
      ...b,
      scores: JSON.stringify(b.scores),
      overall: overallScore(b.scores),
      reviewer_id: req.user.id,
    });
    audit(db, req, 'olustur', 'performans', id, { employee_id: b.employee_id, period: b.period });
    res.status(201).json({ ...parseReview(db.prepare(`${REVIEW_SELECT} WHERE pr.id = ?`).get(id)), can_edit: true });
  });

  r.put('/reviews/:id', requireAuth, (req, res) => {
    const id = idParam(req);
    const b = parseBody(reviewSchema, req.body);
    const current = db.prepare('SELECT employee_id, status FROM performance_reviews WHERE id = ?').get(id);
    if (!current) throw notFound('Değerlendirme');
    if (!canWriteReview(req.user, current.employee_id) || (current.status === 'tamamlandi' && !isHR(req.user))) {
      throw new HttpError(403, 'Bu değerlendirmeyi düzenleme yetkiniz yok.');
    }
    updateRow(db, 'performance_reviews', id, {
      period: b.period,
      scores: JSON.stringify(b.scores),
      overall: overallScore(b.scores),
      strengths: b.strengths,
      improvements: b.improvements,
      goals: b.goals,
      status: b.status,
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    audit(db, req, 'guncelle', 'performans', id);
    const updated = parseReview(db.prepare(`${REVIEW_SELECT} WHERE pr.id = ?`).get(id));
    res.json({ ...updated, can_edit: updated.status === 'taslak' || isHR(req.user) });
  });

  r.post('/reviews/:id/acknowledge', requireAuth, (req, res) => {
    const id = idParam(req);
    const row = db.prepare('SELECT employee_id, status FROM performance_reviews WHERE id = ?').get(id);
    if (!row || row.employee_id !== req.user.employee_id || row.status !== 'tamamlandi') throw notFound('Değerlendirme');
    db.prepare("UPDATE performance_reviews SET acknowledged_at = datetime('now') WHERE id = ? AND acknowledged_at IS NULL").run(id);
    audit(db, req, 'okundu', 'performans', id);
    res.json({ ok: true });
  });

  r.delete('/reviews/:id', requireAuth, (req, res) => {
    const id = idParam(req);
    const current = db.prepare('SELECT employee_id, status, reviewer_id FROM performance_reviews WHERE id = ?').get(id);
    if (!current) throw notFound('Değerlendirme');
    const allowed = isHR(req.user) || (current.status === 'taslak' && current.reviewer_id === req.user.id);
    if (!allowed) throw new HttpError(403, 'Bu değerlendirmeyi silme yetkiniz yok.');
    db.prepare('DELETE FROM performance_reviews WHERE id = ?').run(id);
    audit(db, req, 'sil', 'performans', id);
    res.json({ ok: true });
  });

  return r;
}
