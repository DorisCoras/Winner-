import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annualEntitlementDays, countLeaveDays, entitlementHistory, leaveBalance } from '../src/lib/leave.js';
import { calculateMonth, annualFromGross, grossFromNet, cumulativeIncomeTax, DEFAULT_PAYROLL_PARAMS } from '../src/lib/payroll.js';
import { calculateSeverance, noticeWeeks } from '../src/lib/severance.js';
import { isValidTcKimlik, completeTcKimlik, isValidTrIban, buildTrIban } from '../src/lib/validators.js';
import { addYears, fullYearsBetween, isValidDate } from '../src/lib/dates.js';

const P26 = DEFAULT_PAYROLL_PARAMS[2026];

test('yıllık izin hakkı İş Kanunu m.53 kademelerine uyar', () => {
  assert.equal(annualEntitlementDays(0, 30), 0);
  assert.equal(annualEntitlementDays(1, 30), 14);
  assert.equal(annualEntitlementDays(5, 30), 14);
  assert.equal(annualEntitlementDays(6, 30), 20);
  assert.equal(annualEntitlementDays(14, 40), 20);
  assert.equal(annualEntitlementDays(15, 40), 26);
  // 18 yaş ve altı / 50 yaş ve üzeri en az 20 gün
  assert.equal(annualEntitlementDays(1, 18), 20);
  assert.equal(annualEntitlementDays(2, 50), 20);
  assert.equal(annualEntitlementDays(16, 55), 26);
});

test('hak ediş geçmişi her yıldönümünde birikir', () => {
  const h = entitlementHistory('2019-03-15', '1990-01-01', '2026-03-15');
  assert.equal(h.length, 7);
  assert.deepEqual(h.map((x) => x.days), [14, 14, 14, 14, 14, 20, 20]);
  const bal = leaveBalance({ hireDate: '2019-03-15', birthDate: '1990-01-01', carryover: -10, usedDays: 30, pendingDays: 5, asOf: '2026-03-15' });
  assert.equal(bal.earned, 110);
  assert.equal(bal.balance, 70);
  assert.equal(bal.available, 65);
  assert.equal(bal.next.date, '2027-03-15');
});

test('izin günü hesabı hafta sonu ve resmi tatilleri düşer', () => {
  const holidays = new Map([
    ['2026-10-28', { half_day: 1 }],
    ['2026-10-29', { half_day: 0 }],
  ]);
  // 26 Ekim Pzt – 1 Kasım Paz: 5 iş günü - 29 Ekim tatil - 28 Ekim yarım gün = 3.5
  assert.equal(countLeaveDays('2026-10-26', '2026-11-01', { holidays }), 3.5);
  assert.equal(countLeaveDays('2026-10-26', '2026-11-01', { holidays, saturdayWorkday: true }), 4.5);
  assert.equal(countLeaveDays('2026-10-26', '2026-10-26', { halfDay: true }), 0.5);
  assert.equal(countLeaveDays('2026-10-31', '2026-11-01'), 0);
  assert.equal(countLeaveDays('2026-11-02', '2026-11-01'), 0);
});

test('asgari ücret neti 2026 için 28.075,50 TL ve vergisiz', () => {
  const r = calculateMonth({ gross: 33030, month: 1, params: P26 });
  assert.equal(r.sgkEmployee, 4624.2);
  assert.equal(r.unemploymentEmployee, 330.3);
  assert.equal(r.incomeTax, 0);
  assert.equal(r.stampTax, 0);
  assert.equal(r.net, 28075.5);
  // Yıl boyunca asgari ücretli hep aynı neti alır (istisna kümülatif olarak işler).
  const year = annualFromGross({ gross: 33030, params: P26 });
  assert.ok(year.months.every((m) => m.net === 28075.5));
});

test('brütten nete: istisna ve damga vergisi doğru uygulanır', () => {
  const r = calculateMonth({ gross: 80000, month: 1, params: P26 });
  assert.equal(r.incomeTaxBase, 68000);
  assert.equal(r.incomeTaxGross, 10200);
  assert.equal(r.incomeTaxExemption, 4211.33);
  assert.equal(r.incomeTax, 5988.67);
  assert.equal(r.stampTax, 356.5);
  assert.equal(r.net, 61654.83);
});

test('SGK tavanı prim matrahını sınırlar', () => {
  const r = calculateMonth({ gross: 400000, month: 1, params: P26 });
  assert.equal(r.sgkBase, 33030 * 7.5);
  assert.equal(r.sgkEmployee, Math.round(33030 * 7.5 * 0.14 * 100) / 100);
});

test('artan oranlı tarife ve netten brüte', () => {
  assert.equal(cumulativeIncomeTax(190000, P26.brackets), 28500);
  assert.equal(cumulativeIncomeTax(400000, P26.brackets), 70500);
  assert.equal(cumulativeIncomeTax(1500000, P26.brackets), 367500);
  const gross = grossFromNet({ net: 50000, month: 1, params: P26 });
  const back = calculateMonth({ gross, month: 1, params: P26 });
  assert.ok(Math.abs(back.net - 50000) < 0.02, `net ${back.net}`);
});

test('kıdem ve ihbar tazminatı', () => {
  assert.equal(noticeWeeks(100), 2);
  assert.equal(noticeWeeks(400), 4);
  assert.equal(noticeWeeks(800), 6);
  assert.equal(noticeWeeks(2000), 8);
  const s = calculateSeverance({
    hireDate: '2020-01-01',
    exitDate: '2025-12-31',
    monthlyGross: 100000,
    params: P26,
    includeKidem: true,
    includeIhbar: true,
  });
  assert.equal(s.years, 5);
  assert.equal(s.kidem.capped, true);
  assert.equal(s.kidem.base, P26.severanceCeiling);
  assert.ok(s.kidem.gross > 0 && s.kidem.net < s.kidem.gross);
  assert.equal(s.ihbar.weeks, 8);
  const short = calculateSeverance({ hireDate: '2025-06-01', exitDate: '2026-01-15', monthlyGross: 50000, params: P26 });
  assert.equal(short.kidem.eligible, false);
  assert.equal(short.kidem.gross, 0);
});

test('T.C. Kimlik No ve IBAN doğrulama', () => {
  assert.equal(isValidTcKimlik('10000000146'), true);
  assert.equal(isValidTcKimlik('10000000147'), false);
  assert.equal(isValidTcKimlik('01234567890'), false);
  assert.equal(isValidTcKimlik(completeTcKimlik('123456789')), true);
  const iban = buildTrIban('0006200119000006672315');
  assert.equal(isValidTrIban(iban), true);
  assert.equal(isValidTrIban(iban.replace(/.$/, (c) => String((Number(c) + 1) % 10))), false);
  assert.equal(isValidTrIban('TR12 3456'), false);
});

test('tarih yardımcıları', () => {
  assert.equal(addYears('2024-02-29', 1), '2025-02-28');
  assert.equal(fullYearsBetween('2020-05-10', '2026-05-09'), 5);
  assert.equal(fullYearsBetween('2020-05-10', '2026-05-10'), 6);
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('2026-02-28'), true);
});
