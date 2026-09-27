import { useEffect, useRef, useState } from 'react';
import { Calculator, CalendarDays, Landmark, TrendingDown, Wallet } from 'lucide-react';
import { api, useApi } from '../api.js';
import { formatMoney, formatMoneyCompact, formatNumber, formatPercent, MONTHS, MONTHS_SHORT } from '../format.js';
import { ColumnChart } from '../components/charts.jsx';
import { Alert, Card, EmptyState, ErrorState, Field, KeyValue, Loading, PageHeader, StatCard, useForm } from '../components/ui.jsx';
import './Payroll.css';

const CURRENT_YEAR = new Date().getFullYear();

/** "45.000,50", "45000.5" veya "45.000" gibi girişleri sayıya çevirir. */
function parseAmount(text) {
  const s = String(text ?? '').replace(/[\s₺TLtl]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
}

const pct = (rate, digits = 2) => formatPercent(rate * 100, digits);

export default function PayrollCalculator() {
  const { data: meta, loading: metaLoading, error: metaError, reload: reloadMeta } = useApi('/payroll/params');
  const f = useForm({ mode: 'gross', amount: '', year: String(CURRENT_YEAR), incentive: true });
  const [result, setResult] = useState(null);
  const initialized = useRef(false);
  const { setValues } = f;

  const years = meta?.years?.length ? [...meta.years].sort((a, b) => b - a) : [CURRENT_YEAR];

  // Parametreler yüklenince varsayılan yıl ve teşvik ayarını bir kez uygula.
  useEffect(() => {
    if (!meta || initialized.current) return;
    initialized.current = true;
    const list = meta.years ?? [];
    const year = list.includes(CURRENT_YEAR) || !list.length ? CURRENT_YEAR : Math.max(...list);
    setValues((v) => ({ ...v, year: String(year), incentive: !!meta.incentive }));
  }, [meta, setValues]);

  const calculate = (e) => {
    e.preventDefault();
    const amount = parseAmount(f.values.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      f.setErrors({ amount: 'Geçerli bir tutar giriniz.' });
      return;
    }
    f.submit(async (v) => {
      const res = await api.post('/payroll/calculate', {
        amount,
        mode: v.mode,
        year: Number(v.year),
        incentive: !!v.incentive,
      });
      setResult({ ...res, mode: v.mode, amount });
    });
  };

  if (metaError && !meta) return <ErrorState error={metaError} onRetry={reloadMeta} />;
  if (metaLoading && !meta) return <Loading />;

  const mode = f.values.mode;

  return (
    <>
      <PageHeader
        title="Maaş Hesaplama"
        subtitle="Brüt ücretten nete veya hedef net ücretten brüte 12 aylık bordro simülasyonu."
      />

      <div className="stack">
        <Card>
          <form className="calc-form" onSubmit={calculate}>
            <Field label="Hesaplama yönü">
              <div className="segmented" role="group" aria-label="Hesaplama yönü">
                <button type="button" aria-pressed={mode === 'gross'} onClick={() => f.set('mode', 'gross')}>
                  Brütten Nete
                </button>
                <button type="button" aria-pressed={mode === 'net'} onClick={() => f.set('mode', 'net')}>
                  Netten Brüte
                </button>
              </div>
            </Field>
            <Field
              className="calc-amount"
              label={mode === 'gross' ? 'Aylık brüt ücret (TL)' : 'Hedef aylık net ücret (TL)'}
              error={f.errors.amount}
              htmlFor="f-amount"
            >
              <input className="input num" type="text" inputMode="decimal" autoComplete="off" placeholder="Ör. 50.000" {...f.bind('amount')} />
            </Field>
            <Field label="Yıl" error={f.errors.year} htmlFor="f-year">
              <select className="select" {...f.bind('year')}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
            <label className="checkbox">
              <input type="checkbox" {...f.bind('incentive', { type: 'checkbox' })} />
              5 puanlık SGK işveren teşviki
            </label>
            <button type="submit" className="btn btn-primary" disabled={f.submitting}>
              <Calculator size={16} /> {f.submitting ? 'Hesaplanıyor…' : 'Hesapla'}
            </button>
          </form>
          {f.formError && (
            <div className="mt-2">
              <Alert tone="error">{f.formError}</Alert>
            </div>
          )}
        </Card>

        {result ? (
          <CalculationResult result={result} />
        ) : (
          <Card>
            <EmptyState title="Hesaplama yapılmadı" icon={Calculator}>
              Tutarı girip “Hesapla”ya basın. Sonuçlar, yıl içinde aynı ücretin 12 ay boyunca ödendiği varsayımıyla ay ay gösterilir.
            </EmptyState>
          </Card>
        )}
      </div>
    </>
  );
}

function CalculationResult({ result }) {
  const { months, totals, params, incentive, mode } = result;
  const first = months[0];
  const avgNet = totals.net / months.length;
  const lastNet = months.at(-1).net;
  const chartKey = mode === 'gross' ? 'net' : 'gross';
  const chartData = months.map((m) => ({ label: MONTHS_SHORT[m.month - 1], title: `${MONTHS[m.month - 1]} ${params.year}`, [chartKey]: m[chartKey] }));
  const sgkCeiling = params.minWageGross * params.sgkCeilingMultiplier;
  const employerRate = params.sgkEmployerRate - (incentive ? params.employerIncentiveRate : 0);

  return (
    <>
      <div className="grid grid-4">
        <StatCard
          icon={Wallet}
          tone="green"
          label="Ocak ayı net"
          value={formatMoney(first.net)}
          sub={mode === 'net' ? `Gerekli brüt: ${formatMoney(first.gross)}` : `Brüt: ${formatMoney(first.gross)}`}
        />
        <StatCard icon={CalendarDays} label="Yıllık toplam net" value={formatMoney(totals.net)} sub={`Yıllık brüt: ${formatMoney(totals.gross)}`} />
        <StatCard
          icon={Landmark}
          tone="teal"
          label="Yıllık işveren maliyeti"
          value={formatMoney(totals.employerCost)}
          sub={incentive ? '5 puanlık teşvik uygulandı' : 'Teşviksiz'}
        />
        {mode === 'gross' ? (
          <StatCard
            icon={TrendingDown}
            tone="amber"
            label="Ortalama aylık net"
            value={formatMoney(avgNet)}
            sub={lastNet < first.net ? `Aralık neti: ${formatMoney(lastNet)}` : undefined}
          />
        ) : (
          <StatCard
            icon={TrendingDown}
            tone="amber"
            label="Ortalama aylık brüt"
            value={formatMoney(totals.gross / months.length)}
            sub={`Aralık brütü: ${formatMoney(months.at(-1).gross)}`}
          />
        )}
      </div>

      <div className="calc-layout">
        <div className="stack">
          <Card
            title={mode === 'gross' ? 'Aylara göre net ücret' : 'Aylara göre gerekli brüt ücret'}
            hint={
              mode === 'gross'
                ? 'Kümülatif gelir vergisi matrahı arttıkça üst vergi dilimine geçilir ve net ücret azalır.'
                : 'Aynı neti korumak için vergi dilimi yükseldikçe daha yüksek brüt gerekir.'
            }
          >
            <ColumnChart
              data={chartData}
              series={[{ key: chartKey, label: mode === 'gross' ? 'Net ücret' : 'Brüt ücret' }]}
              format={(v) => formatMoney(v)}
              axisFormat={formatMoneyCompact}
            />
          </Card>

          <Card title="Aylık hesaplama tablosu" hint="30 gün, yıl başından itibaren aynı işverende çalışma varsayılmıştır." flush>
            <div className="table-wrap">
              <table className="table compact">
                <thead>
                  <tr>
                    <th>Ay</th>
                    <th className="num">Brüt</th>
                    <th className="num">SGK İşçi</th>
                    <th className="num">İşsizlik İşçi</th>
                    <th className="num">GV Matrahı</th>
                    <th className="num">Kümülatif Matrah</th>
                    <th className="num">Vergi Dilimi</th>
                    <th className="num">Gelir Vergisi</th>
                    <th className="num">Damga</th>
                    <th className="num">Net</th>
                    <th className="num">İşveren SGK</th>
                    <th className="num">İşveren İşsizlik</th>
                    <th className="num">Toplam Maliyet</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m, i) => {
                    const bracketUp = i > 0 && m.taxRate > months[i - 1].taxRate;
                    return (
                      <tr key={m.month}>
                        <td className="strong">{MONTHS[m.month - 1]}</td>
                        <td className="num">{formatMoney(m.gross)}</td>
                        <td className="num">{formatMoney(m.sgkEmployee)}</td>
                        <td className="num">{formatMoney(m.unemploymentEmployee)}</td>
                        <td className="num">{formatMoney(m.incomeTaxBase)}</td>
                        <td className="num">{formatMoney(m.cumulativeBaseAfter)}</td>
                        <td className={`num ${bracketUp ? 'strong text-warning' : ''}`} title={bracketUp ? 'Bu ay üst vergi dilimine geçildi' : undefined}>
                          {pct(m.taxRate, 0)}
                        </td>
                        <td className="num">
                          {formatMoney(m.incomeTax)}
                          {m.incomeTaxExemption > 0 && <span className="cell-sub">İstisna: {formatMoney(m.incomeTaxExemption)}</span>}
                        </td>
                        <td className="num">{formatMoney(m.stampTax)}</td>
                        <td className="num strong">{formatMoney(m.net)}</td>
                        <td className="num">{formatMoney(m.sgkEmployer)}</td>
                        <td className="num">{formatMoney(m.unemploymentEmployer)}</td>
                        <td className="num">{formatMoney(m.employerCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Toplam</td>
                    <td className="num">{formatMoney(totals.gross)}</td>
                    <td className="num">{formatMoney(totals.sgkEmployee)}</td>
                    <td className="num">{formatMoney(totals.unemploymentEmployee)}</td>
                    <td className="num">{formatMoney(totals.incomeTaxBase)}</td>
                    <td />
                    <td />
                    <td className="num">
                      {formatMoney(totals.incomeTax)}
                      {totals.incomeTaxExemption > 0 && <span className="cell-sub">İstisna: {formatMoney(totals.incomeTaxExemption)}</span>}
                    </td>
                    <td className="num">{formatMoney(totals.stampTax)}</td>
                    <td className="num">{formatMoney(totals.net)}</td>
                    <td className="num">{formatMoney(totals.sgkEmployer)}</td>
                    <td className="num">{formatMoney(totals.unemploymentEmployer)}</td>
                    <td className="num">{formatMoney(totals.employerCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title={`${params.year} parametreleri`}>
            <KeyValue
              items={[
                ['Asgari ücret (brüt)', formatMoney(params.minWageGross)],
                ['SGK tavanı', `${formatMoney(sgkCeiling)} (${formatNumber(params.sgkCeilingMultiplier)} kat)`],
                ['SGK işçi payı', pct(params.sgkEmployeeRate)],
                ['İşsizlik işçi payı', pct(params.unemploymentEmployeeRate)],
                [
                  'SGK işveren payı',
                  incentive ? `${pct(employerRate)} (teşvikli, normalde ${pct(params.sgkEmployerRate)})` : pct(params.sgkEmployerRate),
                ],
                ['İşsizlik işveren payı', pct(params.unemploymentEmployerRate)],
                ['Damga vergisi', `‰${formatNumber(params.stampTaxRate * 1000, 2)}`],
              ]}
            />
            <div className="form-section-title mt-2" style={{ marginBottom: 6 }}>
              Gelir vergisi dilimleri
            </div>
            <ul className="bracket-list">
              {params.brackets.map((b, i) => {
                const lower = i === 0 ? 0 : params.brackets[i - 1].upTo;
                return (
                  <li key={i}>
                    <span>
                      {b.upTo == null
                        ? `${formatMoney(lower, { whole: true })} üzeri`
                        : `${formatMoney(lower, { whole: true })} – ${formatMoney(b.upTo, { whole: true })}`}
                    </span>
                    <span className="strong">{pct(b.rate, 0)}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Alert tone="warning" title="Bilgilendirme amaçlıdır">
            Hesaplama sistemde tanımlı parametrelerle yapılır; asgari ücret gelir ve damga vergisi istisnaları dahildir. Resmi oranlar ve
            güncel mevzuat muhasebe birimi veya mali müşavir ile doğrulanmalıdır.
          </Alert>
        </div>
      </div>
    </>
  );
}
