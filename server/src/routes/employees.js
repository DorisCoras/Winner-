import { Router } from 'express';
import { z } from 'zod';
import { generatePassword, hashPassword, isHR, requireAuth, requireRole } from '../auth.js';
import { getSetting, insertRow, transaction, updateRow } from '../db.js';
import { EMPLOYMENT_TYPES, EXIT_CODES, DOCUMENT_TYPES, ROLES } from '../lib/constants.js';
import { fullYearsBetween, today } from '../lib/dates.js';
import { leaveBalance } from '../lib/leave.js';
import { calculateSeverance } from '../lib/severance.js';
import { isValidTcKimlik, isValidTrIban, normalizeIban } from '../lib/validators.js';
import { HttpError, idParam, notFound, parseBody, zDate, zId, zMoney, zOptDate, zOptId, zOptText, zText } from '../http.js';
import {
  annualLeaveUsage,
  assertCanViewEmployee,
  audit,
  canViewSensitive,
  employeeLeaveBalance,
  payrollParams,
  visibleEmployeeIds,
} from '../services.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const employeeSchema = z.object({
  sicil_no: zText(30, 'Sicil no zorunludur.'),
  first_name: zText(80, 'Ad zorunludur.'),
  last_name: zText(80, 'Soyad zorunludur.'),
  tc_kimlik: zOptText(11).refine((v) => v == null || isValidTcKimlik(v), 'Geçersiz T.C. Kimlik No.'),
  email: zOptText(120).refine((v) => v == null || EMAIL_RE.test(v), 'Geçersiz e-posta adresi.'),
  phone: zOptText(40),
  birth_date: zOptDate,
  gender: z
    .union([z.enum(['K', 'E']), z.literal(''), z.null()])
    .optional()
    .transform((v) => v || null),
  marital_status: zOptText(40),
  blood_type: zOptText(10),
  education: zOptText(40),
  address: zOptText(500),
  city: zOptText(60),
  emergency_contact: zOptText(120),
  emergency_phone: zOptText(40),
  company_id: zId,
  department_id: zOptId,
  position: zOptText(120),
  manager_id: zOptId,
  hire_date: zDate,
  employment_type: z.enum(Object.keys(EMPLOYMENT_TYPES), { message: 'Çalışma şekli seçiniz.' }),
  gross_salary: zMoney,
  iban: zOptText(40)
    .transform((v) => (v ? normalizeIban(v) : null))
    .refine((v) => v == null || isValidTrIban(v), 'Geçersiz IBAN (TR ile başlayan 26 karakter olmalı).'),
  sgk_no: zOptText(40),
  leave_carryover: z.coerce.number().min(-365).max(365).optional().default(0),
  leave_base_date: zOptDate,
  notes: zOptText(2000),
});

const accountSchema = z.object({
  create_account: z.boolean().optional(),
  account_role: z.enum(Object.keys(ROLES)).optional().default('personel'),
  account_password: z.string().min(8, 'Şifre en az 8 karakter olmalı.').max(128).optional().or(z.literal('')),
});

// KVKK: bu alanlar yalnızca İK/yönetici hesapları ve çalışanın kendisi tarafından görülebilir.
const SENSITIVE_FIELDS = [
  'tc_kimlik', 'birth_date', 'marital_status', 'blood_type', 'address', 'city', 'emergency_contact',
  'emergency_phone', 'gross_salary', 'iban', 'sgk_no', 'notes', 'exit_code', 'exit_note', 'leave_carryover', 'leave_base_date',
];

function redact(emp, user) {
  if (canViewSensitive(user, emp.id)) return emp;
  const copy = { ...emp };
  for (const f of SENSITIVE_FIELDS) delete copy[f];
  return copy;
}

const DETAIL_SELECT = `
  SELECT e.*, c.name AS company_name, d.name AS department_name,
         m.first_name || ' ' || m.last_name AS manager_name
  FROM employees e
  JOIN companies c ON c.id = e.company_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN employees m ON m.id = e.manager_id`;

export default function employeeRoutes(db) {
  const r = Router();
  const hr = requireRole('admin', 'ik');

  function validateRelations(b, selfId = null) {
    const fields = {};
    if (!db.prepare('SELECT 1 FROM companies WHERE id = ?').get(b.company_id)) fields.company_id = 'Şirket bulunamadı.';
    if (b.department_id) {
      const dep = db.prepare('SELECT company_id FROM departments WHERE id = ?').get(b.department_id);
      if (!dep) fields.department_id = 'Departman bulunamadı.';
      else if (dep.company_id !== b.company_id) fields.department_id = 'Departman seçilen şirkete ait değil.';
    }
    if (b.manager_id) {
      if (b.manager_id === selfId) fields.manager_id = 'Personel kendisinin yöneticisi olamaz.';
      else {
        // Döngü kontrolü: yöneticinin üst zincirinde bu personel olmamalı.
        let cursor = b.manager_id;
        const seen = new Set();
        while (cursor && !seen.has(cursor)) {
          if (cursor === selfId) {
            fields.manager_id = 'Bu seçim yönetim hiyerarşisinde döngü oluşturur.';
            break;
          }
          seen.add(cursor);
          cursor = db.prepare('SELECT manager_id FROM employees WHERE id = ?').get(cursor)?.manager_id;
        }
        if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(b.manager_id)) fields.manager_id = 'Yönetici bulunamadı.';
      }
    }
    if (b.birth_date && b.birth_date >= b.hire_date) fields.birth_date = 'Doğum tarihi işe giriş tarihinden önce olmalı.';
    if (Object.keys(fields).length) throw new HttpError(400, 'Lütfen form alanlarını kontrol edin.', { fields });
  }

  r.get('/employees/next-sicil', hr, (_req, res) => {
    const prefix = getSetting(db, 'sicil_prefix', 'FMR');
    const rows = db.prepare('SELECT sicil_no FROM employees WHERE sicil_no LIKE ?').all(`${prefix}%`);
    const max = rows.reduce((m, r) => Math.max(m, Number(r.sicil_no.slice(prefix.length)) || 0), 0);
    res.json({ sicil_no: `${prefix}${String(max + 1).padStart(5, '0')}` });
  });

  r.get('/employees', requireRole('admin', 'ik', 'yonetici'), (req, res) => {
    const { q, company_id, department_id, status = 'aktif', manager_id } = req.query;
    const where = [];
    const params = [];
    if (status !== 'all') {
      where.push('e.status = ?');
      params.push(status === 'ayrildi' ? 'ayrildi' : 'aktif');
    }
    if (company_id) {
      where.push('e.company_id = ?');
      params.push(Number(company_id));
    }
    if (department_id) {
      where.push('e.department_id = ?');
      params.push(Number(department_id));
    }
    if (manager_id) {
      where.push('e.manager_id = ?');
      params.push(Number(manager_id));
    }
    if (q) {
      where.push(`(e.first_name || ' ' || e.last_name LIKE ? OR e.sicil_no LIKE ? OR e.position LIKE ? OR e.email LIKE ?)`);
      const like = `%${String(q).trim()}%`;
      params.push(like, like, like, like);
    }
    const visible = visibleEmployeeIds(db, req.user);
    if (visible) {
      const ids = [...visible];
      where.push(`e.id IN (${ids.map(() => '?').join(',') || 'NULL'})`);
      params.push(...ids);
    }
    const rows = db
      .prepare(
        `SELECT e.id, e.sicil_no, e.first_name, e.last_name, e.position, e.email, e.phone, e.gender,
                e.company_id, c.name AS company_name, e.department_id, d.name AS department_name,
                e.manager_id, m.first_name || ' ' || m.last_name AS manager_name,
                e.hire_date, e.employment_type, e.status, e.exit_date, e.birth_date, e.gross_salary
         FROM employees e
         JOIN companies c ON c.id = e.company_id
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN employees m ON m.id = e.manager_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY e.first_name, e.last_name`,
      )
      .all(...params);
    res.json(rows.map((row) => redact(row, req.user)));
  });

  r.get('/employees/:id', requireAuth, (req, res) => {
    const id = idParam(req);
    assertCanViewEmployee(db, req.user, id);
    const emp = db.prepare(`${DETAIL_SELECT} WHERE e.id = ?`).get(id);
    if (!emp) throw notFound('Personel');
    const result = redact(emp, req.user);
    result.leave_balance = employeeLeaveBalance(db, id);
    result.direct_reports = db
      .prepare(
        `SELECT id, first_name, last_name, position FROM employees
         WHERE manager_id = ? AND status = 'aktif' ORDER BY first_name`,
      )
      .all(id);
    result.age = emp.birth_date && canViewSensitive(req.user, id) ? fullYearsBetween(emp.birth_date, today()) : undefined;
    result.service_years = fullYearsBetween(emp.hire_date, emp.exit_date ?? today());
    if (isHR(req.user)) {
      result.account = db
        .prepare('SELECT id, email, role, active, last_login_at FROM users WHERE employee_id = ?')
        .get(id) ?? null;
    }
    res.json(result);
  });

  r.post('/employees', hr, (req, res) => {
    const b = parseBody(employeeSchema, req.body);
    const acc = parseBody(accountSchema, req.body);
    validateRelations(b);
    let tempPassword = null;
    const id = transaction(db, () => {
      const newId = insertRow(db, 'employees', b);
      if (acc.create_account) {
        if (!b.email) throw new HttpError(400, 'Kullanıcı hesabı için e-posta zorunludur.', { fields: { email: 'Hesap için e-posta gerekli.' } });
        if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(b.email)) {
          throw new HttpError(409, 'Bu e-posta ile kayıtlı bir kullanıcı zaten var.', { fields: { email: 'Bu e-posta kullanımda.' } });
        }
        if (acc.account_role === 'admin' && req.user.role !== 'admin') {
          throw new HttpError(403, 'Sistem yöneticisi hesabını yalnızca sistem yöneticileri oluşturabilir.');
        }
        tempPassword = acc.account_password || generatePassword();
        db.prepare(
          'INSERT INTO users (email, password_hash, role, employee_id, must_change_password) VALUES (?, ?, ?, ?, 1)',
        ).run(b.email, hashPassword(tempPassword), acc.account_role, newId);
      }
      return newId;
    });
    audit(db, req, 'olustur', 'personel', id, `${b.first_name} ${b.last_name}`);
    res.status(201).json({ id, temp_password: tempPassword });
  });

  r.put('/employees/:id', hr, (req, res) => {
    const id = idParam(req);
    const b = parseBody(employeeSchema, req.body);
    validateRelations(b, id);
    const before = db.prepare('SELECT gross_salary, position, department_id, company_id FROM employees WHERE id = ?').get(id);
    if (!before) throw notFound('Personel');
    updateRow(db, 'employees', id, { ...b, updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ') });
    const changes = {};
    for (const k of Object.keys(before)) if (before[k] !== b[k]) changes[k] = { eski: before[k], yeni: b[k] };
    audit(db, req, 'guncelle', 'personel', id, Object.keys(changes).length ? changes : null);
    res.json({ id });
  });

  r.delete('/employees/:id', requireRole('admin'), (req, res) => {
    const id = idParam(req);
    const payroll = db.prepare('SELECT COUNT(*) AS n FROM payroll_items WHERE employee_id = ?').get(id).n;
    if (payroll) {
      throw new HttpError(409, 'Bordro kaydı bulunan personel silinemez (yasal saklama yükümlülüğü). İşten çıkış işlemi yapın.');
    }
    transaction(db, () => {
      db.prepare('UPDATE employees SET manager_id = NULL WHERE manager_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE employee_id = ?').run(id);
      if (!db.prepare('DELETE FROM employees WHERE id = ?').run(id).changes) throw notFound('Personel');
    });
    audit(db, req, 'sil', 'personel', id);
    res.json({ ok: true });
  });

  // --- İşten çıkış / tazminat ---

  const terminateSchema = z.object({
    exit_date: zDate,
    exit_code: z.enum(EXIT_CODES.map((c) => c.code), { message: 'Çıkış nedeni seçiniz.' }),
    exit_note: zOptText(1000),
  });

  r.post('/employees/:id/terminate', hr, (req, res) => {
    const id = idParam(req);
    const b = parseBody(terminateSchema, req.body);
    const emp = db.prepare('SELECT id, hire_date, status FROM employees WHERE id = ?').get(id);
    if (!emp) throw notFound('Personel');
    if (emp.status === 'ayrildi') throw new HttpError(409, 'Personel zaten işten ayrılmış.');
    if (b.exit_date < emp.hire_date) throw new HttpError(400, 'Çıkış tarihi işe giriş tarihinden önce olamaz.', { fields: { exit_date: 'İşe giriş tarihinden önce olamaz.' } });
    transaction(db, () => {
      db.prepare(
        "UPDATE employees SET status = 'ayrildi', exit_date = ?, exit_code = ?, exit_note = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(b.exit_date, b.exit_code, b.exit_note, id);
      const user = db.prepare('SELECT id FROM users WHERE employee_id = ?').get(id);
      if (user) {
        db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(user.id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      }
      db.prepare(
        "UPDATE leave_requests SET status = 'iptal', decision_note = 'İşten ayrılış nedeniyle iptal' WHERE employee_id = ? AND status = 'beklemede'",
      ).run(id);
    });
    const openAssets = db
      .prepare('SELECT COUNT(*) AS n FROM asset_assignments WHERE employee_id = ? AND returned_at IS NULL')
      .get(id).n;
    audit(db, req, 'isten_cikis', 'personel', id, b);
    res.json({ ok: true, open_assets: openAssets });
  });

  r.post('/employees/:id/reactivate', hr, (req, res) => {
    const id = idParam(req);
    const b = parseBody(z.object({ hire_date: zOptDate }), req.body);
    const emp = db.prepare('SELECT status FROM employees WHERE id = ?').get(id);
    if (!emp) throw notFound('Personel');
    if (emp.status === 'aktif') throw new HttpError(409, 'Personel zaten aktif.');
    db.prepare(
      `UPDATE employees SET status = 'aktif', exit_date = NULL, exit_code = NULL, exit_note = NULL,
         hire_date = COALESCE(?, hire_date), updated_at = datetime('now') WHERE id = ?`,
    ).run(b.hire_date, id);
    db.prepare('UPDATE users SET active = 1 WHERE employee_id = ?').run(id);
    audit(db, req, 'yeniden_aktif', 'personel', id);
    res.json({ ok: true });
  });

  r.post('/employees/:id/severance', hr, (req, res) => {
    const id = idParam(req);
    const b = parseBody(
      z.object({
        exit_date: zDate,
        exit_code: z.string().optional(),
        include_kidem: z.boolean().optional(),
        include_ihbar: z.boolean().optional(),
        extra_monthly: z.coerce.number().min(0).optional().default(0),
        income_tax_rate: z.coerce.number().min(0).max(0.4).optional().default(0.15),
      }),
      req.body,
    );
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!emp) throw notFound('Personel');
    if (b.exit_date < emp.hire_date) throw new HttpError(400, 'Çıkış tarihi işe giriş tarihinden önce olamaz.');
    const code = EXIT_CODES.find((c) => c.code === b.exit_code);
    const { used } = annualLeaveUsage(db, id, emp.leave_base_date);
    const balance = leaveBalance({
      hireDate: emp.hire_date,
      birthDate: emp.birth_date,
      carryover: emp.leave_carryover,
      baseDate: emp.leave_base_date,
      usedDays: used,
      asOf: b.exit_date,
    });
    const params = payrollParams(db, Number(b.exit_date.slice(0, 4)));
    const result = calculateSeverance({
      hireDate: emp.hire_date,
      exitDate: b.exit_date,
      monthlyGross: emp.gross_salary,
      extraMonthly: b.extra_monthly,
      params,
      includeKidem: b.include_kidem ?? code?.kidem ?? true,
      includeIhbar: b.include_ihbar ?? code?.ihbar ?? false,
      unusedLeaveDays: Math.max(0, balance.balance),
      incomeTaxRate: b.income_tax_rate,
    });
    res.json({ ...result, exit_code: code ?? null });
  });

  // --- Özlük dosyası belgeleri ---

  r.get('/employees/:id/documents', requireAuth, (req, res) => {
    const id = idParam(req);
    if (!canViewSensitive(req.user, id)) throw new HttpError(403, 'Bu personelin özlük dosyasını görüntüleme yetkiniz yok.');
    const rows = db.prepare('SELECT * FROM employee_documents WHERE employee_id = ?').all(id);
    const byType = new Map(rows.map((r) => [r.doc_type, r]));
    const list = DOCUMENT_TYPES.map((t) => ({ ...t, record: byType.get(t.code) ?? null }));
    res.json(list);
  });

  r.put('/employees/:id/documents/:type', hr, (req, res) => {
    const id = idParam(req);
    const type = req.params.type;
    if (!DOCUMENT_TYPES.some((t) => t.code === type)) throw new HttpError(400, 'Geçersiz belge türü.');
    const b = parseBody(z.object({ received_date: zOptDate, expiry_date: zOptDate, notes: zOptText(500) }), req.body);
    if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(id)) throw notFound('Personel');
    db.prepare(
      `INSERT INTO employee_documents (employee_id, doc_type, received_date, expiry_date, notes)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(employee_id, doc_type) DO UPDATE SET received_date = excluded.received_date,
         expiry_date = excluded.expiry_date, notes = excluded.notes`,
    ).run(id, type, b.received_date, b.expiry_date, b.notes);
    audit(db, req, 'belge_guncelle', 'personel', id, type);
    res.json({ ok: true });
  });

  r.delete('/employees/:id/documents/:type', hr, (req, res) => {
    const id = idParam(req);
    db.prepare('DELETE FROM employee_documents WHERE employee_id = ? AND doc_type = ?').run(id, req.params.type);
    audit(db, req, 'belge_sil', 'personel', id, req.params.type);
    res.json({ ok: true });
  });

  return r;
}
