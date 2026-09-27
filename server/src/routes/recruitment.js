import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { insertRow, updateRow } from '../db.js';
import { CANDIDATE_STAGES, EMPLOYMENT_TYPES, JOB_STATUSES } from '../lib/constants.js';
import { HttpError, idParam, notFound, parseBody, zOptDate, zOptId, zOptText, zText } from '../http.js';
import { audit } from '../services.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const jobSchema = z.object({
  company_id: z.coerce.number({ message: 'Şirket seçiniz.' }).int().positive('Şirket seçiniz.'),
  department_id: zOptId,
  title: zText(150, 'Pozisyon adı zorunludur.'),
  description: zOptText(5000),
  location: zOptText(120),
  employment_type: z.enum(Object.keys(EMPLOYMENT_TYPES)).optional().default('tam_zamanli'),
  openings: z.coerce.number().int().min(1).max(500).optional().default(1),
  status: z.enum(Object.keys(JOB_STATUSES)).optional().default('acik'),
  closes_at: zOptDate,
});

const candidateSchema = z.object({
  posting_id: z.coerce.number({ message: 'İlan seçiniz.' }).int().positive('İlan seçiniz.'),
  first_name: zText(80, 'Ad zorunludur.'),
  last_name: zText(80, 'Soyad zorunludur.'),
  email: zOptText(120).refine((v) => v == null || EMAIL_RE.test(v), 'Geçersiz e-posta adresi.'),
  phone: zOptText(40),
  source: zOptText(60),
  stage: z.enum(Object.keys(CANDIDATE_STAGES)).optional().default('basvuru'),
  rating: z
    .union([z.coerce.number().int().min(1).max(5), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v == null ? null : v)),
  expected_salary: z
    .union([z.coerce.number().min(0), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v == null ? null : v)),
  notes: zOptText(5000),
});

export default function recruitmentRoutes(db) {
  const r = Router();
  const hr = requireRole('admin', 'ik');
  r.use(['/jobs', '/candidates'], hr);

  r.get('/jobs', (req, res) => {
    const status = req.query.status;
    const rows = db
      .prepare(
        `SELECT j.*, c.name AS company_name, d.name AS department_name,
           (SELECT COUNT(*) FROM candidates x WHERE x.posting_id = j.id) AS candidate_count,
           (SELECT COUNT(*) FROM candidates x WHERE x.posting_id = j.id AND x.stage NOT IN ('ise_alindi', 'red')) AS active_candidates,
           (SELECT COUNT(*) FROM candidates x WHERE x.posting_id = j.id AND x.stage = 'ise_alindi') AS hired_count
         FROM job_postings j
         JOIN companies c ON c.id = j.company_id
         LEFT JOIN departments d ON d.id = j.department_id
         WHERE (? IS NULL OR j.status = ?)
         ORDER BY CASE j.status WHEN 'acik' THEN 0 WHEN 'beklemede' THEN 1 ELSE 2 END, j.created_at DESC`,
      )
      .all(status ?? null, status ?? null);
    res.json(rows);
  });

  r.get('/jobs/:id', (req, res) => {
    const id = idParam(req);
    const job = db
      .prepare(
        `SELECT j.*, c.name AS company_name, d.name AS department_name FROM job_postings j
         JOIN companies c ON c.id = j.company_id LEFT JOIN departments d ON d.id = j.department_id WHERE j.id = ?`,
      )
      .get(id);
    if (!job) throw notFound('İlan');
    res.json(job);
  });

  r.post('/jobs', (req, res) => {
    const b = parseBody(jobSchema, req.body);
    const id = insertRow(db, 'job_postings', b);
    audit(db, req, 'olustur', 'ilan', id, b.title);
    res.status(201).json(db.prepare('SELECT * FROM job_postings WHERE id = ?').get(id));
  });

  r.put('/jobs/:id', (req, res) => {
    const id = idParam(req);
    const b = parseBody(jobSchema, req.body);
    if (!updateRow(db, 'job_postings', id, b)) throw notFound('İlan');
    audit(db, req, 'guncelle', 'ilan', id, b.title);
    res.json(db.prepare('SELECT * FROM job_postings WHERE id = ?').get(id));
  });

  r.delete('/jobs/:id', (req, res) => {
    const id = idParam(req);
    if (!db.prepare('DELETE FROM job_postings WHERE id = ?').run(id).changes) throw notFound('İlan');
    audit(db, req, 'sil', 'ilan', id);
    res.json({ ok: true });
  });

  r.get('/candidates', (req, res) => {
    const postingId = req.query.posting_id ? Number(req.query.posting_id) : null;
    const rows = db
      .prepare(
        `SELECT x.*, j.title AS posting_title, j.company_id, j.department_id, c.name AS company_name
         FROM candidates x JOIN job_postings j ON j.id = x.posting_id JOIN companies c ON c.id = j.company_id
         WHERE (? IS NULL OR x.posting_id = ?)
         ORDER BY x.updated_at DESC`,
      )
      .all(postingId, postingId);
    res.json(rows);
  });

  r.post('/candidates', (req, res) => {
    const b = parseBody(candidateSchema, req.body);
    if (!db.prepare('SELECT 1 FROM job_postings WHERE id = ?').get(b.posting_id)) throw notFound('İlan');
    const id = insertRow(db, 'candidates', b);
    audit(db, req, 'olustur', 'aday', id, `${b.first_name} ${b.last_name}`);
    res.status(201).json(db.prepare('SELECT * FROM candidates WHERE id = ?').get(id));
  });

  r.put('/candidates/:id', (req, res) => {
    const id = idParam(req);
    const b = parseBody(candidateSchema, req.body);
    if (!updateRow(db, 'candidates', id, { ...b, updated_at: sqlNow() })) throw notFound('Aday');
    audit(db, req, 'guncelle', 'aday', id);
    res.json(db.prepare('SELECT * FROM candidates WHERE id = ?').get(id));
  });

  r.patch('/candidates/:id/stage', (req, res) => {
    const id = idParam(req);
    const b = parseBody(
      z.object({ stage: z.enum(Object.keys(CANDIDATE_STAGES), { message: 'Geçersiz aşama.' }), employee_id: zOptId }),
      req.body,
    );
    const patch = { stage: b.stage, updated_at: sqlNow() };
    if (b.employee_id) {
      if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(b.employee_id)) throw new HttpError(400, 'Personel bulunamadı.');
      patch.employee_id = b.employee_id;
    }
    if (!updateRow(db, 'candidates', id, patch)) throw notFound('Aday');
    audit(db, req, 'asama_degistir', 'aday', id, b.stage);
    res.json(db.prepare('SELECT * FROM candidates WHERE id = ?').get(id));
  });

  r.delete('/candidates/:id', (req, res) => {
    const id = idParam(req);
    if (!db.prepare('DELETE FROM candidates WHERE id = ?').run(id).changes) throw notFound('Aday');
    audit(db, req, 'sil', 'aday', id);
    res.json({ ok: true });
  });

  return r;
}

const sqlNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
