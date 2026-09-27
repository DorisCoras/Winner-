// Şirketler, departmanlar, açılır listeler ve personel rehberi.
import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import * as C from '../lib/constants.js';
import { HttpError, idParam, notFound, parseBody, zOptId, zOptText, zText, zBool } from '../http.js';
import { audit } from '../services.js';
import { insertRow, updateRow } from '../db.js';

const companySchema = z.object({
  name: zText(200, 'Şirket unvanı zorunludur.'),
  short_name: zOptText(60),
  is_holding: zBool,
  tax_office: zOptText(100),
  tax_no: zOptText(20),
  sgk_no: zOptText(40),
  address: zOptText(500),
  phone: zOptText(40),
  email: zOptText(120),
  active: z
    .union([z.boolean(), z.literal(0), z.literal(1)])
    .optional()
    .transform((v) => (v === undefined ? 1 : v ? 1 : 0)),
});

const departmentSchema = z.object({
  company_id: z.coerce.number({ message: 'Şirket seçiniz.' }).int().positive('Şirket seçiniz.'),
  name: zText(120, 'Departman adı zorunludur.'),
  manager_id: zOptId,
});

export default function organizationRoutes(db) {
  const r = Router();
  const hr = requireRole('admin', 'ik');

  r.get('/lookups', (_req, res) => {
    res.json({
      companies: db.prepare('SELECT id, name, short_name, is_holding, active FROM companies ORDER BY is_holding DESC, name').all(),
      departments: db
        .prepare('SELECT d.id, d.company_id, d.name, d.manager_id FROM departments d ORDER BY d.name')
        .all(),
      leaveTypes: db.prepare('SELECT * FROM leave_types WHERE active = 1 ORDER BY sort, name').all(),
      roles: C.ROLES,
      employmentTypes: C.EMPLOYMENT_TYPES,
      educationLevels: C.EDUCATION_LEVELS,
      maritalStatuses: C.MARITAL_STATUSES,
      bloodTypes: C.BLOOD_TYPES,
      leaveStatuses: C.LEAVE_STATUSES,
      exitCodes: C.EXIT_CODES,
      documentTypes: C.DOCUMENT_TYPES,
      assetCategories: C.ASSET_CATEGORIES,
      assetStatuses: C.ASSET_STATUSES,
      jobStatuses: C.JOB_STATUSES,
      candidateStages: C.CANDIDATE_STAGES,
      candidateSources: C.CANDIDATE_SOURCES,
      reviewCriteria: C.REVIEW_CRITERIA,
    });
  });

  // Rehber: tüm çalışanların herkese açık iş bilgileri (organizasyon şeması da bunu kullanır).
  r.get('/directory', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT e.id, e.first_name, e.last_name, e.position, e.email, e.phone, e.manager_id,
                e.company_id, c.name AS company_name, e.department_id, d.name AS department_name, e.hire_date
         FROM employees e
         JOIN companies c ON c.id = e.company_id
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE e.status = 'aktif'
         ORDER BY e.first_name, e.last_name`,
      )
      .all();
    res.json(rows);
  });

  // --- Şirketler ---
  r.get('/companies', (_req, res) => {
    res.json(
      db
        .prepare(
          `SELECT c.*,
             (SELECT COUNT(*) FROM employees e WHERE e.company_id = c.id AND e.status = 'aktif') AS employee_count,
             (SELECT COUNT(*) FROM departments d WHERE d.company_id = c.id) AS department_count
           FROM companies c ORDER BY c.is_holding DESC, c.name`,
        )
        .all(),
    );
  });

  r.get('/companies/:id', (req, res) => {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(idParam(req));
    if (!company) throw notFound('Şirket');
    res.json(company);
  });

  r.post('/companies', hr, (req, res) => {
    const b = parseBody(companySchema, req.body);
    const id = insertRow(db, 'companies', b);
    audit(db, req, 'olustur', 'sirket', id, b.name);
    res.status(201).json(db.prepare('SELECT * FROM companies WHERE id = ?').get(id));
  });

  r.put('/companies/:id', hr, (req, res) => {
    const id = idParam(req);
    const b = parseBody(companySchema, req.body);
    if (!updateRow(db, 'companies', id, b)) throw notFound('Şirket');
    audit(db, req, 'guncelle', 'sirket', id, b.name);
    res.json(db.prepare('SELECT * FROM companies WHERE id = ?').get(id));
  });

  r.delete('/companies/:id', requireRole('admin'), (req, res) => {
    const id = idParam(req);
    const used = db.prepare('SELECT COUNT(*) AS n FROM employees WHERE company_id = ?').get(id).n;
    if (used) throw new HttpError(409, 'Bu şirkete bağlı personel kayıtları var; önce personeli taşıyın veya şirketi pasife alın.');
    const info = db.prepare('DELETE FROM companies WHERE id = ?').run(id);
    if (!info.changes) throw notFound('Şirket');
    audit(db, req, 'sil', 'sirket', id);
    res.json({ ok: true });
  });

  // --- Departmanlar ---
  r.get('/departments', (req, res) => {
    const companyId = req.query.company_id ? Number(req.query.company_id) : null;
    res.json(
      db
        .prepare(
          `SELECT d.*, c.name AS company_name,
             m.first_name || ' ' || m.last_name AS manager_name,
             (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id AND e.status = 'aktif') AS employee_count
           FROM departments d
           JOIN companies c ON c.id = d.company_id
           LEFT JOIN employees m ON m.id = d.manager_id
           WHERE (? IS NULL OR d.company_id = ?)
           ORDER BY c.is_holding DESC, c.name, d.name`,
        )
        .all(companyId, companyId),
    );
  });

  function validateDepartment(b) {
    if (!db.prepare('SELECT 1 FROM companies WHERE id = ?').get(b.company_id)) {
      throw new HttpError(400, 'Şirket bulunamadı.', { fields: { company_id: 'Şirket bulunamadı.' } });
    }
    if (b.manager_id) {
      const m = db.prepare('SELECT status FROM employees WHERE id = ?').get(b.manager_id);
      if (!m || m.status !== 'aktif') {
        throw new HttpError(400, 'Departman yöneticisi aktif bir personel olmalı.', { fields: { manager_id: 'Aktif bir personel seçiniz.' } });
      }
    }
  }

  r.post('/departments', hr, (req, res) => {
    const b = parseBody(departmentSchema, req.body);
    validateDepartment(b);
    const id = insertRow(db, 'departments', b);
    audit(db, req, 'olustur', 'departman', id, b.name);
    res.status(201).json(db.prepare('SELECT * FROM departments WHERE id = ?').get(id));
  });

  r.put('/departments/:id', hr, (req, res) => {
    const id = idParam(req);
    const b = parseBody(departmentSchema, req.body);
    validateDepartment(b);
    if (!updateRow(db, 'departments', id, b)) throw notFound('Departman');
    audit(db, req, 'guncelle', 'departman', id, b.name);
    res.json(db.prepare('SELECT * FROM departments WHERE id = ?').get(id));
  });

  r.delete('/departments/:id', hr, (req, res) => {
    const id = idParam(req);
    const info = db.prepare('DELETE FROM departments WHERE id = ?').run(id);
    if (!info.changes) throw notFound('Departman');
    audit(db, req, 'sil', 'departman', id);
    res.json({ ok: true });
  });

  return r;
}
