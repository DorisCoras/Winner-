import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorState, Loading, PrintButton } from '../components/ui.jsx';
import { formatDate, formatMoney } from '../format.js';
import './AssetReceipt.css';

const CLAUSE =
  'Yukarıda bilgileri yazılı demirbaşı sağlam ve çalışır durumda teslim aldım. Görevim süresince özenle kullanacağımı, ' +
  'başkasına devretmeyeceğimi, işten ayrılmam veya talep edilmesi halinde eksiksiz ve çalışır durumda iade edeceğimi, ' +
  'kusurum nedeniyle oluşabilecek zararları karşılayacağımı kabul ve beyan ederim.';

function SignBox({ title, name, date }) {
  return (
    <div className="receipt-sign">
      <div className="receipt-sign-title">{title}</div>
      <div className="receipt-sign-line">
        <span>Ad Soyad:</span>
        <span>{name}</span>
      </div>
      <div className="receipt-sign-line">
        <span>Tarih:</span>
        <span>{date}</span>
      </div>
      <div className="receipt-sign-line tall">
        <span>İmza:</span>
        <span />
      </div>
    </div>
  );
}

export default function AssetReceipt() {
  const { id } = useParams();
  const { isHR } = useAuth();
  const { data: r, loading, error, reload } = useApi(`/asset-assignments/${id}`);
  const back = isHR ? { to: '/zimmet', label: 'Zimmet listesine dön' } : { to: '/profilim', label: 'Profilime dön' };

  const bar = (
    <div className="receipt-bar no-print">
      <Link className="btn btn-ghost" to={back.to}>
        <ArrowLeft size={16} /> {back.label}
      </Link>
      {r && (
        <PrintButton />
      )}
    </div>
  );

  if (!r && loading) return <Loading />;
  if (!r) {
    return (
      <>
        {bar}
        <ErrorState error={error} onRetry={reload} />
      </>
    );
  }

  const receiptNo = `ZMT-${String(r.id).padStart(6, '0')}`;

  return (
    <>
      {bar}
      <div className="print-page receipt">
        <header className="receipt-head">
          <div>
            <div className="receipt-company">{r.company_name}</div>
            {r.company_address && <div className="receipt-address">{r.company_address}</div>}
          </div>
          <div className="receipt-meta">
            <div>
              <b>Tutanak No:</b> {receiptNo}
            </div>
            <div>
              <b>Tarih:</b> {formatDate(r.assigned_at)}
            </div>
          </div>
        </header>

        <h1>DEMİRBAŞ ZİMMET TUTANAĞI</h1>

        <div className="receipt-section">PERSONEL BİLGİLERİ</div>
        <table className="receipt-kv">
          <tbody>
            <tr>
              <th scope="row">Ad Soyad</th>
              <td>{r.employee_name}</td>
            </tr>
            <tr>
              <th scope="row">T.C. Kimlik No</th>
              <td>{r.tc_kimlik || '—'}</td>
            </tr>
            <tr>
              <th scope="row">Sicil No</th>
              <td>{r.sicil_no || '—'}</td>
            </tr>
            <tr>
              <th scope="row">Görevi</th>
              <td>{r.position || '—'}</td>
            </tr>
            <tr>
              <th scope="row">Departman</th>
              <td>{r.department_name || '—'}</td>
            </tr>
          </tbody>
        </table>

        <div className="receipt-section">DEMİRBAŞ BİLGİLERİ</div>
        <div className="receipt-scroll">
          <table>
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Demirbaş / Model</th>
                <th>Seri No / Plaka</th>
                <th className="num">Değeri</th>
                <th>Teslim Tarihi</th>
                <th>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{r.category}</td>
                <td>{r.asset_name}</td>
                <td>{r.serial_no || '—'}</td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>
                  {formatMoney(r.value)}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.assigned_at)}</td>
                <td>{r.notes || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="receipt-clause">{CLAUSE}</p>

        {r.returned_at && (
          <>
            <div className="receipt-section">İADE BİLGİLERİ</div>
            <table className="receipt-kv">
              <tbody>
                <tr>
                  <th scope="row">İade Tarihi</th>
                  <td>{formatDate(r.returned_at)}</td>
                </tr>
                <tr>
                  <th scope="row">Açıklama</th>
                  <td>{r.return_notes || '—'}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <div className="receipt-signs">
          <SignBox title="Teslim Eden (İnsan Kaynakları)" />
          <SignBox title="Teslim Alan (Personel)" name={r.employee_name} date={formatDate(r.assigned_at)} />
        </div>

        <div className="receipt-footnote">İşbu tutanak iki nüsha olarak düzenlenmiş olup bir nüshası personele teslim edilmiştir.</div>
      </div>
    </>
  );
}
