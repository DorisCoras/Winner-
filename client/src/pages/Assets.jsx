import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Download, History, Package, PackageCheck, Pencil, Plus, Printer, Trash2, Undo2, UserPlus, Warehouse } from 'lucide-react';
import { api, qs, useApi } from '../api.js';
import { useLookups } from '../lookups.jsx';
import { downloadCsv } from '../csv.js';
import EmployeeSelect from '../components/EmployeeSelect.jsx';
import {
  Alert,
  Badge,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  KeyValue,
  Loading,
  Modal,
  PageHeader,
  SearchInput,
  StatCard,
  useConfirm,
  useForm,
  useToast,
} from '../components/ui.jsx';
import { formatDate, formatMoney, formatMoneyCompact, formatNumber, todayStr } from '../format.js';

const STATUS_TONE = { zimmetli: 'blue', depoda: 'green', arizali: 'amber', hurda: '' };

function AssetStatusBadge({ status }) {
  const { assetStatuses } = useLookups();
  return <Badge tone={STATUS_TONE[status] ?? ''}>{assetStatuses?.[status] ?? status}</Badge>;
}

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function AssetSummary({ asset }) {
  return (
    <div className="card" style={{ padding: '10px 14px', marginBottom: 16, background: 'var(--surface-2)' }}>
      <div className="strong">{asset.name}</div>
      <div className="small muted">
        {asset.category}
        {asset.serial_no ? ` · ${asset.serial_no}` : ''}
        {asset.value != null ? ` · ${formatMoney(asset.value)}` : ''}
      </div>
    </div>
  );
}

export default function Assets() {
  const { assetCategories, assetStatuses } = useLookups();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const q = useDebounced(search.trim());
  const filtered = !!(q || category || status);

  const all = useApi('/assets');
  const list = useApi(filtered ? `/assets${qs({ q, category, status })}` : null);
  const { reload: reloadAll } = all;
  const { reload: reloadList } = list;

  // Filtre değişirken yeni sonuç gelene kadar önceki satırları göster.
  const current = filtered ? list.data : all.data;
  const lastRows = useRef(null);
  if (current) lastRows.current = current;
  const rows = current ?? lastRows.current;

  const [modal, setModal] = useState(null); // { type: 'create'|'edit'|'assign'|'return'|'history', asset? }
  const closeModal = useCallback(() => setModal(null), []);
  const reload = useCallback(() => {
    reloadAll();
    reloadList();
  }, [reloadAll, reloadList]);

  const stats = useMemo(() => {
    const assets = all.data ?? [];
    const count = (s) => assets.filter((a) => a.status === s).length;
    return {
      total: assets.length,
      totalValue: assets.reduce((sum, a) => sum + (Number(a.value) || 0), 0),
      assigned: count('zimmetli'),
      holders: new Set(assets.filter((a) => a.employee_id).map((a) => a.employee_id)).size,
      inStock: count('depoda'),
      broken: count('arizali'),
      scrapped: count('hurda'),
    };
  }, [all.data]);

  if (!all.data && all.loading) return <Loading />;
  if (!all.data) return <ErrorState error={all.error} onRetry={reloadAll} />;

  const remove = async (asset) => {
    const ok = await confirm({
      title: 'Demirbaşı sil',
      message: `“${asset.name}”${asset.serial_no ? ` (${asset.serial_no})` : ''} kaydı ve zimmet geçmişi kalıcı olarak silinecek.`,
      confirmText: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/assets/${asset.id}`);
      toast.success('Demirbaş silindi.');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `zimmet-listesi-${todayStr()}.csv`,
      [
        { header: 'Kategori', value: (a) => a.category },
        { header: 'Demirbaş / Model', value: (a) => a.name },
        { header: 'Seri No / Plaka', value: (a) => a.serial_no },
        { header: 'Durum', value: (a) => assetStatuses?.[a.status] ?? a.status },
        { header: 'Zimmetli Personel', value: (a) => a.employee_name },
        { header: 'Sicil No', value: (a) => a.sicil_no },
        { header: 'Şirket', value: (a) => a.company_name },
        { header: 'Zimmet Tarihi', value: (a) => (a.assigned_at ? formatDate(a.assigned_at) : '') },
        { header: 'Değer (TL)', value: (a) => (a.value == null ? '' : Number(a.value)) },
        { header: 'Notlar', value: (a) => a.notes },
      ],
      rows ?? [],
    );
  };

  const columns = [
    { key: 'category', header: 'Kategori' },
    {
      key: 'name',
      header: 'Ad / Model',
      render: (a) => (
        <div style={{ minWidth: 150 }}>
          <div className="strong">{a.name}</div>
          {a.notes && (
            <div className="small muted truncate" style={{ maxWidth: 260 }} title={a.notes}>
              {a.notes}
            </div>
          )}
        </div>
      ),
    },
    { key: 'serial_no', header: 'Seri No / Plaka', render: (a) => (a.serial_no ? <span className="mono">{a.serial_no}</span> : '—') },
    { key: 'status', header: 'Durum', render: (a) => <AssetStatusBadge status={a.status} /> },
    {
      key: 'employee_name',
      header: 'Zimmetli Personel',
      render: (a) =>
        a.employee_id ? (
          <div className="nowrap">
            <Link to={`/personel/${a.employee_id}`}>{a.employee_name}</Link>
            <div className="small muted">Zimmet: {formatDate(a.assigned_at)}</div>
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
    { key: 'value', header: 'Değer', align: 'right', render: (a) => formatMoney(a.value) },
    {
      key: '_actions',
      header: '',
      render: (a) => (
        <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
          {a.status === 'depoda' && (
            <button className="btn btn-sm" onClick={() => setModal({ type: 'assign', asset: a })}>
              <UserPlus size={14} /> Zimmetle
            </button>
          )}
          {a.status === 'zimmetli' && (
            <>
              <button className="btn btn-sm" onClick={() => setModal({ type: 'return', asset: a })}>
                <Undo2 size={14} /> İade Al
              </button>
              <Link
                className="btn btn-ghost btn-icon btn-sm"
                to={`/yazdir/zimmet/${a.assignment_id}`}
                aria-label={`${a.name} zimmet tutanağı`}
                title="Zimmet tutanağı"
              >
                <Printer size={15} />
              </Link>
            </>
          )}
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setModal({ type: 'edit', asset: a })}
            aria-label={`${a.name} düzenle`}
            title="Düzenle"
          >
            <Pencil size={15} />
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setModal({ type: 'history', asset: a })}
            aria-label={`${a.name} zimmet geçmişi`}
            title="Geçmiş"
          >
            <History size={15} />
          </button>
          {a.status !== 'zimmetli' && (
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(a)} aria-label={`${a.name} sil`} title="Sil">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Zimmet Yönetimi"
        subtitle="Demirbaşları kaydedin, personele zimmetleyin ve iadelerini takip edin."
        actions={
          <>
            <button className="btn" onClick={exportCsv} disabled={!rows?.length}>
              <Download size={16} /> CSV İndir
            </button>
            <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
              <Plus size={16} /> Yeni Demirbaş
            </button>
          </>
        }
      />

      <div className="grid grid-4 mb-2">
        <StatCard icon={Package} label="Toplam demirbaş" value={formatNumber(stats.total)} sub={`Toplam değer ${formatMoneyCompact(stats.totalValue)}`} />
        <StatCard icon={PackageCheck} tone="teal" label="Zimmetli" value={formatNumber(stats.assigned)} sub={`${stats.holders} personelde`} />
        <StatCard icon={Warehouse} tone="green" label="Depoda" value={formatNumber(stats.inStock)} sub="Zimmetlenmeye hazır" />
        <StatCard
          icon={AlertTriangle}
          tone="amber"
          label="Arızalı / hurda"
          value={formatNumber(stats.broken + stats.scrapped)}
          sub={`${stats.broken} arızalı · ${stats.scrapped} hurda`}
        />
      </div>

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Ad, seri no veya personel ara…" />
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Kategori">
          <option value="">Tüm kategoriler</option>
          {(assetCategories ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Durum">
          <option value="">Tüm durumlar</option>
          {Object.entries(assetStatuses ?? {}).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSearch('');
              setCategory('');
              setStatus('');
            }}
          >
            Filtreleri temizle
          </button>
        )}
        {filtered && list.loading && <span className="spinner" role="status" aria-label="Yükleniyor" />}
      </div>

      {filtered && list.error && <ErrorState error={list.error} onRetry={reloadList} />}

      <div className="card">
        {!rows ? (
          <Loading />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            compact
            empty={
              filtered ? (
                <EmptyState title="Filtreyle eşleşen demirbaş bulunamadı" />
              ) : (
                <EmptyState title="Henüz demirbaş kaydı yok" icon={Package}>
                  “Yeni Demirbaş” ile ilk kaydı oluşturun.
                </EmptyState>
              )
            }
          />
        )}
      </div>
      {rows && rows.length > 0 && (
        <p className="small muted mt-1">
          {rows.length} kayıt · Toplam değer {formatMoney(rows.reduce((s, a) => s + (Number(a.value) || 0), 0))}
        </p>
      )}

      {(modal?.type === 'create' || modal?.type === 'edit') && (
        <AssetFormModal
          key={modal.asset?.id ?? 'new'}
          asset={modal.asset}
          onClose={closeModal}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal?.type === 'assign' && <AssignModal key={modal.asset.id} asset={modal.asset} onClose={closeModal} onDone={reload} />}
      {modal?.type === 'return' && (
        <ReturnModal
          key={modal.asset.id}
          asset={modal.asset}
          onClose={closeModal}
          onDone={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal?.type === 'history' && <HistoryModal key={modal.asset.id} asset={modal.asset} onClose={closeModal} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Modallar
// ---------------------------------------------------------------------------

function AssetFormModal({ asset, onClose, onSaved }) {
  const { assetCategories, assetStatuses } = useLookups();
  const toast = useToast();
  const isEdit = !!asset?.id;
  const assigned = asset?.status === 'zimmetli';
  const f = useForm({
    category: asset?.category ?? '',
    name: asset?.name ?? '',
    serial_no: asset?.serial_no ?? '',
    value: asset?.value ?? '',
    notes: asset?.notes ?? '',
    status: asset?.status ?? 'depoda',
  });

  const save = (e) => {
    e?.preventDefault();
    return f.submit(async (v) => {
      // Boş değer gönderilmez: sunucu null/'' değerini 0'a çeviriyor, eksik alan ise null kaydediliyor.
      const body = { ...v, value: v.value === '' || v.value == null ? undefined : v.value };
      if (assigned) delete body.status;
      if (isEdit) await api.put(`/assets/${asset.id}`, body);
      else await api.post('/assets', body);
      toast.success(isEdit ? 'Demirbaş güncellendi.' : 'Demirbaş eklendi.');
      onSaved();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Demirbaşı Düzenle' : 'Yeni Demirbaş'}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn btn-primary" type="submit" form="asset-form" disabled={f.submitting}>
            {f.submitting ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </>
      }
    >
      <form id="asset-form" onSubmit={save} noValidate>
        {f.formError && (
          <div className="mb-2">
            <Alert tone="error">{f.formError}</Alert>
          </div>
        )}
        <div className="form-grid">
          <Field label="Kategori" required error={f.errors.category} htmlFor="f-category">
            <select className="select" {...f.bind('category')}>
              <option value="">Kategori seçiniz…</option>
              {(assetCategories ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Durum"
            error={f.errors.status}
            htmlFor="f-status"
            hint={assigned ? 'Zimmetli demirbaşın durumu yalnızca iade ile değişir.' : undefined}
          >
            {assigned ? (
              <select id="f-status" className="select" value="zimmetli" disabled>
                <option value="zimmetli">{assetStatuses?.zimmetli ?? 'Zimmetli'}</option>
              </select>
            ) : (
              <select className="select" {...f.bind('status')}>
                {['depoda', 'arizali', 'hurda'].map((s) => (
                  <option key={s} value={s}>
                    {assetStatuses?.[s] ?? s}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Demirbaş adı / model" required error={f.errors.name} htmlFor="f-name" className="full">
            <input className="input" {...f.bind('name')} maxLength={150} placeholder="ör. Dell Latitude 5440" />
          </Field>
          <Field label="Seri no / plaka" error={f.errors.serial_no} htmlFor="f-serial_no">
            <input className="input" {...f.bind('serial_no')} maxLength={100} autoComplete="off" />
          </Field>
          <Field label="Değer (₺)" error={f.errors.value} htmlFor="f-value">
            <input className="input" type="number" min={0} step="0.01" {...f.bind('value')} />
          </Field>
          <Field label="Notlar" error={f.errors.notes} htmlFor="f-notes" className="full">
            <textarea className="textarea" rows={3} {...f.bind('notes')} maxLength={1000} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function AssignModal({ asset, onClose, onDone }) {
  const toast = useToast();
  const [result, setResult] = useState(null);
  const f = useForm({ employee_id: '', assigned_at: todayStr(), notes: '' });

  const save = (e) => {
    e?.preventDefault();
    return f.submit(async (v) => {
      const res = await api.post(`/assets/${asset.id}/assign`, v);
      toast.success(`${asset.name}, ${res.employee_name} adına zimmetlendi.`);
      setResult(res);
      onDone();
    });
  };

  if (result) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Zimmet kaydedildi"
        footer={
          <>
            <button className="btn" onClick={onClose}>
              Kapat
            </button>
            <Link className="btn btn-primary" to={`/yazdir/zimmet/${result.id}`}>
              <Printer size={16} /> Zimmet tutanağını yazdır
            </Link>
          </>
        }
      >
        <Alert tone="success" title="Zimmet işlemi tamamlandı">
          <strong>{result.asset_name}</strong>
          {result.serial_no ? ` (${result.serial_no})` : ''}, {formatDate(result.assigned_at)} tarihinde <strong>{result.employee_name}</strong>{' '}
          adına zimmetlendi. Teslim sırasında imzalatmak için zimmet tutanağını yazdırabilirsiniz.
        </Alert>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Zimmetle"
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn btn-primary" type="submit" form="assign-form" disabled={f.submitting}>
            {f.submitting ? 'Kaydediliyor…' : 'Zimmetle'}
          </button>
        </>
      }
    >
      <AssetSummary asset={asset} />
      <form id="assign-form" onSubmit={save} noValidate>
        {f.formError && (
          <div className="mb-2">
            <Alert tone="error">{f.formError}</Alert>
          </div>
        )}
        <div className="form-grid">
          <Field label="Personel" required error={f.errors.employee_id} htmlFor="f-employee_id" className="full">
            <EmployeeSelect
              id="f-employee_id"
              value={f.values.employee_id}
              onChange={(id) => f.set('employee_id', id)}
              invalid={!!f.errors.employee_id}
            />
          </Field>
          <Field label="Zimmet tarihi" required error={f.errors.assigned_at} htmlFor="f-assigned_at">
            <input className="input" type="date" {...f.bind('assigned_at')} />
          </Field>
          <Field label="Açıklama" error={f.errors.notes} htmlFor="f-notes" className="full">
            <textarea
              className="textarea"
              rows={3}
              {...f.bind('notes')}
              maxLength={1000}
              placeholder="ör. Şarj adaptörü ve çanta ile birlikte teslim edildi."
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function ReturnModal({ asset, onClose, onDone }) {
  const toast = useToast();
  const f = useForm({ returned_at: todayStr(), status: 'depoda', return_notes: '' });

  const save = (e) => {
    e?.preventDefault();
    return f.submit(async (v) => {
      await api.post(`/assets/${asset.id}/return`, v);
      toast.success(`${asset.name} iade alındı.`);
      onDone();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="İade Al"
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn btn-primary" type="submit" form="return-form" disabled={f.submitting}>
            {f.submitting ? 'Kaydediliyor…' : 'İade Al'}
          </button>
        </>
      }
    >
      <AssetSummary asset={asset} />
      <div className="mb-2">
        <KeyValue
          items={[
            ['Zimmetli personel', asset.employee_name],
            ['Zimmet tarihi', formatDate(asset.assigned_at)],
          ]}
        />
      </div>
      <form id="return-form" onSubmit={save} noValidate>
        {f.formError && (
          <div className="mb-2">
            <Alert tone="error">{f.formError}</Alert>
          </div>
        )}
        <div className="form-grid">
          <Field label="İade tarihi" required error={f.errors.returned_at} htmlFor="f-returned_at">
            <input className="input" type="date" min={asset.assigned_at ?? undefined} {...f.bind('returned_at')} />
          </Field>
          <Field label="İade durumu" error={f.errors.status} htmlFor="f-status">
            <select className="select" {...f.bind('status')}>
              <option value="depoda">Sağlam – depoya</option>
              <option value="arizali">Arızalı</option>
              <option value="hurda">Hurda</option>
            </select>
          </Field>
          <Field label="İade açıklaması" error={f.errors.return_notes} htmlFor="f-return_notes" className="full">
            <textarea
              className="textarea"
              rows={3}
              {...f.bind('return_notes')}
              maxLength={1000}
              placeholder="ör. Ekranda çizik var, şarj adaptörü eksik."
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ asset, onClose }) {
  const { data, loading, error, reload } = useApi(`/assets/${asset.id}`);
  const history = data?.history ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title="Zimmet Geçmişi"
      size="lg"
      footer={
        <button className="btn" onClick={onClose}>
          Kapat
        </button>
      }
    >
      <AssetSummary asset={data ?? asset} />
      {!data && loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : history.length === 0 ? (
        <EmptyState title="Bu demirbaş henüz kimseye zimmetlenmedi" icon={History} />
      ) : (
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>Personel</th>
                <th>Zimmet</th>
                <th>İade</th>
                <th>Açıklama</th>
                <th aria-label="Tutanak" />
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>
                    <Link to={`/personel/${h.employee_id}`} className="nowrap">
                      {h.employee_name}
                    </Link>
                    <div className="small muted">{h.sicil_no}</div>
                  </td>
                  <td className="nowrap">{formatDate(h.assigned_at)}</td>
                  <td className="nowrap">{h.returned_at ? formatDate(h.returned_at) : <Badge tone="blue">Zimmette</Badge>}</td>
                  <td className="small" style={{ minWidth: 160 }}>
                    {h.notes && <div>{h.notes}</div>}
                    {h.return_notes && (
                      <div>
                        <span className="muted">İade: </span>
                        {h.return_notes}
                      </div>
                    )}
                    {!h.notes && !h.return_notes && <span className="muted">—</span>}
                  </td>
                  <td className="right">
                    <Link
                      className="btn btn-ghost btn-icon btn-sm"
                      to={`/yazdir/zimmet/${h.id}`}
                      aria-label={`${h.employee_name} zimmet tutanağı`}
                      title="Zimmet tutanağı"
                    >
                      <Printer size={15} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
