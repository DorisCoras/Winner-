// Tarihler her yerde 'YYYY-MM-DD' metni olarak tutulur; hesaplamalar UTC üzerinden yapılır
// ki saat dilimi kaymaları gün hesabını bozmasın.

const DAY_MS = 86_400_000;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = parseDate(s);
  return !Number.isNaN(d.getTime()) && formatDate(d) === s;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

export function today() {
  const now = new Date();
  return formatDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function addDays(s, n) {
  return formatDate(new Date(parseDate(s).getTime() + n * DAY_MS));
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / DAY_MS);
}

/** Adds whole years; 29 Şubat → 28 Şubat on non-leap years. */
export function addYears(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const target = new Date(Date.UTC(y + n, m - 1, d));
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
  return formatDate(target);
}

/** Number of full years between two dates (a ≤ b). */
export function fullYearsBetween(a, b) {
  if (!a || !b || b < a) return 0;
  let years = Number(b.slice(0, 4)) - Number(a.slice(0, 4));
  if (addYears(a, years) > b) years -= 1;
  return Math.max(0, years);
}

export function monthStart(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function monthEnd(year, month) {
  return formatDate(new Date(Date.UTC(year, month, 0)));
}

export function* eachDay(start, end) {
  for (let t = parseDate(start).getTime(), e = parseDate(end).getTime(); t <= e; t += DAY_MS) {
    yield new Date(t);
  }
}
