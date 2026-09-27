// Türkiye bordro hesaplaması (brütten nete, netten brüte).
// Parametreler yıl bazında veritabanında tutulur ve Ayarlar > Bordro Parametreleri
// ekranından güncellenebilir. Varsayılanlar bilgilendirme amaçlıdır; resmi oranlar
// her dönem mali müşavir / SGK duyurularıyla kontrol edilmelidir.

export const DEFAULT_PAYROLL_PARAMS = {
  2025: {
    minWageGross: 26005.5,
    sgkEmployeeRate: 0.14,
    unemploymentEmployeeRate: 0.01,
    sgkEmployerRate: 0.2075,
    unemploymentEmployerRate: 0.02,
    employerIncentiveRate: 0.05,
    stampTaxRate: 0.00759,
    sgkCeilingMultiplier: 7.5,
    severanceCeiling: 53919.68,
    brackets: [
      { upTo: 158000, rate: 0.15 },
      { upTo: 330000, rate: 0.2 },
      { upTo: 1200000, rate: 0.27 },
      { upTo: 4300000, rate: 0.35 },
      { upTo: null, rate: 0.4 },
    ],
  },
  2026: {
    minWageGross: 33030,
    sgkEmployeeRate: 0.14,
    unemploymentEmployeeRate: 0.01,
    sgkEmployerRate: 0.2075,
    unemploymentEmployerRate: 0.02,
    employerIncentiveRate: 0.05,
    stampTaxRate: 0.00759,
    sgkCeilingMultiplier: 7.5,
    severanceCeiling: 64948.77,
    brackets: [
      { upTo: 190000, rate: 0.15 },
      { upTo: 400000, rate: 0.2 },
      { upTo: 1500000, rate: 0.27 },
      { upTo: 5300000, rate: 0.35 },
      { upTo: null, rate: 0.4 },
    ],
  },
};

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Kümülatif matraha göre gelir vergisi (artan oranlı tarife). */
export function cumulativeIncomeTax(base, brackets) {
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of brackets) {
    const upper = upTo == null ? Infinity : upTo;
    if (base <= lower) break;
    tax += (Math.min(base, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

/** Marginal rate that applies to the next lira at the given cumulative base. */
export function marginalRate(base, brackets) {
  for (const { upTo, rate } of brackets) if (upTo == null || base < upTo) return rate;
  return brackets.at(-1).rate;
}

/**
 * Tek bir ay için bordro kalemi.
 * @param {object} o
 * @param {number} o.gross               Ay için toplam brüt (ek ödemeler dahil, gün oranlaması yapılmış)
 * @param {number} o.month               1–12
 * @param {number} o.cumulativeBaseBefore Yıl içinde önceki ayların gelir vergisi matrahı toplamı
 * @param {number} [o.days=30]           SGK prim günü
 * @param {object} o.params              Yıl parametreleri
 * @param {boolean} [o.incentive=true]   5 puanlık hazine teşviki uygulansın mı
 * @param {number} [o.deductions=0]      Netten yapılacak kesintiler (avans, icra vb.)
 */
export function calculateMonth({ gross, month, cumulativeBaseBefore = 0, days = 30, params, incentive = true, deductions = 0 }) {
  const p = params;
  const dayRatio = Math.min(Math.max(days, 0), 30) / 30;

  const sgkCeiling = p.minWageGross * p.sgkCeilingMultiplier * dayRatio;
  const sgkBase = round2(Math.min(gross, sgkCeiling));
  const sgkEmployee = round2(sgkBase * p.sgkEmployeeRate);
  const unemploymentEmployee = round2(sgkBase * p.unemploymentEmployeeRate);

  const incomeTaxBase = round2(gross - sgkEmployee - unemploymentEmployee);
  const incomeTaxGross = round2(
    cumulativeIncomeTax(cumulativeBaseBefore + incomeTaxBase, p.brackets) - cumulativeIncomeTax(cumulativeBaseBefore, p.brackets),
  );

  // Asgari ücret istisnası (GVK 23/18): asgari ücretin kendi kümülatif matrahı üzerinden
  // hesaplanan vergi kadar gelir vergisi ve asgari ücrete isabet eden damga vergisi alınmaz.
  const mwGross = p.minWageGross * dayRatio;
  const mwMonthlyBase = p.minWageGross * (1 - p.sgkEmployeeRate - p.unemploymentEmployeeRate);
  const mwBase = mwMonthlyBase * dayRatio;
  const mwCumBefore = mwMonthlyBase * (month - 1);
  const mwTax = round2(cumulativeIncomeTax(mwCumBefore + mwBase, p.brackets) - cumulativeIncomeTax(mwCumBefore, p.brackets));
  const incomeTaxExemption = Math.min(mwTax, incomeTaxGross);
  const incomeTax = round2(incomeTaxGross - incomeTaxExemption);

  const stampTaxGross = round2(gross * p.stampTaxRate);
  const stampTaxExemption = Math.min(round2(mwGross * p.stampTaxRate), stampTaxGross);
  const stampTax = round2(stampTaxGross - stampTaxExemption);

  const net = round2(gross - sgkEmployee - unemploymentEmployee - incomeTax - stampTax - deductions);

  const employerRate = p.sgkEmployerRate - (incentive ? p.employerIncentiveRate : 0);
  const sgkEmployer = round2(sgkBase * employerRate);
  const unemploymentEmployer = round2(sgkBase * p.unemploymentEmployerRate);
  const employerCost = round2(gross + sgkEmployer + unemploymentEmployer);

  return {
    month,
    days,
    gross: round2(gross),
    sgkBase,
    sgkEmployee,
    unemploymentEmployee,
    incomeTaxBase,
    cumulativeBaseBefore: round2(cumulativeBaseBefore),
    cumulativeBaseAfter: round2(cumulativeBaseBefore + incomeTaxBase),
    incomeTaxGross,
    incomeTaxExemption,
    incomeTax,
    stampTaxGross,
    stampTaxExemption,
    stampTax,
    deductions: round2(deductions),
    net,
    sgkEmployer,
    unemploymentEmployer,
    employerCost,
    taxRate: marginalRate(cumulativeBaseBefore + incomeTaxBase, p.brackets),
  };
}

/** 12 aylık brütten nete tablo (aynı brüt her ay). */
export function annualFromGross({ gross, params, incentive = true, startMonth = 1 }) {
  const months = [];
  let cumulative = 0;
  for (let m = startMonth; m <= 12; m++) {
    const row = calculateMonth({ gross, month: m, cumulativeBaseBefore: cumulative, params, incentive });
    cumulative = row.cumulativeBaseAfter;
    months.push(row);
  }
  return { months, totals: sumRows(months) };
}

/** Netten brüte: belirtilen ayda hedef nete ulaşan brütü ikili arama ile bulur. */
export function grossFromNet({ net, month = 1, cumulativeBaseBefore = 0, params, incentive = true }) {
  let lo = net;
  let hi = net * 3 + 100000;
  for (let i = 0; i < 200 && hi - lo > 0.001; i++) {
    const mid = (lo + hi) / 2;
    const r = calculateMonth({ gross: mid, month, cumulativeBaseBefore, params, incentive });
    if (r.net < net) lo = mid;
    else hi = mid;
  }
  return round2(hi);
}

/** Her ay aynı neti sağlayacak brütleri hesaplar (kümülatif matrah arttıkça brüt yükselir). */
export function annualFromNet({ net, params, incentive = true, startMonth = 1 }) {
  const months = [];
  let cumulative = 0;
  for (let m = startMonth; m <= 12; m++) {
    const gross = grossFromNet({ net, month: m, cumulativeBaseBefore: cumulative, params, incentive });
    const row = calculateMonth({ gross, month: m, cumulativeBaseBefore: cumulative, params, incentive });
    cumulative = row.cumulativeBaseAfter;
    months.push(row);
  }
  return { months, totals: sumRows(months) };
}

const SUM_KEYS = [
  'gross', 'sgkEmployee', 'unemploymentEmployee', 'incomeTaxBase', 'incomeTaxGross', 'incomeTaxExemption',
  'incomeTax', 'stampTaxGross', 'stampTaxExemption', 'stampTax', 'deductions', 'net', 'sgkEmployer',
  'unemploymentEmployer', 'employerCost',
];

export function sumRows(rows) {
  const totals = {};
  for (const k of SUM_KEYS) totals[k] = round2(rows.reduce((s, r) => s + (r[k] ?? 0), 0));
  return totals;
}
