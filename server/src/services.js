// Birden fazla route tarafından kullanılan veritabanı yardımcıları.
import { getSetting, insertRow } from './db.js';
import { HttpError } from './http.js';
import { countLeaveDays, leaveBalance } from './lib/leave.js';
import { calculateMonth, DEFAULT_PAYROLL_PARAMS } from './lib/payroll.js';
import { monthEnd, monthStart, parseDate } from './lib/dates.js';
import { isHR } from './auth.js';

export function audit(db, req, action, entity, entityId = null, details = null) {
  db.prepare('INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)').run(
    req?.user?.id ?? null,
    action,
    entity,
    entityId,
    details == null ? null : typeof details === 'string' ? details : JSON.stringify(details),
  );
}

// --- Yetki kapsamı ---------------------------------------------------------------------

/** Tüm alt kademe çalışanlar (doğrudan ve dolaylı), yöneticinin kendisi hariç. */
export function subordinateIds(db, managerEmployeeId) {
  if (!managerEmployeeId) return [];
  const rows = db
    .prepare(
      `WITH RECURSIVE team(id) AS (
         SELECT id FROM employees WHERE manager_id = ?
         UNION
         SELECT e.id FROM employees e JOIN team t ON e.manager_id = t.id
       ) SELECT id FROM team`,
    )
    .all(managerEmployeeId);
  return rows.map((r) => r.id);
}

/** Returns the set of employee ids the user may see in detail, or null for "all". */
export function visibleEmployeeIds(db, user) {
  if (isHR(user)) return null;
  const ids = new Set();
  if (user.employee_id) ids.add(user.employee_id);
  if (user.role === 'yonetici') for (const id of subordinateIds(db, user.employee_id)) ids.add(id);
  return ids;
}

export function canViewEmployee(db, user, employeeId) {
  const ids = visibleEmployeeIds(db, user);
  return ids === null || ids.has(employeeId);
}

export function assertCanViewEmployee(db, user, employeeId) {
  if (!canViewEmployee(db, user, employeeId)) throw new HttpError(403, 'Bu personelin bilgilerini görüntüleme yetkiniz yok.');
}

/** Sensitive fields (KVKK) are only for İK/admin and the employee themself. */
export function canViewSensitive(user, employeeId) {
  return isHR(user) || user.employee_id === employeeId;
}

// --- İzin ------------------------------------------------------------------------------

export function holidayMap(db, from, to) {
  const rows = db.prepare('SELECT date, name, half_day FROM holidays WHERE date BETWEEN ? AND ?').all(from, to);
  return new Map(rows.map((r) => [r.date, r]));
}

export function saturdayIsWorkday(db) {
  return getSetting(db, 'saturday_workday', '0') === '1';
}

export function computeLeaveDays(db, start, end, halfDay) {
  return countLeaveDays(start, end, {
    holidays: holidayMap(db, start, end),
    saturdayWorkday: saturdayIsWorkday(db),
    halfDay: !!halfDay,
  });
}

/** Devir tarihinden (varsa) itibaren onaylanmış ve bekleyen yıllık izin günleri. */
export function annualLeaveUsage(db, employeeId, baseDate = null, excludeRequestId = null) {
  return db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN r.status = 'onaylandi' THEN r.days END), 0) AS used,
         COALESCE(SUM(CASE WHEN r.status = 'beklemede' THEN r.days END), 0) AS pending
       FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
       WHERE r.employee_id = ? AND t.deducts_balance = 1 AND r.id IS NOT ?
         AND (? IS NULL OR r.start_date >= ?)`,
    )
    .get(employeeId, excludeRequestId, baseDate, baseDate);
}

export function employeeLeaveBalance(db, employeeId, excludeRequestId = null) {
  const emp = db
    .prepare('SELECT hire_date, birth_date, leave_carryover, leave_base_date FROM employees WHERE id = ?')
    .get(employeeId);
  if (!emp) throw new HttpError(404, 'Personel bulunamadı.');
  const sums = annualLeaveUsage(db, employeeId, emp.leave_base_date, excludeRequestId);
  return leaveBalance({
    hireDate: emp.hire_date,
    birthDate: emp.birth_date,
    carryover: emp.leave_carryover,
    baseDate: emp.leave_base_date,
    usedDays: sums.used,
    pendingDays: sums.pending,
  });
}

// --- Bordro ----------------------------------------------------------------------------

export function payrollParams(db, year) {
  const row = db.prepare('SELECT data FROM payroll_params WHERE year = ?').get(year);
  if (row) return JSON.parse(row.data);
  if (DEFAULT_PAYROLL_PARAMS[year]) return DEFAULT_PAYROLL_PARAMS[year];
  // Tanımsız yıl için en yakın önceki yılın parametreleri kullanılır.
  const prev = db.prepare('SELECT data FROM payroll_params WHERE year < ? ORDER BY year DESC LIMIT 1').get(year);
  if (prev) return JSON.parse(prev.data);
  throw new HttpError(400, `${year} yılı için bordro parametreleri tanımlı değil.`);
}

export function employerIncentive(db) {
  return getSetting(db, 'employer_incentive', '1') === '1';
}

/**
 * SGK gün sayısı: ay içinde işe giriş/çıkış ve ücretsiz izin günleri düşülür (30 gün üzerinden).
 */
export function payrollDays(db, employee, year, month) {
  const start = monthStart(year, month);
  const end = monthEnd(year, month);
  const lastDay = parseDate(end).getUTCDate();
  if (employee.hire_date > end || (employee.exit_date && employee.exit_date < start)) return 0;
  const first = employee.hire_date >= start ? parseDate(employee.hire_date).getUTCDate() : 1;
  const last = employee.exit_date && employee.exit_date <= end ? parseDate(employee.exit_date).getUTCDate() : lastDay;
  // Tam ay çalışma 30 gün sayılır; ay içi giriş/çıkışta takvim günü esas alınır.
  let days = first === 1 && last === lastDay ? 30 : last - first + 1;

  const unpaid = db
    .prepare(
      `SELECT r.start_date, r.end_date FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
       WHERE r.employee_id = ? AND r.status = 'onaylandi' AND t.paid = 0
         AND r.start_date <= ? AND r.end_date >= ?`,
    )
    .all(employee.id, end, start);
  for (const r of unpaid) {
    const s = r.start_date < start ? start : r.start_date;
    const e = r.end_date > end ? end : r.end_date;
    days -= Math.round((parseDate(e) - parseDate(s)) / 86_400_000) + 1;
  }
  return Math.max(0, Math.min(30, days));
}

/**
 * Yıl içinde önceki ayların gelir vergisi matrahı toplamı. Kümülatif matrah işveren bazında
 * yürür; grup şirketleri ayrı tüzel kişilik olduğundan şirket değişiminde sıfırdan başlar.
 */
export function cumulativeBaseBefore(db, employeeId, companyId, year, month, excludeRunId = null) {
  return db
    .prepare(
      `SELECT COALESCE(SUM(i.income_tax_base), 0) AS total
       FROM payroll_items i JOIN payroll_runs r ON r.id = i.run_id
       WHERE i.employee_id = ? AND r.company_id = ? AND r.year = ? AND r.month < ? AND r.id IS NOT ?`,
    )
    .get(employeeId, companyId, year, month, excludeRunId).total;
}

/** Computes a payroll item for an employee (not persisted). */
export function computePayrollItem(db, { employee, companyId = employee.company_id, year, month, runId = null, extraGross = 0, deductions = 0, days = null }) {
  const params = payrollParams(db, year);
  const d = days ?? payrollDays(db, employee, year, month);
  const baseGross = Math.round(((employee.gross_salary * d) / 30) * 100) / 100;
  const gross = baseGross + extraGross;
  const cum = cumulativeBaseBefore(db, employee.id, companyId, year, month, runId);
  const r = calculateMonth({
    gross,
    month,
    cumulativeBaseBefore: cum,
    days: d,
    params,
    incentive: employerIncentive(db),
    deductions,
  });
  return {
    employee_id: employee.id,
    days: d,
    base_gross: baseGross,
    extra_gross: extraGross,
    gross: r.gross,
    sgk_base: r.sgkBase,
    sgk_employee: r.sgkEmployee,
    unemployment_employee: r.unemploymentEmployee,
    income_tax_base: r.incomeTaxBase,
    cumulative_base_before: r.cumulativeBaseBefore,
    income_tax_gross: r.incomeTaxGross,
    income_tax_exemption: r.incomeTaxExemption,
    income_tax: r.incomeTax,
    stamp_tax_gross: r.stampTaxGross,
    stamp_tax_exemption: r.stampTaxExemption,
    stamp_tax: r.stampTax,
    deductions: r.deductions,
    net: r.net,
    sgk_employer: r.sgkEmployer,
    unemployment_employer: r.unemploymentEmployer,
    employer_cost: r.employerCost,
  };
}

function employeesForRun(db, companyId, year, month) {
  return db
    .prepare(
      `SELECT * FROM employees WHERE company_id = ? AND hire_date <= ?
         AND (exit_date IS NULL OR exit_date >= ?) ORDER BY first_name, last_name`,
    )
    .all(companyId, monthEnd(year, month), monthStart(year, month));
}

/**
 * Bordro dönemine, o ay şirkette çalışmış personelin satırlarını ekler.
 * `preserve`: yeniden hesaplamada korunacak ek ödeme/kesinti/not değerleri (employee_id → satır).
 */
export function fillPayrollRun(db, runId, companyId, year, month, preserve = new Map()) {
  let count = 0;
  for (const emp of employeesForRun(db, companyId, year, month)) {
    const prev = preserve.get(emp.id);
    const item = computePayrollItem(db, {
      employee: emp,
      companyId,
      year,
      month,
      runId,
      extraGross: prev?.extra_gross ?? 0,
      deductions: prev?.deductions ?? 0,
    });
    if (item.days <= 0 && !(prev?.extra_gross > 0)) continue;
    insertRow(db, 'payroll_items', { run_id: runId, ...item, note: prev?.note ?? null });
    count++;
  }
  return count;
}
