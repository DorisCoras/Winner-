import { isDemo, notify } from './demo/flag.js';

// Excel (Türkçe) uyumlu CSV dışa aktarma: UTF-8 BOM + noktalı virgül ayırıcı.

function cell(value) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'number' ? value.toLocaleString('tr-TR', { useGrouping: false, maximumFractionDigits: 2 }) : String(value);
  // Formül enjeksiyonunu önle
  if (/^[=+\-@]/.test(s) && typeof value !== 'number') s = `'${s}`;
  if (/[;"\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {string} filename  örn. 'personel-listesi.csv'
 * @param {{ header: string, value: (row) => any }[]} columns
 * @param {object[]} rows
 */
export function downloadCsv(filename, columns, rows) {
  if (isDemo()) {
    notify('Excel\'e aktarma demo sürümünde kapalıdır; kurulu sürümde dosya olarak indirilir.');
    return;
  }
  const lines = [columns.map((c) => cell(c.header)).join(';')];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(';'));
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
