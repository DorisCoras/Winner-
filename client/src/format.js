// Türkçe biçimlendirme yardımcıları (tr-TR).

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const WEEKDAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const moneyFmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 });
const moneyFmt0 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('tr-TR');

/** ₺12.345,67 — `whole: true` ile kuruşsuz. */
export function formatMoney(value, { whole = false } = {}) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '—';
  return (whole ? moneyFmt0 : moneyFmt).format(Number(value));
}

/** Kısa tutar: ₺1,2 Mn / ₺845 B */
export function formatMoneyCompact(value) {
  if (value == null) return '—';
  const n = Number(value);
  if (Math.abs(n) >= 1e6) return `₺${(n / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} Mn`;
  if (Math.abs(n) >= 1e3) return `₺${(n / 1e3).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} B`;
  return formatMoney(n, { whole: true });
}

export function formatNumber(value, digits) {
  if (value === null || value === undefined || value === '') return '—';
  if (digits !== undefined) {
    return Number(value).toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  return numFmt.format(Number(value));
}

/** 12,5 gün — yarım günleri gösterir. */
export function formatDays(value) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} gün`;
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined) return '—';
  return `%${Number(value).toLocaleString('tr-TR', { maximumFractionDigits: digits })}`;
}

/** 'YYYY-MM-DD' → '27.09.2026' (saat dilimi kayması olmadan). */
export function formatDate(value) {
  if (!value) return '—';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  if (!d) return String(value);
  return `${d}.${m}.${y}`;
}

/** 'YYYY-MM-DD' → '27 Eylül 2026' */
export function formatDateLong(value) {
  if (!value) return '—';
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** 'YYYY-MM-DD' → '27 Eyl' */
export function formatDateShort(value) {
  if (!value) return '—';
  const [, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** SQLite UTC zaman damgası ('YYYY-MM-DD HH:MM:SS') veya ISO → yerel '27.09.2026 14:05'. */
export function formatDateTime(value) {
  if (!value) return '—';
  const s = String(value);
  const iso = s.includes('T') ? s : `${s.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDateRange(start, end) {
  if (!start) return '—';
  if (!end || start === end) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function periodLabel(year, month) {
  return `${MONTHS[month - 1]} ${year}`;
}

/** Bugünün tarihi (yerel) 'YYYY-MM-DD' olarak. */
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysStr(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Bugünden itibaren gün farkı: "bugün", "yarın", "3 gün sonra", "2 gün önce". */
export function relativeDays(date) {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((target - today) / 86_400_000);
  if (diff === 0) return 'bugün';
  if (diff === 1) return 'yarın';
  if (diff === -1) return 'dün';
  return diff > 0 ? `${diff} gün sonra` : `${-diff} gün önce`;
}

/** Hizmet süresi: "3 yıl 4 ay" */
export function formatTenure(startDate, endDate = todayStr()) {
  if (!startDate) return '—';
  const [y1, m1, d1] = startDate.split('-').map(Number);
  const [y2, m2, d2] = endDate.split('-').map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) months -= 1;
  if (months < 0) return '—';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years && !rest) return '1 aydan az';
  return [years ? `${years} yıl` : '', rest ? `${rest} ay` : ''].filter(Boolean).join(' ');
}

export function fullName(p) {
  if (!p) return '';
  return p.name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
}

export function initials(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toLocaleUpperCase('tr-TR'))
    .join('');
}

const AVATAR_COLORS = ['#2a78d6', '#1b8f69', '#b8621f', '#7a4bc2', '#c2476f', '#2f7d8c', '#5a6b86', '#9a6a00'];
export function avatarColor(seed) {
  const s = String(seed ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Türkçe duyarlı küçük harfe çevirip arama yapar. */
export function matches(haystack, needle) {
  if (!needle) return true;
  return String(haystack ?? '')
    .toLocaleLowerCase('tr-TR')
    .includes(String(needle).toLocaleLowerCase('tr-TR').trim());
}
