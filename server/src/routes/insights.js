// Gösterge paneli ve raporlar.
import { Router } from 'express';
import { isHR, requireAuth, requireRole } from '../auth.js';
import { DOCUMENT_TYPES, EMPLOYMENT_TYPES } from '../lib/constants.js';
import { addDays, addYears, fullYearsBetween, monthEnd, monthStart, today } from '../lib/dates.js';
import { employeeLeaveBalance, subordinateIds } from '../services.js';

/** Returns the next occurrence (≥ from) of a yearly date given as YYYY-MM-DD. */
function nextAnniversary(date, from) {
  const years = Math.max(0, Number(from.slice(0, 4)) - Number(date.slice(0, 4)));
  let candidate = addYears(date, years);
  if (candidate < from) candidate = addYears(date, years + 1);
  return candidate;
}

export default function insightRoutes(db) {
  const r = Router();
  const hr = requireRole('admin', 'ik');

  r.get('/dashboard', requireAuth, (req, res) => {
    const user = req.user;
    const now = today();
    const in30 = addDays(now, 30);
    const out = { today: now, role: user.role };

    // Herkes için
    if (user.employee_id) {
      const bal = employeeLeaveBalance(db, user.employee_id);
      out.me = {
        leave_balance: { balance: bal.balance, available: bal.available, pending: bal.pending, next: bal.next },
        pending_requests: db
          .prepare("SELECT COUNT(*) AS n FROM leave_requests WHERE employee_id = ? AND status = 'beklemede'")
          .get(user.employee_id).n,
        upcoming_leaves: db
          .prepare(
            `SELECT r.id, r.start_date, r.end_date, r.days, r.status, t.name AS leave_type_name, t.color
             FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
             WHERE r.employee_id = ? AND r.end_date >= ? AND r.status IN ('beklemede', 'onaylandi')
             ORDER BY r.start_date LIMIT 5`,
          )
          .all(user.employee_id, now),
        open_assets: db
          .prepare('SELECT COUNT(*) AS n FROM asset_assignments WHERE employee_id = ? AND returned_at IS NULL')
          .get(user.employee_id).n,
      };
    }

    out.announcements = db
      .prepare(
        `SELECT a.id, a.title, a.body, a.pinned, a.created_at, c.name AS company_name
         FROM announcements a LEFT JOIN companies c ON c.id = a.company_id
         WHERE ? OR a.company_id IS NULL OR a.company_id = ?
         ORDER BY a.pinned DESC, a.created_at DESC LIMIT 5`,
      )
      .all(isHR(user) ? 1 : 0, user.company_id ?? -1);

    out.upcoming_holidays = db.prepare('SELECT * FROM holidays WHERE date >= ? ORDER BY date LIMIT 4').all(now);

    const onLeaveToday = db
      .prepare(
        `SELECT r.employee_id, e.first_name || ' ' || e.last_name AS employee_name, e.position,
                d.name AS department_name, r.end_date, t.name AS leave_type_name, t.color
         FROM leave_requests r
         JOIN employees e ON e.id = r.employee_id
         JOIN leave_types t ON t.id = r.leave_type_id
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE r.status = 'onaylandi' AND r.start_date <= ? AND r.end_date >= ?
         ORDER BY employee_name`,
      )
      .all(now, now);
    const team = user.role === 'yonetici' ? new Set(subordinateIds(db, user.employee_id)) : null;
    out.on_leave_today = onLeaveToday.map((row) =>
      isHR(user) || team?.has(row.employee_id) || row.employee_id === user.employee_id
        ? row
        : { ...row, leave_type_name: 'İzinli', color: '#64748b' },
    );

    // İş yıldönümleri (önümüzdeki 30 gün)
    const actives = db
      .prepare(
        `SELECT e.id, e.first_name || ' ' || e.last_name AS name, e.position, e.hire_date, e.birth_date, c.short_name AS company
         FROM employees e JOIN companies c ON c.id = e.company_id WHERE e.status = 'aktif'`,
      )
      .all();
    out.work_anniversaries = actives
      .map((e) => {
        const date = nextAnniversary(e.hire_date, now);
        return { id: e.id, name: e.name, position: e.position, company: e.company, date, years: fullYearsBetween(e.hire_date, date) };
      })
      .filter((e) => e.years > 0 && e.date <= in30)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);

    if (user.role === 'yonetici') {
      const ids = subordinateIds(db, user.employee_id);
      const ph = ids.map(() => '?').join(',') || 'NULL';
      out.team = {
        size: ids.length,
        pending_approvals: db
          .prepare(`SELECT COUNT(*) AS n FROM leave_requests WHERE status = 'beklemede' AND employee_id IN (${ph})`)
          .get(...ids).n,
        on_leave_today: onLeaveToday.filter((x) => ids.includes(x.employee_id)).length,
      };
    }

    if (isHR(user)) {
      const mStart = monthStart(Number(now.slice(0, 4)), Number(now.slice(5, 7)));
      const yStart = `${now.slice(0, 4)}-01-01`;
      const count = (sql, ...p) => db.prepare(sql).get(...p).n;
      out.hr = {
        headcount: count("SELECT COUNT(*) AS n FROM employees WHERE status = 'aktif'"),
        new_hires_month: count('SELECT COUNT(*) AS n FROM employees WHERE hire_date >= ? AND hire_date <= ?', mStart, now),
        exits_ytd: count("SELECT COUNT(*) AS n FROM employees WHERE status = 'ayrildi' AND exit_date >= ?", yStart),
        hires_ytd: count('SELECT COUNT(*) AS n FROM employees WHERE hire_date >= ?', yStart),
        pending_approvals: count("SELECT COUNT(*) AS n FROM leave_requests WHERE status = 'beklemede'"),
        on_leave_today: onLeaveToday.length,
        open_positions: count("SELECT COALESCE(SUM(openings), 0) AS n FROM job_postings WHERE status = 'acik'"),
        active_candidates: count(
          "SELECT COUNT(*) AS n FROM candidates x JOIN job_postings j ON j.id = x.posting_id WHERE x.stage NOT IN ('ise_alindi', 'red') AND j.status != 'kapali'",
        ),
        assets_assigned: count("SELECT COUNT(*) AS n FROM assets WHERE status = 'zimmetli'"),
        monthly_payroll_cost: db
          .prepare(
            `SELECT r.year, r.month, SUM(i.employer_cost) AS cost, SUM(i.net) AS net
             FROM payroll_runs r JOIN payroll_items i ON i.run_id = r.id
             GROUP BY r.year, r.month ORDER BY r.year DESC, r.month DESC LIMIT 1`,
          )
          .get() ?? null,
      };
      out.by_company = db
        .prepare(
          `SELECT c.id, c.name, c.short_name, COUNT(e.id) AS count
           FROM companies c LEFT JOIN employees e ON e.company_id = c.id AND e.status = 'aktif'
           WHERE c.active = 1 GROUP BY c.id ORDER BY c.is_holding DESC, count DESC`,
        )
        .all();
      out.by_gender = db
        .prepare("SELECT COALESCE(gender, '-') AS gender, COUNT(*) AS count FROM employees WHERE status = 'aktif' GROUP BY gender")
        .all();
      out.probation_ending = actives
        .map((e) => ({ id: e.id, name: e.name, position: e.position, company: e.company, date: addDays(e.hire_date, 60) }))
        .filter((e) => e.date >= now && e.date <= in30)
        .sort((a, b) => a.date.localeCompare(b.date));
      out.birthdays = actives
        .filter((e) => e.birth_date)
        .map((e) => ({ id: e.id, name: e.name, company: e.company, date: nextAnniversary(e.birth_date, now) }))
        .filter((e) => e.date <= addDays(now, 14))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 8);
      const requiredDocs = DOCUMENT_TYPES.filter((d) => d.required).map((d) => d.code);
      out.missing_documents = db
        .prepare(
          `SELECT e.id, e.first_name || ' ' || e.last_name AS name, c.short_name AS company,
                  ${requiredDocs.length} - COUNT(DISTINCT CASE WHEN ed.received_date IS NOT NULL THEN ed.doc_type END) AS missing
           FROM employees e
           JOIN companies c ON c.id = e.company_id
           LEFT JOIN employee_documents ed ON ed.employee_id = e.id AND ed.doc_type IN (${requiredDocs.map(() => '?').join(',')})
           WHERE e.status = 'aktif'
           GROUP BY e.id HAVING missing > 0 ORDER BY missing DESC, name LIMIT 8`,
        )
        .all(...requiredDocs);
      out.expiring_documents = db
        .prepare(
          `SELECT ed.employee_id AS id, e.first_name || ' ' || e.last_name AS name, ed.doc_type, ed.expiry_date
           FROM employee_documents ed JOIN employees e ON e.id = ed.employee_id
           WHERE e.status = 'aktif' AND ed.expiry_date IS NOT NULL AND ed.expiry_date <= ?
           ORDER BY ed.expiry_date LIMIT 8`,
        )
        .all(addDays(now, 45))
        .map((row) => ({ ...row, doc_label: DOCUMENT_TYPES.find((d) => d.code === row.doc_type)?.label ?? row.doc_type }));
    }

    res.json(out);
  });

  // --- Raporlar (İK) ---

  r.get('/reports/headcount', hr, (req, res) => {
    const companyId = req.query.company_id ? Number(req.query.company_id) : null;
    const base = `FROM employees e WHERE e.status = 'aktif' AND (? IS NULL OR e.company_id = ?)`;
    const group = (expr, label) =>
      db.prepare(`SELECT ${expr} AS ${label}, COUNT(*) AS count ${base} GROUP BY 1 ORDER BY count DESC`).all(companyId, companyId);
    const rows = db.prepare(`SELECT e.birth_date, e.hire_date, e.gross_salary ${base}`).all(companyId, companyId);
    const now = today();
    const band = (value, edges, labels) => labels[edges.findIndex((edge) => value < edge)] ?? labels.at(-1);
    const tally = (items) => {
      const m = new Map();
      for (const k of items) m.set(k, (m.get(k) ?? 0) + 1);
      return [...m].map(([label, count]) => ({ label, count }));
    };
    const ageLabels = ['25 altı', '25–34', '35–44', '45–54', '55+'];
    const tenureLabels = ['1 yıldan az', '1–3 yıl', '3–5 yıl', '5–10 yıl', '10 yıl+'];
    const ages = rows.filter((x) => x.birth_date).map((x) => band(fullYearsBetween(x.birth_date, now), [25, 35, 45, 55], ageLabels));
    const tenures = rows.map((x) => band(fullYearsBetween(x.hire_date, now), [1, 3, 5, 10], tenureLabels));
    const order = (list, labels) => labels.map((label) => ({ label, count: list.find((x) => x.label === label)?.count ?? 0 }));

    res.json({
      total: rows.length,
      by_company: db
        .prepare(
          `SELECT c.name AS label, COUNT(e.id) AS count, ROUND(AVG(e.gross_salary), 2) AS avg_salary
           FROM employees e JOIN companies c ON c.id = e.company_id
           WHERE e.status = 'aktif' AND (? IS NULL OR e.company_id = ?) GROUP BY c.id ORDER BY count DESC`,
        )
        .all(companyId, companyId),
      by_department: db
        .prepare(
          `SELECT COALESCE(d.name, 'Departmansız') || ' (' || c.short_name || ')' AS label, COUNT(e.id) AS count,
                  ROUND(AVG(e.gross_salary), 2) AS avg_salary
           FROM employees e JOIN companies c ON c.id = e.company_id LEFT JOIN departments d ON d.id = e.department_id
           WHERE e.status = 'aktif' AND (? IS NULL OR e.company_id = ?) GROUP BY c.id, d.id ORDER BY count DESC`,
        )
        .all(companyId, companyId),
      by_gender: group("CASE e.gender WHEN 'K' THEN 'Kadın' WHEN 'E' THEN 'Erkek' ELSE 'Belirtilmemiş' END", 'label'),
      by_employment_type: group('e.employment_type', 'label').map((x) => ({ ...x, label: EMPLOYMENT_TYPES[x.label] ?? x.label })),
      by_education: group("COALESCE(e.education, 'Belirtilmemiş')", 'label'),
      by_age: order(tally(ages), ageLabels),
      by_tenure: order(tally(tenures), tenureLabels),
    });
  });

  r.get('/reports/turnover', hr, (req, res) => {
    const year = Number(req.query.year) || Number(today().slice(0, 4));
    const companyId = req.query.company_id ? Number(req.query.company_id) : null;
    const now = today();
    const scope = '(? IS NULL OR company_id = ?)';
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const start = monthStart(year, m);
      if (start > now) {
        // Henüz yaşanmamış aylar
        months.push({ month: m, hires: 0, exits: 0, headcount: null, future: true });
        continue;
      }
      const end = monthEnd(year, m) < now ? monthEnd(year, m) : now;
      const hires = db.prepare(`SELECT COUNT(*) AS n FROM employees WHERE hire_date BETWEEN ? AND ? AND ${scope}`).get(start, end, companyId, companyId).n;
      const exits = db.prepare(`SELECT COUNT(*) AS n FROM employees WHERE exit_date BETWEEN ? AND ? AND ${scope}`).get(start, end, companyId, companyId).n;
      const headcount = db
        .prepare(`SELECT COUNT(*) AS n FROM employees WHERE hire_date <= ? AND (exit_date IS NULL OR exit_date > ?) AND ${scope}`)
        .get(end, end, companyId, companyId).n;
      months.push({ month: m, hires, exits, headcount });
    }
    const elapsed = months.filter((x) => x.headcount !== null);
    const totalExits = months.reduce((s, x) => s + x.exits, 0);
    const avgHeadcount = elapsed.length ? elapsed.reduce((s, x) => s + x.headcount, 0) / elapsed.length : 0;
    res.json({
      year,
      months,
      total_hires: months.reduce((s, x) => s + x.hires, 0),
      total_exits: totalExits,
      average_headcount: Math.round(avgHeadcount * 10) / 10,
      turnover_rate: avgHeadcount ? Math.round((totalExits / avgHeadcount) * 1000) / 10 : 0,
      exit_reasons: db
        .prepare(
          `SELECT exit_code AS code, COUNT(*) AS count FROM employees
           WHERE exit_date BETWEEN ? AND ? AND ${scope} GROUP BY exit_code ORDER BY count DESC`,
        )
        .all(`${year}-01-01`, `${year}-12-31`, companyId, companyId),
    });
  });

  r.get('/reports/leave-usage', hr, (req, res) => {
    const year = Number(req.query.year) || Number(today().slice(0, 4));
    const companyId = req.query.company_id ? Number(req.query.company_id) : null;
    const employees = db
      .prepare(
        `SELECT e.id, e.sicil_no, e.first_name || ' ' || e.last_name AS name, c.short_name AS company, d.name AS department, e.hire_date
         FROM employees e JOIN companies c ON c.id = e.company_id LEFT JOIN departments d ON d.id = e.department_id
         WHERE e.status = 'aktif' AND (? IS NULL OR e.company_id = ?) ORDER BY name`,
      )
      .all(companyId, companyId);
    const usage = db.prepare(
      `SELECT t.code, SUM(r.days) AS days FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
       WHERE r.employee_id = ? AND r.status = 'onaylandi' AND r.start_date BETWEEN ? AND ? GROUP BY t.code`,
    );
    const rows = employees.map((e) => {
      const bal = employeeLeaveBalance(db, e.id);
      const byType = Object.fromEntries(usage.all(e.id, `${year}-01-01`, `${year}-12-31`).map((u) => [u.code, u.days]));
      return { ...e, balance: bal.balance, earned_total: bal.earned, service_years: bal.serviceYears, used_by_type: byType };
    });
    const types = db.prepare('SELECT code, name, color FROM leave_types ORDER BY sort').all();
    const totals = db
      .prepare(
        `SELECT t.code, t.name, t.color, COALESCE(SUM(r.days), 0) AS days, COUNT(r.id) AS requests
         FROM leave_types t LEFT JOIN leave_requests r ON r.leave_type_id = t.id AND r.status = 'onaylandi'
           AND r.start_date BETWEEN ? AND ?
           AND (? IS NULL OR r.employee_id IN (SELECT id FROM employees WHERE company_id = ?))
         GROUP BY t.id ORDER BY t.sort`,
      )
      .all(`${year}-01-01`, `${year}-12-31`, companyId, companyId);
    res.json({ year, types, totals, employees: rows });
  });

  r.get('/reports/payroll-cost', hr, (req, res) => {
    const year = Number(req.query.year) || Number(today().slice(0, 4));
    res.json({
      year,
      rows: db
        .prepare(
          `SELECT r.company_id, c.name AS company_name, r.month, r.status, COUNT(i.id) AS employees,
                  SUM(i.gross) AS gross, SUM(i.net) AS net, SUM(i.income_tax) AS income_tax, SUM(i.stamp_tax) AS stamp_tax,
                  SUM(i.sgk_employee + i.unemployment_employee) AS sgk_employee,
                  SUM(i.sgk_employer + i.unemployment_employer) AS sgk_employer, SUM(i.employer_cost) AS employer_cost
           FROM payroll_runs r JOIN companies c ON c.id = r.company_id JOIN payroll_items i ON i.run_id = r.id
           WHERE r.year = ? GROUP BY r.id ORDER BY c.name, r.month`,
        )
        .all(year),
    });
  });

  return r;
}
