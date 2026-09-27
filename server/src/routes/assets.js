// Zimmet (demirbaş) yönetimi.
import { Router } from 'express';
import { z } from 'zod';
import { isHR, requireAuth, requireRole } from '../auth.js';
import { insertRow, transaction, updateRow } from '../db.js';
import { ASSET_CATEGORIES } from '../lib/constants.js';
import { today } from '../lib/dates.js';
import { HttpError, idParam, notFound, parseBody, zDate, zOptText, zText } from '../http.js';
import { assertCanViewEmployee, audit } from '../services.js';

const assetSchema = z.object({
  category: z.enum(ASSET_CATEGORIES, { message: 'Kategori seçiniz.' }),
  name: zText(150, 'Demirbaş adı / modeli zorunludur.'),
  serial_no: zOptText(100),
  value: z
    .union([z.coerce.number().min(0), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v == null ? null : v)),
  notes: zOptText(1000),
  status: z.enum(['depoda', 'arizali', 'hurda']).optional(),
});

const ASSET_SELECT = `
  SELECT a.*, aa.id AS assignment_id, aa.employee_id, aa.assigned_at,
         e.first_name || ' ' || e.last_name AS employee_name, e.sicil_no, c.name AS company_name
  FROM assets a
  LEFT JOIN asset_assignments aa ON aa.asset_id = a.id AND aa.returned_at IS NULL
  LEFT JOIN employees e ON e.id = aa.employee_id
  LEFT JOIN companies c ON c.id = e.company_id`;

const ASSIGNMENT_SELECT = `
  SELECT aa.*, a.category, a.name AS asset_name, a.serial_no, a.value,
         e.first_name || ' ' || e.last_name AS employee_name, e.sicil_no, e.tc_kimlik, e.position,
         d.name AS department_name, c.name AS company_name, c.address AS company_address
  FROM asset_assignments aa
  JOIN assets a ON a.id = aa.asset_id
  JOIN employees e ON e.id = aa.employee_id
  JOIN companies c ON c.id = e.company_id
  LEFT JOIN departments d ON d.id = e.department_id`;

export default function assetRoutes(db) {
  const r = Router();
  const hr = requireRole('admin', 'ik');

  r.get('/assets', hr, (req, res) => {
    const { status, category, q } = req.query;
    const where = [];
    const params = [];
    if (status) {
      where.push('a.status = ?');
      params.push(String(status));
    }
    if (category) {
      where.push('a.category = ?');
      params.push(String(category));
    }
    if (q) {
      where.push("(a.name LIKE ? OR a.serial_no LIKE ? OR e.first_name || ' ' || e.last_name LIKE ?)");
      const like = `%${String(q).trim()}%`;
      params.push(like, like, like);
    }
    res.json(db.prepare(`${ASSET_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY a.category, a.name`).all(...params));
  });

  r.get('/assets/:id', hr, (req, res) => {
    const id = idParam(req);
    const asset = db.prepare(`${ASSET_SELECT} WHERE a.id = ?`).get(id);
    if (!asset) throw notFound('Demirbaş');
    asset.history = db.prepare(`${ASSIGNMENT_SELECT} WHERE aa.asset_id = ? ORDER BY aa.assigned_at DESC, aa.id DESC`).all(id);
    res.json(asset);
  });

  r.post('/assets', hr, (req, res) => {
    const b = parseBody(assetSchema, req.body);
    const id = insertRow(db, 'assets', { ...b, status: b.status ?? 'depoda' });
    audit(db, req, 'olustur', 'demirbas', id, b.name);
    res.status(201).json(db.prepare(`${ASSET_SELECT} WHERE a.id = ?`).get(id));
  });

  r.put('/assets/:id', hr, (req, res) => {
    const id = idParam(req);
    const b = parseBody(assetSchema, req.body);
    const current = db.prepare('SELECT status FROM assets WHERE id = ?').get(id);
    if (!current) throw notFound('Demirbaş');
    const data = { ...b };
    // Zimmetli bir demirbaşın durumu yalnızca iade ile değişir.
    if (current.status === 'zimmetli' || !b.status) delete data.status;
    updateRow(db, 'assets', id, data);
    audit(db, req, 'guncelle', 'demirbas', id, b.name);
    res.json(db.prepare(`${ASSET_SELECT} WHERE a.id = ?`).get(id));
  });

  r.delete('/assets/:id', hr, (req, res) => {
    const id = idParam(req);
    const asset = db.prepare('SELECT status FROM assets WHERE id = ?').get(id);
    if (!asset) throw notFound('Demirbaş');
    if (asset.status === 'zimmetli') throw new HttpError(409, 'Zimmetli demirbaş silinemez; önce iade alın.');
    db.prepare('DELETE FROM assets WHERE id = ?').run(id);
    audit(db, req, 'sil', 'demirbas', id);
    res.json({ ok: true });
  });

  r.post('/assets/:id/assign', hr, (req, res) => {
    const id = idParam(req);
    const b = parseBody(
      z.object({
        employee_id: z.coerce.number({ message: 'Personel seçiniz.' }).int().positive('Personel seçiniz.'),
        assigned_at: zDate.optional().default(today()),
        notes: zOptText(1000),
      }),
      req.body,
    );
    const asset = db.prepare('SELECT status FROM assets WHERE id = ?').get(id);
    if (!asset) throw notFound('Demirbaş');
    if (asset.status !== 'depoda') throw new HttpError(409, 'Yalnızca depoda olan demirbaşlar zimmetlenebilir.');
    const emp = db.prepare('SELECT status FROM employees WHERE id = ?').get(b.employee_id);
    if (!emp || emp.status !== 'aktif') throw new HttpError(400, 'Aktif bir personel seçiniz.');
    const assignmentId = transaction(db, () => {
      const aid = insertRow(db, 'asset_assignments', { asset_id: id, ...b });
      db.prepare("UPDATE assets SET status = 'zimmetli' WHERE id = ?").run(id);
      return aid;
    });
    audit(db, req, 'zimmetle', 'demirbas', id, { employee_id: b.employee_id });
    res.status(201).json(db.prepare(`${ASSIGNMENT_SELECT} WHERE aa.id = ?`).get(assignmentId));
  });

  r.post('/assets/:id/return', hr, (req, res) => {
    const id = idParam(req);
    const b = parseBody(
      z.object({
        returned_at: zDate.optional().default(today()),
        return_notes: zOptText(1000),
        status: z.enum(['depoda', 'arizali', 'hurda']).optional().default('depoda'),
      }),
      req.body,
    );
    const open = db.prepare('SELECT id, assigned_at FROM asset_assignments WHERE asset_id = ? AND returned_at IS NULL').get(id);
    if (!open) throw new HttpError(409, 'Bu demirbaş şu anda kimseye zimmetli değil.');
    if (b.returned_at < open.assigned_at) throw new HttpError(400, 'İade tarihi zimmet tarihinden önce olamaz.');
    transaction(db, () => {
      db.prepare('UPDATE asset_assignments SET returned_at = ?, return_notes = ? WHERE id = ?').run(b.returned_at, b.return_notes, open.id);
      db.prepare('UPDATE assets SET status = ? WHERE id = ?').run(b.status, id);
    });
    audit(db, req, 'iade_al', 'demirbas', id);
    res.json({ ok: true });
  });

  r.get('/asset-assignments/:id', requireAuth, (req, res) => {
    const id = idParam(req);
    const row = db.prepare(`${ASSIGNMENT_SELECT} WHERE aa.id = ?`).get(id);
    if (!row) throw notFound('Zimmet kaydı');
    if (!isHR(req.user) && row.employee_id !== req.user.employee_id) throw new HttpError(403, 'Bu zimmet kaydını görüntüleme yetkiniz yok.');
    res.json(row);
  });

  r.get('/employees/:id/assets', requireAuth, (req, res) => {
    const id = idParam(req);
    assertCanViewEmployee(db, req.user, id);
    res.json(db.prepare(`${ASSIGNMENT_SELECT} WHERE aa.employee_id = ? ORDER BY aa.returned_at IS NOT NULL, aa.assigned_at DESC`).all(id));
  });

  return r;
}

