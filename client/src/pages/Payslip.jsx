import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { formatDate, formatMoney, periodLabel, todayStr } from '../format.js';
import { Alert, ErrorState, Loading, PrintButton } from '../components/ui.jsx';
import './Payroll.css';

/** rows: [{ label, value, info?, total?, negative? }] — iki sütunlu tutar tablosu. */
function Lines({ rows }) {
  return (
    <table className="payslip-lines">
      <tbody>
        {rows.filter(Boolean).map((r) => (
          <tr key={r.label} className={r.total ? 'total' : r.info ? 'info' : undefined}>
            <td>{r.label}</td>
            <td className="num">
              {r.negative && r.value > 0 ? '−' : ''}
              {formatMoney(r.value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Payslip() {
  const { id } = useParams();
  const { isHR } = useAuth();
  const { data: p, loading, error, reload } = useApi(`/payroll/items/${id}`);

  const backTo = isHR && p ? `/bordro/${p.run_id}` : '/bordrolarim';
  const backLabel = isHR ? 'Bordro detayına dön' : 'Bordrolarım';

  if (error && !p) {
    return (
      <>
        <div className="print-bar no-print">
          <Link className="back-link" to={isHR ? '/bordro' : '/bordrolarim'}>
            <ArrowLeft size={14} /> {isHR ? 'Bordro Dönemleri' : 'Bordrolarım'}
          </Link>
        </div>
        <ErrorState error={error} onRetry={error.status === 403 || error.status === 404 ? undefined : reload} />
      </>
    );
  }
  if (loading && !p) return <Loading />;
  if (!p) return null;

  const period = periodLabel(p.year, p.month);
  const legalTotal = p.sgk_employee + p.unemployment_employee + p.income_tax + p.stamp_tax;
  const isDraft = p.run_status !== 'onaylandi';

  return (
    <>
      <div className="print-bar no-print">
        <Link className="back-link" to={backTo} style={{ marginBottom: 0 }}>
          <ArrowLeft size={14} /> {backLabel}
        </Link>
        <PrintButton />
      </div>
      {isDraft && (
        <div className="no-print" style={{ maxWidth: 820, margin: '0 auto 14px' }}>
          <Alert tone="warning">Bu bordro henüz onaylanmadı; tutarlar değişebilir ve pusula çalışana görünmez.</Alert>
        </div>
      )}

      <div className="print-page payslip">
        <div className="payslip-head">
          <div className="payslip-company">
            <div className="name">{p.company_name}</div>
            {p.company_address && <div>{p.company_address}</div>}
            {(p.company_tax_office || p.company_tax_no) && (
              <div>
                Vergi Dairesi / No: {p.company_tax_office ?? '—'} / {p.company_tax_no ?? '—'}
              </div>
            )}
            {p.company_sgk_no && <div>SGK İşyeri Sicil No: {p.company_sgk_no}</div>}
          </div>
          <div className="payslip-title">
            <h1>ÜCRET HESAP PUSULASI</h1>
            <div className="period">Dönem: {period}</div>
            {isDraft && <div className="payslip-draft">TASLAK</div>}
          </div>
        </div>

        <section className="payslip-section">
          <h2>Çalışan Bilgileri</h2>
          <table className="payslip-info">
            <tbody>
              <tr>
                <td>Ad Soyad</td>
                <td>{p.employee_name}</td>
                <td>T.C. Kimlik No</td>
                <td>{p.tc_kimlik ?? '—'}</td>
              </tr>
              <tr>
                <td>Sicil No</td>
                <td>{p.sicil_no ?? '—'}</td>
                <td>SGK No</td>
                <td>{p.sgk_no ?? '—'}</td>
              </tr>
              <tr>
                <td>Pozisyon</td>
                <td>{p.position ?? '—'}</td>
                <td>Departman</td>
                <td>{p.department_name ?? '—'}</td>
              </tr>
              <tr>
                <td>İşe Giriş</td>
                <td>{formatDate(p.hire_date)}</td>
                <td>Prim Günü</td>
                <td>{p.days} gün</td>
              </tr>
              <tr>
                <td>IBAN</td>
                <td colSpan={3} className="mono" style={{ wordBreak: 'break-all' }}>
                  {p.iban ? p.iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim() : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="payslip-section">
          <h2>Kazançlar</h2>
          <Lines
            rows={[
              { label: `Aylık brüt ücret (${p.days} gün)`, value: p.base_gross },
              { label: 'Ek ödemeler (prim, ikramiye, fazla mesai)', value: p.extra_gross },
              { label: 'Toplam brüt kazanç', value: p.gross, total: true },
            ]}
          />
        </section>

        <section className="payslip-section">
          <h2>Yasal Kesintiler</h2>
          <Lines
            rows={[
              { label: 'SGK primi işçi payı', value: p.sgk_employee },
              { label: 'İşsizlik sigortası işçi payı', value: p.unemployment_employee },
              { label: 'Gelir vergisi matrahı', value: p.income_tax_base, info: true },
              { label: 'Kümülatif gelir vergisi matrahı', value: p.cumulative_base_before + p.income_tax_base, info: true },
              { label: 'Hesaplanan gelir vergisi', value: p.income_tax_gross, info: true },
              { label: 'Asgari ücret gelir vergisi istisnası', value: p.income_tax_exemption, info: true, negative: true },
              { label: 'Ödenecek gelir vergisi', value: p.income_tax },
              { label: 'Hesaplanan damga vergisi', value: p.stamp_tax_gross, info: true },
              { label: 'Damga vergisi istisnası', value: p.stamp_tax_exemption, info: true, negative: true },
              { label: 'Ödenecek damga vergisi', value: p.stamp_tax },
              { label: 'Toplam yasal kesinti', value: legalTotal, total: true },
            ]}
          />
        </section>

        <section className="payslip-section">
          <h2>Diğer Kesintiler</h2>
          <Lines
            rows={[
              { label: p.note ? `Avans, icra vb. — ${p.note}` : 'Avans, icra vb.', value: p.deductions },
              { label: 'Toplam diğer kesinti', value: p.deductions, total: true },
            ]}
          />
        </section>

        <div className="payslip-net">
          <span className="label">NET ÖDENECEK</span>
          <span className="amount">{formatMoney(p.net)}</span>
        </div>

        {isHR && (
          <section className="payslip-section">
            <h2>İşveren Maliyeti</h2>
            <Lines
              rows={[
                { label: 'Toplam brüt kazanç', value: p.gross, info: true },
                { label: 'SGK primi işveren payı', value: p.sgk_employer },
                { label: 'İşsizlik sigortası işveren payı', value: p.unemployment_employer },
                { label: 'Toplam işveren maliyeti', value: p.employer_cost, total: true },
              ]}
            />
          </section>
        )}

        <div className="payslip-signatures">
          <div className="sig">
            <div className="sig-line">İşveren (Kaşe / İmza)</div>
          </div>
          <div className="sig">
            <div className="sig-line">Çalışan (Ad Soyad / İmza)</div>
          </div>
        </div>

        <div className="payslip-footnote">
          Bu belge FIMAR İK sistemi tarafından oluşturulmuştur. · Düzenlenme tarihi: {formatDate(todayStr())}
        </div>
      </div>
    </>
  );
}
