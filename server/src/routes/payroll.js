import { Router } from 'express';
import { z } from 'zod';
import { isHR, requireAuth, requireRole } from '../auth.js';
import { insertRow, transaction, updateRow } from '../db.js';
import { annualFromGross, annualFromNet } from '../lib/payroll.js';
import { HttpError, idParam, notFound, parseBody, zOptText } from '../http.js';
import { audit, computePayrollItem, employerIncentive, fillPayrollRun, payrollParams } from '../services.js';

const paramsSchema = z.object({
  minWageGross: z.coerce.number().positive('Asgari ücret pozitif olmalı.'),
  sgkEmployeeRate: z.coerce.number().min(0).max(1),
  unemploymentEmployeeRate: z.coerce.number().min(0).max(1),
  sgkEmployerRate: z.coerce.number().min(0).max(1),
  unemploymentEmployerRate: z.coerce.number().min(0).max(1),
  employerIncentiveRate: z.coerce.number().min(0).max(1),
  stampTaxRate: z.coerce.number().min(0).max(1),
  sgkCeilingMultiplier: z.coerce.number().positive(),
  severanceCeiling: z.coerce.number().positive(),
  brackets: z
    .array(
      z.object({
        upTo: z.union([z.coerce.number().positive(), z.null()]),
        rate: z.coerce.number().min(0).max(1),
      }),
    )
    .min(1)
    .refine((list) => list.at(-1).upTo === null, 'Son dilimin üst sınırı boş (sınırsız) olmalı.')
    .refine(
      (list) => list.slice(0, -1).every((b, i, arr) => b.upTo !== null && (i === 0 || b.upTo > arr[i - 1].upTo)),
      'Dilim sınırları artan sırada olmalı.',
    ),
});

const RUN_SELECT = `
  SELECT r.*, c.name AS company_name,
    (SELECT COUNT(*) FROM payroll_items i WHERE i.run_id = r.id) AS employee_count,
    (SELECT COALESCE(SUM(gross), 0) FROM payroll_items i WHERE i.run_id = r.id) AS total_gross,
    (SELECT COALESCE(SUM(net), 0) FROM payroll_items i WHERE i.run_id = r.id) AS total_net,
    (SELECT COALESCE(SUM(employer_cost), 0) FROM payroll_items i WHERE i.run_id = r.id) AS total_cost
  FROM payroll_runs r JOIN companies c ON c.id = r.company_id`;

const ITEM_SELECT = `
  SELECT i.*, e.first_name || ' ' || e.last_name AS employee_name, e.sicil_no, e.tc_kimlik, e.position,
         e.iban, e.hire_date, e.sgk_no, d.name AS department_name,
         r.year, r.month, r.status AS run_status, r.company_id, c.name AS company_name,
         c.address AS company_address, c.tax_office AS company_tax_office, c.tax_no AS company_tax_no,
         c.sgk_no AS company_sgk_no
  FROM payroll_items i
  JOIN payroll_runs r ON r.id = i.run_id
  JOIN employees e ON e.id = i.employee_id
  JOIN companies c ON c.id = r.company_id
  LEFT JOIN departments d ON d.id = e.department_id`;

export default function payrollRoutes(db) {
  const r = Router();
  const hr = requireRole('admin', 'ik');

  // --- Parametreler ---
  r.get('/payroll/params', requireAuth, (_req, res) => {
    const stored = db.prepare('SELECT year FROM payroll_params ORDER BY year').all().map((x) => x.year);
    res.json({ years: stored, incentive: employerIncentive(db) });
  });

  r.get('/payroll/params/:year', requireAuth, (req, res) => {
    const year = idParam(req, 'year');
    res.json({ year, ...payrollParams(db, year) });
  });

  r.put('/payroll/params/:year', hr, (req, res) => {
    const year = idParam(req, 'year');
    if (year < 2000 || year > 2100) throw new HttpError(400, 'Geçersiz yıl.');
    const b = parseBody(paramsSchema, req.body);
    db.prepare(
      'INSERT INTO payroll_params (year, data) VALUES (?, ?) ON CONFLICT(year) DO UPDATE SET data = excluded.data',
    ).run(year, JSON.stringify(b));
    audit(db, req, 'guncelle', 'bordro_parametre', year, b);
    res.json({ year, ...b });
  });

  // --- Hesaplayıcı (herkes kullanabilir) ---
  r.post('/payroll/calculate', requireAuth, (req, res) => {
    const b = parseBody(
      z.object({
        amount: z.coerce.number({ message: 'Tutar giriniz.' }).positive('Tutar pozitif olmalı.').max(100_000_000),
        mode: z.enum(['gross', 'net']).default('gross'),
        year: z.coerce.number().int().min(2000).max(2100),
        incentive: z.boolean().optional(),
      }),
      req.body,
    );
    const params = payrollParams(db, b.year);
    const incentive = b.incentive ?? employerIncentive(db);
    const result =
      b.mode === 'gross'
        ? annualFromGross({ gross: b.amount, params, incentive })
        : annualFromNet({ net: b.amount, params, incentive });
    res.json({ ...result, params: { year: b.year, ...params }, incentive });
  });

  // --- Bordro dönemleri ---
  r.get('/payroll/runs', hr, (req, res) => {
    const where = [];
    const params = [];
    if (req.query.year) {
      where.push('r.year = ?');
      params.push(Number(req.query.year));
    }
    if (req.query.company_id) {
      where.push('r.company_id = ?');
      params.push(Number(req.query.company_id));
    }
    res.json(
      db
        .prepare(`${RUN_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.year DESC, r.month DESC, c.name`)
        .all(...params),
    );
  });

  r.post('/payroll/runs', hr, (req, res) => {
    const b = parseBody(
      z.object({
        company_id: z.coerce.number({ message: 'Şirket seçiniz.' }).int().positive('Şirket seçiniz.'),
        year: z.coerce.number().int().min(2000).max(2100),
        month: z.coerce.number().int().min(1).max(12),
      }),
      req.body,
    );
    if (!db.prepare('SELECT 1 FROM companies WHERE id = ?').get(b.company_id)) throw notFound('Şirket');
    if (db.prepare('SELECT 1 FROM payroll_runs WHERE company_id = ? AND year = ? AND month = ?').get(b.company_id, b.year, b.month)) {
      throw new HttpError(409, 'Bu şirket ve dönem için bordro zaten oluşturulmuş.');
    }
    payrollParams(db, b.year); // parametre yoksa hata verir
    const id = transaction(db, () => {
      const runId = insertRow(db, 'payroll_runs', { ...b, created_by: req.user.id });
      const count = fillPayrollRun(db, runId, b.company_id, b.year, b.month);
      if (!count) throw new HttpError(400, 'Bu dönemde bordroya girecek aktif personel bulunamadı.');
      return runId;
    });
    audit(db, req, 'olustur', 'bordro', id, b);
    res.status(201).json(db.prepare(`${RUN_SELECT} WHERE r.id = ?`).get(id));
  });

  r.get('/payroll/runs/:id', hr, (req, res) => {
    const id = idParam(req);
    const run = db.prepare(`${RUN_SELECT} WHERE r.id = ?`).get(id);
    if (!run) throw notFound('Bordro');
    const items = db.prepare(`${ITEM_SELECT} WHERE i.run_id = ? ORDER BY employee_name`).all(id);
    const existing = new Set(
      db
        .prepare('SELECT month FROM payroll_runs WHERE company_id = ? AND year = ? AND month < ?')
        .all(run.company_id, run.year, run.month)
        .map((x) => x.month),
    );
    const missing = run.month - 1 - existing.size;
    const warnings = missing
      ? [`Bu yıl için önceki ${missing} ayın bordrosu sistemde yok; kümülatif gelir vergisi matrahı eksik hesaplanmış olabilir.`]
      : [];
    res.json({ ...run, items, warnings });
  });

  function assertDraft(runId) {
    const run = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(runId);
    if (!run) throw notFound('Bordro');
    if (run.status !== 'taslak') throw new HttpError(409, 'Onaylanmış bordro değiştirilemez.');
    return run;
  }

  r.put('/payroll/runs/:id/items/:itemId', hr, (req, res) => {
    const runId = idParam(req);
    const itemId = idParam(req, 'itemId');
    const run = assertDraft(runId);
    const b = parseBody(
      z.object({
        days: z.coerce.number().int().min(0).max(30),
        extra_gross: z.coerce.number().min(0),
        deductions: z.coerce.number().min(0),
        note: zOptText(300),
      }),
      req.body,
    );
    const item = db.prepare('SELECT * FROM payroll_items WHERE id = ? AND run_id = ?').get(itemId, runId);
    if (!item) throw notFound('Bordro satırı');
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(item.employee_id);
    const computed = computePayrollItem(db, {
      employee: emp,
      companyId: run.company_id,
      year: run.year,
      month: run.month,
      runId,
      extraGross: b.extra_gross,
      deductions: b.deductions,
      days: b.days,
    });
    updateRow(db, 'payroll_items', itemId, { ...computed, note: b.note });
    audit(db, req, 'guncelle', 'bordro_satiri', itemId, b);
    res.json(db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(itemId));
  });

  r.post('/payroll/runs/:id/recalculate', hr, (req, res) => {
    const id = idParam(req);
    const run = assertDraft(id);
    transaction(db, () => {
      const prev = new Map(
        db.prepare('SELECT employee_id, extra_gross, deductions, note FROM payroll_items WHERE run_id = ?').all(id).map((i) => [i.employee_id, i]),
      );
      db.prepare('DELETE FROM payroll_items WHERE run_id = ?').run(id);
      fillPayrollRun(db, id, run.company_id, run.year, run.month, prev);
    });
    audit(db, req, 'yeniden_hesapla', 'bordro', id);
    res.json({ ok: true });
  });

  r.post('/payroll/runs/:id/approve', hr, (req, res) => {
    const id = idParam(req);
    assertDraft(id);
    db.prepare("UPDATE payroll_runs SET status = 'onaylandi', approved_by = ?, approved_at = datetime('now') WHERE id = ?").run(req.user.id, id);
    audit(db, req, 'onayla', 'bordro', id);
    res.json(db.prepare(`${RUN_SELECT} WHERE r.id = ?`).get(id));
  });

  r.post('/payroll/runs/:id/reopen', requireRole('admin'), (req, res) => {
    const id = idParam(req);
    const info = db.prepare("UPDATE payroll_runs SET status = 'taslak', approved_by = NULL, approved_at = NULL WHERE id = ?").run(id);
    if (!info.changes) throw notFound('Bordro');
    audit(db, req, 'onay_geri_al', 'bordro', id);
    res.json({ ok: true });
  });

  r.delete('/payroll/runs/:id', hr, (req, res) => {
    const id = idParam(req);
    assertDraft(id);
    db.prepare('DELETE FROM payroll_runs WHERE id = ?').run(id);
    audit(db, req, 'sil', 'bordro', id);
    res.json({ ok: true });
  });

  // --- Bordro pusulaları ---
  r.get('/payroll/my-payslips', requireAuth, (req, res) => {
    if (!req.user.employee_id) return res.json([]);
    res.json(
      db
        .prepare(`${ITEM_SELECT} WHERE i.employee_id = ? AND r.status = 'onaylandi' ORDER BY r.year DESC, r.month DESC`)
        .all(req.user.employee_id),
    );
  });

  r.get('/payroll/employee/:id', requireAuth, (req, res) => {
    const id = idParam(req);
    const own = req.user.employee_id === id;
    if (!own && !isHR(req.user)) throw new HttpError(403, 'Bu personelin bordrolarını görüntüleme yetkiniz yok.');
    const rows = db
      .prepare(
        `${ITEM_SELECT} WHERE i.employee_id = ? ${own && !isHR(req.user) ? "AND r.status = 'onaylandi'" : ''}
         ORDER BY r.year DESC, r.month DESC`,
      )
      .all(id);
    res.json(rows);
  });

  r.get('/payroll/items/:id', requireAuth, (req, res) => {
    const id = idParam(req);
    const item = db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(id);
    if (!item) throw notFound('Bordro pusulası');
    const own = item.employee_id === req.user.employee_id;
    if (!isHR(req.user) && !(own && item.run_status === 'onaylandi')) {
      throw new HttpError(403, 'Bu bordro pusulasını görüntüleme yetkiniz yok.');
    }
    res.json(item);
  });

  return r;
}
