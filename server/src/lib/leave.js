import { addYears, eachDay, fullYearsBetween, today } from './dates.js';

/**
 * 4857 sayılı İş Kanunu m.53: hizmet süresi
 *   1–5 yıl (5 dahil)  → 14 gün
 *   5–15 yıl arası     → 20 gün
 *   15 yıl ve üzeri    → 26 gün
 * 18 yaş ve altı ile 50 yaş ve üzeri çalışanlara en az 20 gün.
 */
export function annualEntitlementDays(serviceYears, age) {
  if (serviceYears < 1) return 0;
  let days = serviceYears <= 5 ? 14 : serviceYears < 15 ? 20 : 26;
  if (age != null && (age <= 18 || age >= 50)) days = Math.max(days, 20);
  return days;
}

/**
 * Hire date'ten asOf tarihine kadar her yıldönümünde hak edilen yıllık izin günleri.
 * Returns [{ year: n, date, days }] — n. hizmet yılının dolduğu tarih ve kazanılan gün.
 */
export function entitlementHistory(hireDate, birthDate, asOf = today()) {
  const years = fullYearsBetween(hireDate, asOf);
  const out = [];
  for (let n = 1; n <= years; n++) {
    const date = addYears(hireDate, n);
    const age = birthDate ? fullYearsBetween(birthDate, date) : null;
    out.push({ year: n, date, days: annualEntitlementDays(n, age) });
  }
  return out;
}

export function nextEntitlement(hireDate, birthDate, asOf = today()) {
  const n = fullYearsBetween(hireDate, asOf) + 1;
  const date = addYears(hireDate, n);
  const age = birthDate ? fullYearsBetween(birthDate, date) : null;
  return { year: n, date, days: annualEntitlementDays(n, age) };
}

/**
 * Counts chargeable leave days between start and end (inclusive).
 * Pazar her zaman hafta tatilidir; cumartesi `saturdayWorkday` false ise sayılmaz.
 * Resmi tatiller düşülür, yarım gün tatiller (arife) 0,5 gün sayılır.
 * `halfDay` yalnızca tek günlük taleplerde geçerlidir.
 */
export function countLeaveDays(start, end, { holidays = new Map(), saturdayWorkday = false, halfDay = false } = {}) {
  if (!start || !end || end < start) return 0;
  let total = 0;
  for (const d of eachDay(start, end)) {
    const dow = d.getUTCDay();
    if (dow === 0) continue;
    if (dow === 6 && !saturdayWorkday) continue;
    const holiday = holidays.get(d.toISOString().slice(0, 10));
    if (holiday) {
      if (holiday.half_day) total += 0.5;
      continue;
    }
    total += 1;
  }
  if (halfDay && start === end) total = Math.min(total, 0.5);
  return total;
}

/**
 * Yıllık izin bakiyesi özeti.
 * - baseDate (devir tarihi) verilirse `carryover` o tarihteki kalan bakiyedir; yalnızca bu tarihten
 *   SONRAKİ yıldönümlerinde kazanılan haklar eklenir (sisteme geçişte kullanılır).
 * - baseDate yoksa işe girişten itibaren tüm hak edişler sayılır, carryover ek düzeltmedir.
 * - usedDays/pendingDays çağıran tarafından (devir tarihinden itibaren) hesaplanır.
 */
export function leaveBalance({ hireDate, birthDate, carryover = 0, baseDate = null, usedDays = 0, pendingDays = 0, asOf = today() }) {
  const history = entitlementHistory(hireDate, birthDate, asOf).map((h) => ({ ...h, counted: !baseDate || h.date > baseDate }));
  const earned = history.reduce((sum, h) => sum + (h.counted ? h.days : 0), 0);
  const balance = carryover + earned - usedDays;
  return {
    earned,
    carryover,
    baseDate,
    used: usedDays,
    pending: pendingDays,
    balance,
    available: balance - pendingDays,
    serviceYears: fullYearsBetween(hireDate, asOf),
    history,
    next: nextEntitlement(hireDate, birthDate, asOf),
  };
}
