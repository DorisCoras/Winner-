import { Router } from 'express';
import { z } from 'zod';
import { isHR, requireAuth, requireRole } from '../auth.js';
import { insertRow, transaction, updateRow } from '../db.js';
import { monthEnd, monthStart, today } from '../lib/dates.js';
import { HttpError, idParam, notFound, parseBody, zBool, zDate, zOptId, zOptText, zText } from '../http.js';
import {
  assertCanViewEmployee,
  audit,
  computeLeaveDays,
  employeeLeaveBalance,
  holidayMap,
  subordinateIds,
  visibleEmployeeIds,
} from '../services.js';

const LIST_SELECT = `
  SELECT r.*, t.name AS leave_type_name, t.code AS leave_type_code, t.color, t.deducts_balance,
         e.first_name || ' ' || e.last_name AS employee_name, e.sicil_no, e.position,
         e.company_id, c.name AS company_name, e.department_id, d.name AS department_name, e.manager_id,
         ue.first_name || ' ' || ue.last_name AS decided_by_name, u.email AS decided_by_email
  FROM leave_requests r
  JOIN leave_types t ON t.id = r.leave_type_id
  JOIN employees e ON e.id = r.employee_id
  JOIN companies c ON c.id = e.company_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN users u ON u.id = r.decided_by
  LEFT JOIN employees ue ON ue.id = u.employee_id`;

const requestSchema = z.object({
  employee_id: zOptId,
  leave_type_id: z.coerce.number({ message: 'İzin türü seçiniz.' }).int().positive('İzin türü seçiniz.'),
  start_date: zDate,
  end_date: zDate,
  half_day: zBool,
  reason: zOptText(1000),
  force: z.boolean().optional(),
  auto_approve: z.boolean().optional(),
});

const leaveTypeSchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9_]{2,30}$/, 'Kod küçük harf, rakam ve _ içerebilir.'),
  name: zText(80, 'İzin türü adı zorunludur.'),
  deducts_balance: zBool,
  paid: zBool,
  max_days: z
    .union([z.coerce.number().positive(), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v == null ? null : v)),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Renk #RRGGBB biçiminde olmalı.').optional().default('#2563eb'),
  active: z
    .union([z.boolean(), z.literal(0), z.literal(1)])
    .optional()
    .transform((v) => (v === undefined ? 1 : v ? 1 : 0)),
  sort: z.coerce.number().int().optional().default(0),
});

const holidaySchema = z.object({
  date: zDate,
  name: zText(120, 'Tatil adı zorunludur.'),
  half_day: zBool,
});

/** Can `user` approve/reject requests of `employeeId`? İK her talebi; yönetici ekibinin taleplerini. */
function canDecide(db, user, employeeId) {
  if (isHR(user)) return true;
  if (user.role !== 'yonetici' || employeeId === user.employee_id) return false;
  return subordinateIds(db, user.employee_id).includes(employeeId);
}

export default function leaveRoutes(db) {
  const r = Router();
  const hr = requireRole('admin', 'ik');

  function validateRequest(b, user, excludeId = null) {
    const employeeId = b.employee_id ?? user.employee_id;
    if (!employeeId) throw new HttpError(400, 'Hesabınız bir personel kaydına bağlı değil.');
    if (employeeId !== user.employee_id && !isHR(user)) {
      throw new HttpError(403, 'Başka bir personel adına izin talebi oluşturamazsınız.');
    }
    const emp = db.prepare('SELECT id, status, hire_date FROM employees WHERE id = ?').get(employeeId);
    if (!emp) throw notFound('Personel');
    if (emp.status !== 'aktif') throw new HttpError(400, 'İşten ayrılmış personel için izin girilemez.');
    const type = db.prepare('SELECT * FROM leave_types WHERE id = ? AND active = 1').get(b.leave_type_id);
    if (!type) throw new HttpError(400, 'İzin türü bulunamadı.', { fields: { leave_type_id: 'Geçersiz izin türü.' } });
    if (b.end_date < b.start_date) {
      throw new HttpError(400, 'Bitiş tarihi başlangıçtan önce olamaz.', { fields: { end_date: 'Başlangıçtan önce olamaz.' } });
    }
    if (b.half_day && b.start_date !== b.end_date) {
      throw new HttpError(400, 'Yarım gün izin yalnızca tek günlük talepler için seçilebilir.', { fields: { half_day: 'Tek gün seçiniz.' } });
    }
    const days = computeLeaveDays(db, b.start_date, b.end_date, b.half_day);
    if (days <= 0) {
      throw new HttpError(400, 'Seçilen tarihler arasında iş günü bulunmuyor (hafta sonu veya resmi tatil).');
    }
    if (type.max_days && days > type.max_days) {
      throw new HttpError(400, `${type.name} için en fazla ${type.max_days} gün talep edilebilir.`);
    }
    const overlap = db
      .prepare(
        `SELECT id FROM leave_requests WHERE employee_id = ? AND status IN ('beklemede', 'onaylandi')
           AND start_date <= ? AND end_date >= ? AND id IS NOT ?`,
      )
      .get(employeeId, b.end_date, b.start_date, excludeId);
    if (overlap) throw new HttpError(409, 'Bu tarihlerle çakışan başka bir izin talebi var.');

    let balance = null;
    if (type.deducts_balance) {
      balance = employeeLeaveBalance(db, employeeId, excludeId);
      if (days > balance.available && !(b.force && isHR(user))) {
        throw new HttpError(
          400,
          `Yetersiz yıllık izin bakiyesi. Kullanılabilir: ${balance.available} gün, talep: ${days} gün.`,
          { code: 'insufficient_balance', available: balance.available },
        );
      }
    }
    return { employeeId, days, type, balance };
  }

  r.get('/leave-types', requireAuth, (_req, res) => {
    res.json(db.prepare('SELECT * FROM leave_types ORDER BY sort, name').all());
  });

  r.post('/leave-types', hr, (req, res) => {
    const b = parseBody(leaveTypeSchema, req.body);
    const id = insertRow(db, 'leave_types', b);
    audit(db, req, 'olustur', 'izin_turu', id, b.name);
    res.status(201).json(db.prepare('SELECT * FROM leave_types WHERE id = ?').get(id));
  });

  r.put('/leave-types/:id', hr, (req, res) => {
    const id = idParam(req);
    const b = parseBody(leaveTypeSchema, req.body);
    if (!updateRow(db, 'leave_types', id, b)) throw notFound('İzin türü');
    audit(db, req, 'guncelle', 'izin_turu', id, b.name);
    res.json(db.prepare('SELECT * FROM leave_types WHERE id = ?').get(id));
  });

  // --- İzin talepleri ---

  /**
   * scope: mine (kendi talepleri) | approvals (onayımı bekleyenler) | all (yetki kapsamındaki tümü)
   */
  r.get('/leaves', requireAuth, (req, res) => {
    const { scope = 'all', status, employee_id, from, to, company_id, leave_type_id } = req.query;
    const where = [];
    const params = [];
    const user = req.user;

    if (scope === 'mine') {
      where.push('r.employee_id = ?');
      params.push(user.employee_id ?? -1);
    } else if (scope === 'approvals') {
      where.push("r.status = 'beklemede'");
      if (!isHR(user)) {
        const team = user.role === 'yonetici' ? subordinateIds(db, user.employee_id) : [];
        where.push(`r.employee_id IN (${team.map(() => '?').join(',') || 'NULL'})`);
        params.push(...team);
      }
    } else {
      const visible = visibleEmployeeIds(db, user);
      if (visible) {
        const ids = [...visible];
        where.push(`r.employee_id IN (${ids.map(() => '?').join(',') || 'NULL'})`);
        params.push(...ids);
      }
    }
    if (status) {
      where.push('r.status = ?');
      params.push(String(status));
    }
    if (employee_id) {
      where.push('r.employee_id = ?');
      params.push(Number(employee_id));
    }
    if (company_id) {
      where.push('e.company_id = ?');
      params.push(Number(company_id));
    }
    if (leave_type_id) {
      where.push('r.leave_type_id = ?');
      params.push(Number(leave_type_id));
    }
    if (from) {
      where.push('r.end_date >= ?');
      params.push(String(from));
    }
    if (to) {
      where.push('r.start_date <= ?');
      params.push(String(to));
    }
    const rows = db
      .prepare(`${LIST_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.start_date DESC, r.id DESC LIMIT 1000`)
      .all(...params);
    res.json(rows.map((row) => ({ ...row, can_decide: row.status === 'beklemede' && canDecide(db, user, row.employee_id) })));
  });

  r.get('/leaves/balance/:employeeId', requireAuth, (req, res) => {
    const id = idParam(req, 'employeeId');
    assertCanViewEmployee(db, req.user, id);
    res.json(employeeLeaveBalance(db, id));
  });

  /** Canlı hesap: seçilen tarih aralığında kaç gün düşülecek ve kalan bakiye. */
  r.post('/leaves/preview', requireAuth, (req, res) => {
    const b = parseBody(requestSchema, req.body);
    const employeeId = b.employee_id ?? req.user.employee_id;
    if (!employeeId) throw new HttpError(400, 'Hesabınız bir personel kaydına bağlı değil.');
    assertCanViewEmployee(db, req.user, employeeId);
    if (b.end_date < b.start_date) return res.json({ days: 0, error: 'Bitiş tarihi başlangıçtan önce olamaz.' });
    const days = computeLeaveDays(db, b.start_date, b.end_date, b.half_day);
    const type = db.prepare('SELECT deducts_balance FROM leave_types WHERE id = ?').get(b.leave_type_id);
    const holidays = [...holidayMap(db, b.start_date, b.end_date).values()];
    let balance = null;
    if (type?.deducts_balance) {
      const bal = employeeLeaveBalance(db, employeeId);
      balance = { available: bal.available, after: bal.available - days };
    }
    res.json({ days, holidays, balance });
  });

  r.post('/leaves', requireAuth, (req, res) => {
    const b = parseBody(requestSchema, req.body);
    const { employeeId, days } = validateRequest(b, req.user);
    const autoApprove = !!b.auto_approve && isHR(req.user);
    const id = insertRow(db, 'leave_requests', {
      employee_id: employeeId,
      leave_type_id: b.leave_type_id,
      start_date: b.start_date,
      end_date: b.end_date,
      half_day: b.half_day,
      days,
      reason: b.reason,
      status: autoApprove ? 'onaylandi' : 'beklemede',
      created_by: req.user.id,
      decided_by: autoApprove ? req.user.id : null,
      decided_at: autoApprove ? new Date().toISOString() : null,
    });
    audit(db, req, 'olustur', 'izin', id, { employee_id: employeeId, days, auto_approve: autoApprove });
    res.status(201).json(db.prepare(`${LIST_SELECT} WHERE r.id = ?`).get(id));
  });

  function decide(status) {
    return (req, res) => {
      const id = idParam(req);
      const b = parseBody(z.object({ note: zOptText(1000) }), req.body);
      const reqRow = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(id);
      if (!reqRow) throw notFound('İzin talebi');
      if (reqRow.status !== 'beklemede') throw new HttpError(409, 'Bu talep daha önce sonuçlandırılmış.');
      if (!canDecide(db, req.user, reqRow.employee_id)) throw new HttpError(403, 'Bu talebi onaylama yetkiniz yok.');
      transaction(db, () => {
        if (status === 'onaylandi') {
          // Onay anında bakiye tekrar kontrol edilir (bekleyen başka talepler onaylanmış olabilir).
          const type = db.prepare('SELECT deducts_balance FROM leave_types WHERE id = ?').get(reqRow.leave_type_id);
          if (type.deducts_balance) {
            const bal = employeeLeaveBalance(db, reqRow.employee_id, id);
            if (reqRow.days > bal.balance && !isHR(req.user)) {
              throw new HttpError(400, `Personelin yıllık izin bakiyesi yetersiz (${bal.balance} gün).`);
            }
          }
        }
        db.prepare('UPDATE leave_requests SET status = ?, decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ?').run(
          status,
          req.user.id,
          new Date().toISOString(),
          b.note,
          id,
        );
      });
      audit(db, req, status === 'onaylandi' ? 'onayla' : 'reddet', 'izin', id, b.note);
      res.json(db.prepare(`${LIST_SELECT} WHERE r.id = ?`).get(id));
    };
  }

  r.post('/leaves/:id/approve', requireAuth, decide('onaylandi'));
  r.post('/leaves/:id/reject', requireAuth, decide('reddedildi'));

  r.post('/leaves/:id/cancel', requireAuth, (req, res) => {
    const id = idParam(req);
    const row = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(id);
    if (!row) throw notFound('İzin talebi');
    const own = row.employee_id === req.user.employee_id;
    if (isHR(req.user)) {
      if (row.status === 'iptal' || row.status === 'reddedildi') throw new HttpError(409, 'Bu talep zaten kapalı.');
    } else if (own) {
      if (row.status !== 'beklemede') {
        throw new HttpError(409, 'Yalnızca onay bekleyen taleplerinizi iptal edebilirsiniz. Onaylı izinler için İK ile iletişime geçin.');
      }
    } else {
      throw new HttpError(403, 'Bu talebi iptal etme yetkiniz yok.');
    }
    db.prepare("UPDATE leave_requests SET status = 'iptal', decided_by = ?, decided_at = ? WHERE id = ?").run(
      req.user.id,
      new Date().toISOString(),
      id,
    );
    audit(db, req, 'iptal', 'izin', id);
    res.json({ ok: true });
  });

  /** Aylık izin takvimi: ay içinde izinli olan (onaylı + bekleyen) personel ve resmi tatiller. */
  r.get('/leaves/calendar', requireAuth, (req, res) => {
    const year = Number(req.query.year) || Number(today().slice(0, 4));
    const month = Number(req.query.month) || Number(today().slice(5, 7));
    if (month < 1 || month > 12) throw new HttpError(400, 'Geçersiz ay.');
    const start = monthStart(year, month);
    const end = monthEnd(year, month);
    const where = ["r.status IN ('onaylandi', 'beklemede')", 'r.start_date <= ?', 'r.end_date >= ?'];
    const params = [end, start];
    const { company_id, department_id } = req.query;
    if (company_id) {
      where.push('e.company_id = ?');
      params.push(Number(company_id));
    }
    if (department_id) {
      where.push('e.department_id = ?');
      params.push(Number(department_id));
    }
    // Takvimde herkes kimin izinli olduğunu görebilir; İK dışındaki kullanıcılar bekleyen talepleri
    // yalnızca kendileri/ekipleri için görür.
    const hrUser = isHR(req.user);
    const ownScope = hrUser ? null : visibleEmployeeIds(db, req.user);
    if (!hrUser) {
      const ids = [...ownScope];
      where.push(`(r.status = 'onaylandi' OR r.employee_id IN (${ids.map(() => '?').join(',') || 'NULL'}))`);
      params.push(...ids);
    }
    const rows = db
      .prepare(
        `SELECT r.id, r.employee_id, r.start_date, r.end_date, r.half_day, r.days, r.status,
                t.name AS leave_type_name, t.color,
                e.first_name || ' ' || e.last_name AS employee_name, e.position,
                d.name AS department_name, c.short_name AS company_short_name, c.name AS company_name
         FROM leave_requests r
         JOIN leave_types t ON t.id = r.leave_type_id
         JOIN employees e ON e.id = r.employee_id
         JOIN companies c ON c.id = e.company_id
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE ${where.join(' AND ')}
         ORDER BY employee_name, r.start_date`,
      )
      .all(...params);
    // KVKK: izin türü (ör. hastalık/rapor) sağlık verisi içerebilir; yetki dışındaki kişiler için gizlenir.
    const leaves = hrUser
      ? rows
      : rows.map((row) =>
          ownScope.has(row.employee_id) ? row : { ...row, leave_type_name: 'İzinli', color: '#64748b' },
        );
    res.json({ year, month, start, end, leaves, holidays: [...holidayMap(db, start, end).values()] });
  });

  // --- Resmi tatiller ---

  r.get('/holidays', requireAuth, (req, res) => {
    const year = req.query.year ? String(Number(req.query.year)) : null;
    const rows = year
      ? db.prepare("SELECT * FROM holidays WHERE substr(date, 1, 4) = ? ORDER BY date").all(year)
      : db.prepare('SELECT * FROM holidays ORDER BY date').all();
    res.json(rows);
  });

  r.post('/holidays', hr, (req, res) => {
    const b = parseBody(holidaySchema, req.body);
    db.prepare(
      'INSERT INTO holidays (date, name, half_day) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET name = excluded.name, half_day = excluded.half_day',
    ).run(b.date, b.name, b.half_day);
    audit(db, req, 'kaydet', 'resmi_tatil', null, b);
    res.status(201).json(b);
  });

  r.delete('/holidays/:date', hr, (req, res) => {
    const info = db.prepare('DELETE FROM holidays WHERE date = ?').run(req.params.date);
    if (!info.changes) throw notFound('Resmi tatil');
    audit(db, req, 'sil', 'resmi_tatil', null, req.params.date);
    res.json({ ok: true });
  });

  return r;
}
