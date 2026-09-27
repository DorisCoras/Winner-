import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Banknote,
  CheckCircle2,
  Download,
  FileText,
  Landmark,
  Pencil,
  Receipt,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Stamp,
  Trash2,
  Wallet,
} from 'lucide-react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { downloadCsv } from '../csv.js';
import { formatDateTime, formatMoney, formatNumber, periodLabel } from '../format.js';
import {
  Alert,
  Badge,
  Card,
  DataTable,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  PersonCell,
  StatCard,
  useConfirm,
  useForm,
  useToast,
} from '../components/ui.jsx';
import './Payroll.css';

function RunStatusBadge({ status }) {
  return status === 'onaylandi' ? <Badge tone="green">Onaylandı</Badge> : <Badge tone="amber">Taslak</Badge>;
}

const SUM_KEYS = [
  'base_gross',
  'extra_gross',
  'gross',
  'sgk_employee',
  'unemployment_employee',
  'income_tax_base',
  'income_tax_gross',
  'income_tax_exemption',
  'income_tax',
  'stamp_tax',
  'deductions',
  'net',
  'sgk_employer',
  'unemployment_employer',
  'employer_cost',
];

/** Dosya adı için Türkçe karakterleri sadeleştirir. */
function slug(text) {
  const map = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u' };
  return String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıiöşü]/g, (ch) => map[ch])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function PayrollRunDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const { data: run, loading, error, reload } = useApi(`/payroll/runs/${id}`);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => run?.items ?? [], [run]);
  const totals = useMemo(() => {
    const t = Object.fromEntries(SUM_KEYS.map((k) => [k, 0]));
    for (const it of items) for (const k of SUM_KEYS) t[k] += it[k] ?? 0;
    return t;
  }, [items]);

  if (error && !run) {
    return (
      <>
        <PageHeader back={{ to: '/bordro', label: 'Bordro Dönemleri' }} title="Bordro Detayı" />
        <ErrorState error={error} onRetry={error.status === 404 ? undefined : reload} />
      </>
    );
  }
  if (loading && !run) return <Loading />;
  if (!run) return null;

  const isDraft = run.status === 'taslak';
  const period = periodLabel(run.year, run.month);
  const fileBase = `${run.year}-${String(run.month).padStart(2, '0')}-${slug(run.company_name)}`;

  const act = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const recalculate = async () => {
    const ok = await confirm({
      title: 'Bordro yeniden hesaplansın mı?',
      message:
        'Tüm satırlar personelin güncel maaşı, işe giriş/çıkış tarihleri ve onaylı ücretsiz izinlerine göre yeniden hesaplanır. Girilen ek ödeme, kesinti ve notlar korunur; elle değiştirilen gün sayıları yeniden hesaplanır.',
      confirmText: 'Yeniden Hesapla',
    });
    if (!ok) return;
    await act(async () => {
      await api.post(`/payroll/runs/${run.id}/recalculate`);
      reload();
    }, 'Bordro yeniden hesaplandı.');
  };

  const approve = async () => {
    const ok = await confirm({
      title: `${period} bordrosu onaylansın mı?`,
      message:
        'Onaylanan bordro kilitlenir ve artık düzenlenemez. Bordro pusulaları çalışanların “Bordrolarım” sayfasında görüntülenebilir hale gelir.',
      confirmText: 'Onayla',
    });
    if (!ok) return;
    await act(async () => {
      await api.post(`/payroll/runs/${run.id}/approve`);
      reload();
    }, 'Bordro onaylandı.');
  };

  const reopen = async () => {
    const ok = await confirm({
      title: 'Onay geri alınsın mı?',
      message:
        'Bordro taslak durumuna döner ve yeniden düzenlenebilir. Tekrar onaylanana kadar bordro pusulaları çalışanlara görünmez.',
      confirmText: 'Onayı Geri Al',
      danger: true,
    });
    if (!ok) return;
    await act(async () => {
      await api.post(`/payroll/runs/${run.id}/reopen`);
      reload();
    }, 'Bordro taslak durumuna alındı.');
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Bordro silinsin mi?',
      message: `${run.company_name} — ${period} taslak bordrosu ve tüm satırları kalıcı olarak silinecek.`,
      confirmText: 'Sil',
      danger: true,
    });
    if (!ok) return;
    await act(async () => {
      await api.del(`/payroll/runs/${run.id}`);
      navigate('/bordro', { replace: true });
    }, 'Bordro silindi.');
  };

  const exportExcel = () => {
    downloadCsv(
      `bordro-${fileBase}.csv`,
      [
        { header: 'Sicil No', value: (r) => r.sicil_no },
        { header: 'Ad Soyad', value: (r) => r.employee_name },
        { header: 'T.C. Kimlik No', value: (r) => r.tc_kimlik },
        { header: 'Departman', value: (r) => r.department_name },
        { header: 'Pozisyon', value: (r) => r.position },
        { header: 'Prim Günü', value: (r) => r.days },
        { header: 'Aylık Brüt', value: (r) => r.base_gross },
        { header: 'Ek Ödeme (Brüt)', value: (r) => r.extra_gross },
        { header: 'Toplam Brüt', value: (r) => r.gross },
        { header: 'SGK Matrahı', value: (r) => r.sgk_base },
        { header: 'SGK İşçi Payı', value: (r) => r.sgk_employee },
        { header: 'İşsizlik İşçi Payı', value: (r) => r.unemployment_employee },
        { header: 'GV Matrahı', value: (r) => r.income_tax_base },
        { header: 'Kümülatif GV Matrahı', value: (r) => r.cumulative_base_before + r.income_tax_base },
        { header: 'Hesaplanan GV', value: (r) => r.income_tax_gross },
        { header: 'GV İstisnası', value: (r) => r.income_tax_exemption },
        { header: 'Ödenecek GV', value: (r) => r.income_tax },
        { header: 'Hesaplanan Damga V.', value: (r) => r.stamp_tax_gross },
        { header: 'Damga V. İstisnası', value: (r) => r.stamp_tax_exemption },
        { header: 'Ödenecek Damga V.', value: (r) => r.stamp_tax },
        { header: 'Net Kesinti', value: (r) => r.deductions },
        { header: 'Net Ödenecek', value: (r) => r.net },
        { header: 'SGK İşveren Payı', value: (r) => r.sgk_employer },
        { header: 'İşsizlik İşveren Payı', value: (r) => r.unemployment_employer },
        { header: 'İşveren Maliyeti', value: (r) => r.employer_cost },
        { header: 'Not', value: (r) => r.note },
      ],
      items,
    );
  };

  const exportBank = () => {
    const missing = items.filter((r) => !r.iban).length;
    downloadCsv(
      `banka-odeme-${fileBase}.csv`,
      [
        { header: 'Ad Soyad', value: (r) => r.employee_name },
        { header: 'IBAN', value: (r) => (r.iban ?? '').replace(/\s+/g, '') },
        { header: 'Net Tutar', value: (r) => r.net },
        { header: 'Açıklama', value: () => `${period} maaş ödemesi` },
      ],
      items.filter((r) => r.net > 0),
    );
    if (missing) toast.info(`${missing} personelin IBAN bilgisi eksik; listeyi bankaya göndermeden önce tamamlayın.`);
    else if (isDraft) toast.info('Bordro henüz onaylanmadı; tutarlar değişebilir.');
  };

  const columns = [
    { key: 'sicil_no', header: 'Sicil', className: 'nowrap' },
    {
      key: 'employee_name',
      header: 'Personel',
      render: (r) => (
        <PersonCell
          size="sm"
          name={r.employee_name}
          to={`/personel/${r.employee_id}`}
          sub={[r.position, r.note && `Not: ${r.note}`].filter(Boolean).join(' · ')}
        />
      ),
    },
    { key: 'days', header: 'Gün', align: 'right' },
    {
      key: 'gross',
      header: 'Brüt',
      align: 'right',
      render: (r) => (
        <>
          {formatMoney(r.gross)}
          {r.extra_gross > 0 && <span className="cell-sub">Ek ödeme: {formatMoney(r.extra_gross)}</span>}
        </>
      ),
    },
    {
      key: 'sgk',
      header: 'SGK + İşsizlik',
      align: 'right',
      sortValue: (r) => r.sgk_employee + r.unemployment_employee,
      render: (r) => formatMoney(r.sgk_employee + r.unemployment_employee),
    },
    { key: 'income_tax_base', header: 'GV Matrahı', align: 'right', render: (r) => formatMoney(r.income_tax_base) },
    {
      key: 'income_tax',
      header: 'Gelir Vergisi',
      align: 'right',
      render: (r) => (
        <>
          {formatMoney(r.income_tax)}
          {r.income_tax_exemption > 0 && <span className="cell-sub">İstisna: {formatMoney(r.income_tax_exemption)}</span>}
        </>
      ),
    },
    { key: 'stamp_tax', header: 'Damga', align: 'right', render: (r) => formatMoney(r.stamp_tax) },
    {
      key: 'deductions',
      header: 'Kesinti',
      align: 'right',
      render: (r) => (r.deductions > 0 ? formatMoney(r.deductions) : <span className="muted">—</span>),
    },
    { key: 'net', header: 'Net', align: 'right', render: (r) => <span className="strong">{formatMoney(r.net)}</span> },
    { key: 'employer_cost', header: 'İşveren Maliyeti', align: 'right', render: (r) => formatMoney(r.employer_cost) },
    {
      key: '_actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }} onClick={(e) => e.stopPropagation()}>
          <Link className="btn btn-ghost btn-icon btn-sm" to={`/bordro-pusulasi/${r.id}`} aria-label={`${r.employee_name} bordro pusulası`} title="Bordro pusulası">
            <FileText size={15} />
          </Link>
          {isDraft && (
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditing(r)} aria-label={`${r.employee_name} satırını düzenle`} title="Düzenle">
              <Pencil size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const footer = (
    <tr>
      <td colSpan={2}>Toplam ({formatNumber(items.length)} personel)</td>
      <td className="num">{formatNumber(items.reduce((s, r) => s + r.days, 0))}</td>
      <td className="num">{formatMoney(totals.gross)}</td>
      <td className="num">{formatMoney(totals.sgk_employee + totals.unemployment_employee)}</td>
      <td className="num">{formatMoney(totals.income_tax_base)}</td>
      <td className="num">{formatMoney(totals.income_tax)}</td>
      <td className="num">{formatMoney(totals.stamp_tax)}</td>
      <td className="num">{formatMoney(totals.deductions)}</td>
      <td className="num">{formatMoney(totals.net)}</td>
      <td className="num">{formatMoney(totals.employer_cost)}</td>
      <td />
    </tr>
  );

  return (
    <>
      <PageHeader
        back={{ to: '/bordro', label: 'Bordro Dönemleri' }}
        title={`${period} Bordrosu`}
        subtitle={
          <span className="row wrap">
            <RunStatusBadge status={run.status} />
            <span>
              {run.company_name} · {formatNumber(run.employee_count)} personel
              {run.approved_at && ` · Onay: ${formatDateTime(run.approved_at)}`}
            </span>
          </span>
        }
        actions={
          <>
            <button className="btn" onClick={exportExcel} disabled={!items.length}>
              <Download size={16} /> Excel'e Aktar
            </button>
            <button className="btn" onClick={exportBank} disabled={!items.length}>
              <Landmark size={16} /> Banka Ödeme Listesi
            </button>
            {isDraft && (
              <>
                <button className="btn" onClick={recalculate} disabled={busy}>
                  <RefreshCw size={16} /> Yeniden Hesapla
                </button>
                <button className="btn btn-danger" onClick={remove} disabled={busy}>
                  <Trash2 size={16} /> Sil
                </button>
                <button className="btn btn-success" onClick={approve} disabled={busy || !items.length}>
                  <CheckCircle2 size={16} /> Onayla
                </button>
              </>
            )}
            {!isDraft && isAdmin && (
              <button className="btn" onClick={reopen} disabled={busy}>
                <RotateCcw size={16} /> Onayı Geri Al
              </button>
            )}
          </>
        }
      />

      <div className="stack">
        {run.warnings?.map((w) => (
          <Alert key={w} tone="warning">
            {w}
          </Alert>
        ))}
        {isDraft ? (
          <Alert tone="info">
            Bu bordro taslak durumunda. Satırlardaki gün, ek ödeme ve kesintileri düzenleyebilir, kontrol sonrası onaylayabilirsiniz.
            Bordro pusulaları onaydan sonra çalışanlara görünür.
          </Alert>
        ) : null}

        <div className="grid grid-3">
          <StatCard icon={Banknote} label="Toplam brüt" value={formatMoney(totals.gross)} sub={totals.extra_gross > 0 ? `Ek ödemeler: ${formatMoney(totals.extra_gross)}` : undefined} />
          <StatCard icon={ShieldCheck} tone="teal" label="SGK + işsizlik (işçi)" value={formatMoney(totals.sgk_employee + totals.unemployment_employee)} />
          <StatCard
            icon={Receipt}
            tone="amber"
            label="Gelir vergisi"
            value={formatMoney(totals.income_tax)}
            sub={totals.income_tax_exemption > 0 ? `Asgari ücret istisnası: ${formatMoney(totals.income_tax_exemption)}` : undefined}
          />
          <StatCard icon={Stamp} tone="amber" label="Damga vergisi" value={formatMoney(totals.stamp_tax)} />
          <StatCard
            icon={Wallet}
            tone="green"
            label="Net ödenecek"
            value={formatMoney(totals.net)}
            sub={totals.deductions > 0 ? `Kesintiler sonrası (${formatMoney(totals.deductions)} kesinti)` : undefined}
          />
          <StatCard icon={Landmark} label="İşveren maliyeti" value={formatMoney(totals.employer_cost)} sub="Brüt + işveren SGK ve işsizlik payı" />
        </div>

        <Card title="Bordro satırları" hint="Satıra tıklayarak personelin bordro pusulasını açabilirsiniz." flush>
          <DataTable
            compact
            columns={columns}
            rows={items}
            pageSize={200}
            footer={items.length ? footer : null}
            onRowClick={(r) => navigate(`/bordro-pusulasi/${r.id}`)}
          />
        </Card>
      </div>

      {editing && (
        <EditItemModal
          runId={run.id}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function EditItemModal({ runId, item, onClose, onSaved }) {
  const toast = useToast();
  const f = useForm({
    days: String(item.days),
    extra_gross: String(item.extra_gross ?? 0),
    deductions: String(item.deductions ?? 0),
    note: item.note ?? '',
  });

  const save = (e) => {
    e.preventDefault();
    const days = Number(f.values.days);
    const extra = f.values.extra_gross === '' ? 0 : Number(f.values.extra_gross);
    const deductions = f.values.deductions === '' ? 0 : Number(f.values.deductions);
    const errors = {};
    if (f.values.days === '' || !Number.isInteger(days) || days < 0 || days > 30) errors.days = 'Prim günü 0 ile 30 arasında tam sayı olmalı.';
    if (!Number.isFinite(extra) || extra < 0) errors.extra_gross = 'Ek ödeme negatif olamaz.';
    if (!Number.isFinite(deductions) || deductions < 0) errors.deductions = 'Kesinti negatif olamaz.';
    if (Object.keys(errors).length) {
      f.setErrors(errors);
      return;
    }
    f.submit(async (v) => {
      await api.put(`/payroll/runs/${runId}/items/${item.id}`, { days, extra_gross: extra, deductions, note: v.note });
      toast.success(`${item.employee_name} bordro satırı güncellendi.`);
      onSaved();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${item.employee_name} — Bordro Satırı`}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" form="edit-item-form" className="btn btn-primary" disabled={f.submitting}>
            {f.submitting ? 'Kaydediliyor…' : 'Kaydet ve Hesapla'}
          </button>
        </>
      }
    >
      <form id="edit-item-form" onSubmit={save} className="stack">
        {f.formError && <Alert tone="error">{f.formError}</Alert>}
        <div className="form-grid">
          <Field label="Prim günü" required error={f.errors.days} hint="0–30 arası. Aylık brüt ücret gün oranında hesaplanır." htmlFor="f-days">
            <input className="input" type="number" min="0" max="30" step="1" inputMode="numeric" {...f.bind('days')} />
          </Field>
          <Field
            label="Ek ödeme (brüt)"
            error={f.errors.extra_gross}
            hint="Prim, ikramiye, fazla mesai vb. brüt tutar."
            htmlFor="f-extra_gross"
          >
            <input className="input" type="number" min="0" step="0.01" inputMode="decimal" {...f.bind('extra_gross')} />
          </Field>
          <Field label="Net kesinti" error={f.errors.deductions} hint="Avans, icra vb. netten düşülecek tutar." htmlFor="f-deductions">
            <input className="input" type="number" min="0" step="0.01" inputMode="decimal" {...f.bind('deductions')} />
          </Field>
          <Field label="Not" error={f.errors.note} htmlFor="f-note" className="full">
            <textarea className="textarea" rows={2} maxLength={300} placeholder="Ör. Eylül satış primi" {...f.bind('note')} />
          </Field>
        </div>
        <div className="small muted">
          Mevcut değerler: {item.days} gün · brüt {formatMoney(item.gross)} · net {formatMoney(item.net)}. Kaydettiğinizde vergi ve
          SGK kesintileri yeniden hesaplanır.
        </div>
      </form>
    </Modal>
  );
}
