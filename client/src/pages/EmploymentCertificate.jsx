import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useApi } from '../api.js';
import { formatDate, formatTenure, fullName, todayStr } from '../format.js';
import { Alert, ErrorState, Loading } from '../components/ui.jsx';
import './EmploymentCertificate.css';

/** Çalışma belgesi (4857 sayılı İş Kanunu m.28) — yazdırılabilir sayfa. */
export default function EmploymentCertificate() {
  const { id } = useParams();
  const emp = useApi(`/employees/${id}`);
  const companyId = emp.data?.company_id;
  const company = useApi(companyId ? `/companies/${companyId}` : null);

  const name = emp.data ? fullName(emp.data) : '';
  useEffect(() => {
    if (!name) return undefined;
    const prev = document.title;
    // Yazdırma/PDF kaydetme sırasında dosya adı olarak kullanılır.
    document.title = `Çalışma Belgesi - ${name}`;
    return () => {
      document.title = prev;
    };
  }, [name]);

  if ((emp.loading && !emp.data) || (companyId && company.loading && !company.data)) return <Loading />;
  if (emp.error) return <ErrorState error={emp.error} onRetry={emp.reload} />;
  if (company.error) return <ErrorState error={company.error} onRetry={company.reload} />;
  if (!emp.data || !company.data) return <Loading />;

  const e = emp.data;
  const c = company.data;
  const left = e.status !== 'aktif';
  const today = todayStr();
  const tenureEnd = left && e.exit_date ? e.exit_date : today;
  const idText = e.tc_kimlik ? ` (T.C. Kimlik No: ${e.tc_kimlik})` : '';
  const asPosition = e.position ? (
    <>
      <b>{e.position}</b> olarak{' '}
    </>
  ) : null;

  return (
    <>
      <div className="no-print row wrap mb-2">
        <Link className="btn" to={`/personel/${e.id}`}>
          <ArrowLeft size={16} /> Personel kartına dön
        </Link>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={16} /> Yazdır
        </button>
      </div>

      {(!e.tc_kimlik || (left && !e.exit_date)) && (
        <div className="no-print mb-2">
          <Alert tone="warning" title="Eksik bilgi">
            {!e.tc_kimlik && <div>Personelin T.C. kimlik numarası kayıtlı değil; belgede gösterilmeyecek.</div>}
            {left && !e.exit_date && <div>Personel ayrılmış görünüyor ancak işten çıkış tarihi kayıtlı değil.</div>}
          </Alert>
        </div>
      )}

      <div className="print-page cert">
        <header className="cert-letterhead">
          <div className="cert-company">{c.name}</div>
          {c.address && <div>{c.address}</div>}
          <div>
            {[c.phone && `Tel: ${c.phone}`, c.email && `E-posta: ${c.email}`].filter(Boolean).join('  ·  ')}
          </div>
        </header>

        <div className="cert-date">Tarih: {formatDate(today)}</div>

        <h1 className="cert-title">ÇALIŞMA BELGESİ</h1>

        <p className="cert-addressee">İLGİLİ MAKAMA</p>

        <p className="cert-body">
          {left ? (
            <>
              <b>{fullName(e)}</b>
              {idText}, {formatDate(e.hire_date)} – {formatDate(e.exit_date)} tarihleri arasında şirketimizde {asPosition}
              çalışmıştır.
            </>
          ) : (
            <>
              Şirketimiz çalışanı <b>{fullName(e)}</b>
              {idText}, {formatDate(e.hire_date)} tarihinden bu yana şirketimizde {asPosition}
              çalışmaktadır.
            </>
          )}
        </p>

        <table className="cert-info">
          <tbody>
            <tr>
              <th>Adı Soyadı</th>
              <td>{fullName(e)}</td>
            </tr>
            {e.tc_kimlik && (
              <tr>
                <th>T.C. Kimlik No</th>
                <td>{e.tc_kimlik}</td>
              </tr>
            )}
            <tr>
              <th>Görevi</th>
              <td>{e.position || '—'}</td>
            </tr>
            <tr>
              <th>Departmanı</th>
              <td>{e.department_name || '—'}</td>
            </tr>
            <tr>
              <th>İşe Giriş Tarihi</th>
              <td>{formatDate(e.hire_date)}</td>
            </tr>
            {left && (
              <tr>
                <th>İşten Ayrılış Tarihi</th>
                <td>{formatDate(e.exit_date)}</td>
              </tr>
            )}
            <tr>
              <th>Hizmet Süresi</th>
              <td>
                {formatTenure(e.hire_date, tenureEnd)}
                {!left && <span className="cert-muted"> ({formatDate(today)} itibarıyla)</span>}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="cert-body">
          İşbu belge, ilgilinin talebi üzerine 4857 sayılı İş Kanunu&apos;nun 28. maddesi uyarınca düzenlenmiştir.
        </p>

        <div className="cert-signature">
          <div className="cert-company-sign">{c.name}</div>
          <div>İnsan Kaynakları</div>
          <div className="cert-stamp">Kaşe / İmza</div>
        </div>

        <footer className="cert-footer">
          {[
            c.tax_office || c.tax_no ? `Vergi Dairesi / No: ${c.tax_office ?? '—'} / ${c.tax_no ?? '—'}` : null,
            c.sgk_no ? `SGK İşyeri Sicil No: ${c.sgk_no}` : null,
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </footer>
      </div>
    </>
  );
}
