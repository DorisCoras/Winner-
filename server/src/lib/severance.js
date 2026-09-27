import { daysBetween, fullYearsBetween } from './dates.js';
import { round2 } from './payroll.js';

/** İhbar süresi (İş Kanunu m.17): hizmet süresine göre hafta. */
export function noticeWeeks(tenureDays) {
  const months = tenureDays / 30;
  if (months < 6) return 2;
  if (months < 18) return 4;
  if (months < 36) return 6;
  return 8;
}

/**
 * Kıdem ve ihbar tazminatı tahmini.
 * - Kıdem: en az 1 yıl hizmet; her tam yıl için 30 günlük giydirilmiş brüt (kıdem tavanı ile sınırlı),
 *   artan süre orantılı. Yalnızca damga vergisi kesilir.
 * - İhbar: süreye göre 2–8 hafta brüt ücret; gelir vergisi (marjinal oran) ve damga vergisi kesilir.
 * - Kullanılmayan yıllık izin ücreti: kalan gün × günlük brüt.
 */
export function calculateSeverance({
  hireDate,
  exitDate,
  monthlyGross,
  extraMonthly = 0,
  params,
  includeKidem = true,
  includeIhbar = false,
  unusedLeaveDays = 0,
  incomeTaxRate = 0.15,
}) {
  const tenureDays = Math.max(0, daysBetween(hireDate, exitDate) + 1);
  const years = fullYearsBetween(hireDate, exitDate);
  const dressedGross = monthlyGross + extraMonthly;
  const stampRate = params.stampTaxRate;

  const kidemEligible = includeKidem && tenureDays >= 365;
  const kidemBase = Math.min(dressedGross, params.severanceCeiling);
  const kidemGross = kidemEligible ? round2((kidemBase * tenureDays) / 365) : 0;
  const kidemStamp = round2(kidemGross * stampRate);

  const weeks = noticeWeeks(tenureDays);
  const ihbarGross = includeIhbar ? round2((dressedGross / 30) * weeks * 7) : 0;
  const ihbarIncomeTax = round2(ihbarGross * incomeTaxRate);
  const ihbarStamp = round2(ihbarGross * stampRate);

  const leaveGross = round2((monthlyGross / 30) * Math.max(0, unusedLeaveDays));

  return {
    tenureDays,
    years,
    dressedGross: round2(dressedGross),
    kidem: {
      eligible: kidemEligible,
      base: round2(kidemBase),
      capped: dressedGross > params.severanceCeiling,
      ceiling: params.severanceCeiling,
      gross: kidemGross,
      stampTax: kidemStamp,
      net: round2(kidemGross - kidemStamp),
    },
    ihbar: {
      eligible: includeIhbar,
      weeks,
      gross: ihbarGross,
      incomeTax: ihbarIncomeTax,
      stampTax: ihbarStamp,
      net: round2(ihbarGross - ihbarIncomeTax - ihbarStamp),
    },
    unusedLeave: { days: unusedLeaveDays, gross: leaveGross },
    totalGross: round2(kidemGross + ihbarGross + leaveGross),
  };
}
