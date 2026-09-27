/** T.C. Kimlik No doğrulaması (11 hane, ilk hane 0 olamaz, 10. ve 11. hane kontrol basamakları). */
export function isValidTcKimlik(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{10}$/.test(value)) return false;
  const d = value.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const d10 = (((odd * 7 - even) % 10) + 10) % 10;
  if (d10 !== d[9]) return false;
  const d11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return d11 === d[10];
}

/** Completes the two check digits for a 9-digit prefix (test/örnek veri üretimi için). */
export function completeTcKimlik(prefix9) {
  const d = prefix9.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  d.push((((odd * 7 - even) % 10) + 10) % 10);
  d.push(d.reduce((a, b) => a + b, 0) % 10);
  return d.join('');
}

export function normalizeIban(value) {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase();
}

function mod97(numeric) {
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  return rem;
}

function ibanNumeric(iban) {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  return rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
}

/** TR IBAN doğrulaması: TR + 24 hane, ISO 13616 mod-97 kontrolü. */
export function isValidTrIban(value) {
  const iban = normalizeIban(value);
  if (!/^TR\d{24}$/.test(iban)) return false;
  return mod97(ibanNumeric(iban)) === 1;
}

/** Builds a valid TR IBAN from a 22-digit BBAN (5 banka + 1 rezerv + 16 hesap). */
export function buildTrIban(bban22) {
  const check = 98 - mod97(ibanNumeric(`TR00${bban22}`));
  return `TR${String(check).padStart(2, '0')}${bban22}`;
}
