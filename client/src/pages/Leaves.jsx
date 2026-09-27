import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Award,
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  Check,
  CheckCircle2,
  Download,
  Hourglass,
  Plus,
  X,
} from 'lucide-react';
import { api, qs, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import { downloadCsv } from '../csv.js';
import EmployeeSelect from '../components/EmployeeSelect.jsx';
import {
  Alert,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  KeyValue,
  LeaveStatusBadge,
  Loading,
  Modal,
  PageHeader,
  PersonCell,
  SearchInput,
  StatCard,
  Tabs,
  useConfirm,
  useForm,
  useToast,
} from '../components/ui.jsx';
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDays,
  formatNumber,
  matches,
  relativeDays,
  todayStr,
} from '../format.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_LABELS = { beklemede: 'Onay Bekliyor', onaylandi: 'Onaylandı', reddedildi: 'Reddedildi', iptal: 'İptal Edildi' };
const EMPTY_FILTERS = { status: '', company_id: '', leave_type_id: '', from: '', to: '' };
const TAB_KEYS = ['taleplerim', 'onay', 'tumu'];

/** Menüdeki onay rozeti ve diğer sayfalar bu olayı dinler. */
function notifyLeavesChanged() {
  window.dispatchEvent(new Event('leaves:changed'));
}

// ---------------------------------------------------------------------------
// Tablo hücreleri
// ---------------------------------------------------------------------------

function LeaveTypeName({ row }) {
  return (
    <span className="row nowrap" style={{ gap: 7 }}>
      <i className="dot" style={{ background: row.color }} />
      {row.leave_type_name}
    </span>
  );
}

function LeaveTypeCell({ row }) {
  return (
    <div style={{ minWidth: 0 }}>
      <LeaveTypeName row={row} />
      {row.reason && (
        <div className="muted small truncate" style={{ maxWidth: 240 }} title={row.reason}>
          {row.reason}
        </div>
      )}
    </div>
  );
}

function DecisionCell({ row }) {
  const who = row.decided_by_name ?? row.decided_by_email;
  if (!who && !row.decision_note) return <span className="muted">—</span>;
  return (
    <div className="small" style={{ minWidth: 0 }}>
      {who && <div className="nowrap">{who}</div>}
      {row.decided_at && <div className="muted nowrap">{formatDateTime(row.decided_at)}</div>}
      {row.decision_note && (
        <div className="muted truncate" style={{ maxWidth: 220 }} title={row.decision_note}>
          “{row.decision_note}”
        </div>
      )}
    </div>
  );
}

function LeaveTable({ rows, showPerson, onDecide, onCancel, canCancel, empty, initialSort }) {
  const columns = [
    showPerson && {
      key: 'employee_name',
      header: 'Personel',
      render: (r) => (
        <PersonCell
          name={r.employee_name}
          sub={[r.position, r.company_name].filter(Boolean).join(' · ')}
          to={`/personel/${r.employee_id}`}
          size="sm"
        />
      ),
    },
    { key: 'leave_type_name', header: 'İzin türü', render: (r) => <LeaveTypeCell row={r} /> },
    {
      key: 'start_date',
      header: 'Tarih aralığı',
      render: (r) => (
        <div className="nowrap">
          {formatDateRange(r.start_date, r.end_date)}
          {r.half_day ? <div className="muted small">Yarım gün</div> : null}
        </div>
      ),
    },
    { key: 'days', header: 'Gün', align: 'right', render: (r) => formatDays(r.days) },
    { key: 'status', header: 'Durum', render: (r) => <LeaveStatusBadge status={r.status} /> },
    { key: 'created_at', header: 'Talep tarihi', render: (r) => <span className="nowrap">{formatDateTime(r.created_at)}</span> },
    { key: 'decided_at', header: 'Karar veren / not', render: (r) => <DecisionCell row={r} /> },
    {
      key: '_actions',
      header: '',
      align: 'right',
      render: (r) => {
        const cancellable = canCancel(r);
        if (!r.can_decide && !cancellable) return null;
        return (
          <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
            {r.can_decide && (
              <>
                <button className="btn btn-sm btn-success" onClick={() => onDecide(r, 'approve')}>
                  <Check size={14} /> Onayla
                </button>
                <button className="btn btn-sm" onClick={() => onDecide(r, 'reject')}>
                  <X size={14} /> Reddet
                </button>
              </>
            )}
            {cancellable && (
              <button className="btn btn-sm btn-ghost" onClick={() => onCancel(r)}>
                <Ban size={14} /> İptal
              </button>
            )}
          </div>
        );
      },
    },
  ].filter(Boolean);

  return <DataTable columns={columns} rows={rows} empty={empty} initialSort={initialSort} />;
}

// ---------------------------------------------------------------------------
// Bakiye özeti (Taleplerim)
// ---------------------------------------------------------------------------

function BalanceSummary({ balance: b }) {
  // baseDate (devir tarihi) varsa carryover o tarihteki devreden bakiyedir; yoksa isteğe bağlı ± düzeltmedir.
  const carrySub = b.baseDate
    ? `Devreden bakiye (${formatDate(b.baseDate)}): ${formatDays(b.carryover)}`
    : b.carryover
      ? `Düzeltme: ${b.carryover > 0 ? '+' : ''}${formatDays(b.carryover)}`
      : `${b.serviceYears} yıllık hizmet`;
  return (
    <div className="grid grid-4 mb-2">
      <StatCard
        icon={CalendarCheck}
        tone={b.available < 0 ? 'red' : 'green'}
        label="Kullanılabilir bakiye"
        value={formatDays(b.available)}
        sub={`Toplam bakiye: ${formatDays(b.balance)}`}
      />
      <StatCard icon={Hourglass} tone="amber" label="Onay bekleyen" value={formatDays(b.pending)} sub="Yıllık izin talepleri" />
      <StatCard
        icon={Award}
        label="Hak edilen / kullanılan"
        value={`${formatNumber(b.earned)} / ${formatNumber(b.used)} gün`}
        sub={carrySub}
      />
      <StatCard
        icon={CalendarClock}
        tone="teal"
        label="Sonraki hak ediş"
        value={formatDate(b.next?.date)}
        sub={b.next ? `${formatDays(b.next.days)} · ${relativeDays(b.next.date)}` : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yeni izin talebi
// ---------------------------------------------------------------------------

/** Tarih/tür değiştikçe (300 ms gecikmeyle) sunucudan gün sayısı ve bakiye önizlemesi alır. */
function useLeavePreview({ employeeId, leaveTypeId, start, end, halfDay }) {
  const [state, setState] = useState({ data: null, loading: false, error: null });
  const ready = !!employeeId && !!leaveTypeId && DATE_RE.test(start) && DATE_RE.test(end);

  useEffect(() => {
    if (!ready) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    const timer = setTimeout(() => {
      api('/leaves/preview', {
        method: 'POST',
        signal: ctrl.signal,
        body: {
          employee_id: employeeId,
          leave_type_id: Number(leaveTypeId),
          start_date: start,
          end_date: end,
          half_day: halfDay,
        },
      })
        .then((data) => setState({ data, loading: false, error: null }))
        .catch((error) => {
          if (error.name !== 'AbortError') setState({ data: null, loading: false, error });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [ready, employeeId, leaveTypeId, start, end, halfDay]);

  return { ...state, ready };
}

function PreviewPanel({ preview, type }) {
  if (!preview.ready) {
    return <div className="muted small">Tarihleri seçtiğinizde izin süresi ve kalan bakiye burada hesaplanır.</div>;
  }
  if (preview.error) return <Alert tone="error">{preview.error.message}</Alert>;
  const d = preview.data;
  if (!d) {
    return (
      <div className="row muted small">
        <span className="spinner" /> Hesaplanıyor…
      </div>
    );
  }
  if (d.error) return <Alert tone="warning">{d.error}</Alert>;
  if (d.days <= 0) {
    return <Alert tone="warning">Seçilen tarihler arasında iş günü bulunmuyor (hafta sonu veya resmi tatil).</Alert>;
  }
  const holidays = [...(d.holidays ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const negative = d.balance && d.balance.after < 0;
  const overMax = !!type?.max_days && d.days > type.max_days;

  return (
    <Alert tone={negative || overMax ? 'error' : 'info'} title={`İzin süresi: ${formatDays(d.days)}`}>
      <div className="stack" style={{ gap: 4, marginTop: 2 }}>
        <div className="muted small">Hafta sonları ve resmi tatiller izin süresine dahil edilmez.</div>
        {holidays.length > 0 && (
          <div>
            Aralıktaki resmi tatiller:
            <ul style={{ margin: '2px 0 0', paddingLeft: 18 }}>
              {holidays.map((h) => (
                <li key={h.date}>
                  {formatDate(h.date)} — {h.name}
                  {h.half_day ? ' (yarım gün)' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.balance && (
          <div>
            Kullanılabilir bakiye: <b>{formatDays(d.balance.available)}</b> → talep sonrası:{' '}
            <b className={negative ? 'text-danger' : ''}>{formatDays(d.balance.after)}</b>
          </div>
        )}
        {negative && <div className="text-danger strong">Yıllık izin bakiyesi bu talep için yetersiz.</div>}
        {overMax && (
          <div className="text-danger strong">
            {type.name} için en fazla {formatDays(type.max_days)} talep edilebilir.
          </div>
        )}
        {preview.loading && <div className="muted small">Güncelleniyor…</div>}
      </div>
    </Alert>
  );
}

function NewLeaveModal({ defaultEmployeeId, onClose, onSaved }) {
  const { user, isHR } = useAuth();
  const { leaveTypes = [] } = useLookups();
  const toast = useToast();
  const defaultType = leaveTypes.find((t) => t.code === 'yillik') ?? leaveTypes[0];
  const f = useForm({
    employee_id: defaultEmployeeId ?? '',
    leave_type_id: defaultType ? String(defaultType.id) : '',
    start_date: '',
    end_date: '',
    half_day: false,
    reason: '',
    auto_approve: false,
    force: false,
  });
  const [needsForce, setNeedsForce] = useState(false);
  const v = f.values;
  const { set } = f;

  // Arama değerleri (lookups) modal açıldıktan sonra gelirse varsayılan türü seç.
  useEffect(() => {
    if (!v.leave_type_id && defaultType) set('leave_type_id', String(defaultType.id));
  }, [v.leave_type_id, defaultType, set]);

  const type = leaveTypes.find((t) => t.id === Number(v.leave_type_id));
  const employeeId = isHR ? v.employee_id : user.employee_id;
  const sameDay = !!v.start_date && v.start_date === v.end_date;
  const halfDay = sameDay && !!v.half_day;
  const preview = useLeavePreview({ employeeId, leaveTypeId: v.leave_type_id, start: v.start_date, end: v.end_date, halfDay });

  // Talep bilgileri değişince "bakiye yetersiz" onayı sıfırlanır.
  useEffect(() => {
    setNeedsForce(false);
    set('force', false);
  }, [employeeId, v.leave_type_id, v.start_date, v.end_date, halfDay, set]);

  const showForce = isHR && (needsForce || (preview.data?.balance?.after ?? 0) < 0);

  const onStartChange = (e) => {
    const s = e.target.value;
    set('start_date', s);
    if (s && (!v.end_date || v.end_date < s)) set('end_date', s);
  };

  const typeHint = type
    ? [
        type.deducts_balance ? 'Yıllık izin bakiyesinden düşülür.' : null,
        type.max_days ? `En fazla ${formatDays(type.max_days)}.` : null,
        !type.paid ? 'Ücretsiz izin: bu günler için ücret ödenmez ve SGK prim gününden düşülür.' : null,
      ]
        .filter(Boolean)
        .join(' ')
    : undefined;

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (values) => {
      if (isHR && !values.employee_id) {
        throw Object.assign(new Error('Lütfen form alanlarını kontrol edin.'), { fields: { employee_id: 'Personel seçiniz.' } });
      }
      const body = {
        leave_type_id: values.leave_type_id,
        start_date: values.start_date,
        end_date: values.end_date,
        half_day: halfDay,
        reason: values.reason,
      };
      if (isHR) {
        body.employee_id = values.employee_id;
        body.auto_approve = !!values.auto_approve;
        body.force = showForce && !!values.force;
      }
      let created;
      try {
        created = await api.post('/leaves', body);
      } catch (err) {
        if (isHR && err.data?.code === 'insufficient_balance') setNeedsForce(true);
        throw err;
      }
      const own = created?.employee_id === user.employee_id;
      toast.success(
        created?.status === 'onaylandi'
          ? 'İzin kaydedildi ve onaylandı.'
          : own
            ? 'İzin talebiniz onaya gönderildi.'
            : 'İzin talebi oluşturuldu ve onaya gönderildi.',
      );
      onSaved();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Yeni İzin Talebi"
      footer={
        <>
          <button className="btn" type="button" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn btn-primary" type="submit" form="leave-request-form" disabled={f.submitting}>
            {f.submitting ? 'Kaydediliyor…' : isHR && v.auto_approve ? 'Kaydet ve onayla' : 'Talep oluştur'}
          </button>
        </>
      }
    >
      <form id="leave-request-form" className="form-grid" onSubmit={onSubmit} noValidate>
        {f.formError && (
          <div className="full">
            <Alert tone="error">{f.formError}</Alert>
          </div>
        )}
        {isHR && (
          <Field className="full" label="Personel" required error={f.errors.employee_id} htmlFor="f-employee_id">
            <EmployeeSelect
              id="f-employee_id"
              value={v.employee_id}
              onChange={(id) => set('employee_id', id)}
              invalid={!!f.errors.employee_id}
            />
          </Field>
        )}
        <Field className="full" label="İzin türü" required error={f.errors.leave_type_id} hint={typeHint} htmlFor="f-leave_type_id">
          <select className="select" {...f.bind('leave_type_id')}>
            <option value="">İzin türü seçiniz…</option>
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.paid ? '' : ' (ücretsiz)'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Başlangıç tarihi" required error={f.errors.start_date} htmlFor="f-start_date">
          <input className="input" type="date" {...f.bind('start_date')} onChange={onStartChange} />
        </Field>
        <Field label="Bitiş tarihi" required error={f.errors.end_date} htmlFor="f-end_date">
          <input className="input" type="date" min={v.start_date || undefined} {...f.bind('end_date')} />
        </Field>
        <div className="full">
          <label className="checkbox">
            <input
              type="checkbox"
              id="f-half_day"
              checked={halfDay}
              disabled={!sameDay}
              onChange={(e) => set('half_day', e.target.checked)}
            />
            Yarım gün
          </label>
          {!sameDay && <span className="muted small"> — yalnızca tek günlük taleplerde seçilebilir</span>}
          {f.errors.half_day && <div className="field-error">{f.errors.half_day}</div>}
        </div>
        <div className="full">
          <PreviewPanel preview={preview} type={type} />
        </div>
        <Field className="full" label="Açıklama" error={f.errors.reason} htmlFor="f-reason">
          <textarea className="textarea" rows={3} maxLength={1000} placeholder="İsteğe bağlı" {...f.bind('reason')} />
        </Field>
        {isHR && (
          <div className="full stack" style={{ gap: 8 }}>
            <label className="checkbox">
              <input type="checkbox" {...f.bind('auto_approve', { type: 'checkbox' })} />
              Hemen onayla (onay sürecini atla)
            </label>
            {showForce && (
              <label className="checkbox">
                <input type="checkbox" {...f.bind('force', { type: 'checkbox' })} />
                Bakiye yetersiz olsa da kaydet
              </label>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Onay / ret
// ---------------------------------------------------------------------------

function DecisionModal({ row, action, onClose, onDone }) {
  const toast = useToast();
  const approve = action === 'approve';
  const f = useForm({ note: '' });
  const balance = useApi(approve && row.deducts_balance ? `/leaves/balance/${row.employee_id}` : null);
  const bal = balance.data;
  const remaining = bal ? bal.balance - row.days : null;

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      await api.post(`/leaves/${row.id}/${action}`, { note: v.note });
      toast.success(approve ? 'İzin talebi onaylandı.' : 'İzin talebi reddedildi.');
      onDone();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={approve ? 'İzin talebini onayla' : 'İzin talebini reddet'}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose}>
            Vazgeç
          </button>
          <button
            className={`btn ${approve ? 'btn-success' : 'btn-danger'}`}
            type="submit"
            form="leave-decision-form"
            disabled={f.submitting}
          >
            {approve ? <Check size={16} /> : <X size={16} />}
            {f.submitting ? 'Kaydediliyor…' : approve ? 'Onayla' : 'Reddet'}
          </button>
        </>
      }
    >
      <form id="leave-decision-form" className="stack" style={{ gap: 14 }} onSubmit={onSubmit}>
        {f.formError && <Alert tone="error">{f.formError}</Alert>}
        <KeyValue
          items={[
            ['Personel', row.employee_name],
            ['İzin türü', <LeaveTypeName row={row} />],
            ['Tarih', `${formatDateRange(row.start_date, row.end_date)}${row.half_day ? ' (yarım gün)' : ''}`],
            ['Süre', formatDays(row.days)],
            ['Açıklama', row.reason],
          ]}
        />
        {bal && (
          <Alert tone={remaining < 0 ? 'warning' : 'info'}>
            Personelin yıllık izin bakiyesi: <b>{formatDays(bal.balance)}</b>. Onaylandığında kalan:{' '}
            <b>{formatDays(remaining)}</b>
            {remaining < 0 ? ' — bakiye yetersiz.' : '.'}
          </Alert>
        )}
        <Field
          label="Karar notu"
          hint={approve ? 'İsteğe bağlı.' : 'İsteğe bağlı; ret gerekçesi personel tarafından görülür.'}
          error={f.errors.note}
          htmlFor="f-note"
        >
          <textarea className="textarea" rows={3} maxLength={1000} {...f.bind('note')} />
        </Field>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tüm talepler: filtreler
// ---------------------------------------------------------------------------

function AllFilters({ filters, setFilters, search, setSearch, showCompany }) {
  const { companies, leaveTypes = [], leaveStatuses } = useLookups();
  const statuses = leaveStatuses ?? STATUS_LABELS;
  const update = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const dirty = search || Object.values(filters).some(Boolean);

  return (
    <div className="toolbar">
      <SearchInput value={search} onChange={setSearch} placeholder="Personel adı veya sicil no…" />
      <select className="select" aria-label="Durum" value={filters.status} onChange={update('status')}>
        <option value="">Tüm durumlar</option>
        {Object.entries(statuses).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
      {showCompany && (
        <select className="select" aria-label="Şirket" value={filters.company_id} onChange={update('company_id')}>
          <option value="">Tüm şirketler</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <select className="select" aria-label="İzin türü" value={filters.leave_type_id} onChange={update('leave_type_id')}>
        <option value="">Tüm izin türleri</option>
        {leaveTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input
        className="input"
        type="date"
        aria-label="Başlangıç tarihi (bu tarihten itibaren)"
        title="Bu tarihten itibaren"
        value={filters.from}
        max={filters.to || undefined}
        onChange={update('from')}
      />
      <input
        className="input"
        type="date"
        aria-label="Bitiş tarihi (bu tarihe kadar)"
        title="Bu tarihe kadar"
        value={filters.to}
        min={filters.from || undefined}
        onChange={update('to')}
      />
      {dirty && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setFilters(EMPTY_FILTERS);
            setSearch('');
          }}
        >
          Filtreleri temizle
        </button>
      )}
    </div>
  );
}

function exportLeaves(rows) {
  downloadCsv(
    `izin-talepleri-${todayStr()}.csv`,
    [
      { header: 'Sicil No', value: (r) => r.sicil_no },
      { header: 'Personel', value: (r) => r.employee_name },
      { header: 'Şirket', value: (r) => r.company_name },
      { header: 'Departman', value: (r) => r.department_name },
      { header: 'Pozisyon', value: (r) => r.position },
      { header: 'İzin Türü', value: (r) => r.leave_type_name },
      { header: 'Başlangıç', value: (r) => formatDate(r.start_date) },
      { header: 'Bitiş', value: (r) => formatDate(r.end_date) },
      { header: 'Gün', value: (r) => r.days },
      { header: 'Yarım Gün', value: (r) => (r.half_day ? 'Evet' : 'Hayır') },
      { header: 'Durum', value: (r) => STATUS_LABELS[r.status] ?? r.status },
      { header: 'Açıklama', value: (r) => r.reason },
      { header: 'Talep Tarihi', value: (r) => formatDateTime(r.created_at) },
      { header: 'Karar Veren', value: (r) => r.decided_by_name ?? r.decided_by_email },
      { header: 'Karar Tarihi', value: (r) => (r.decided_at ? formatDateTime(r.decided_at) : '') },
      { header: 'Karar Notu', value: (r) => r.decision_note },
    ],
    rows,
  );
}

// ---------------------------------------------------------------------------
// Sayfa
// ---------------------------------------------------------------------------

export default function Leaves() {
  const { user, isHR, hasRole } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const isApprover = hasRole('admin', 'ik', 'yonetici');
  const hasEmployee = !!user.employee_id;
  const canCreate = hasEmployee || isHR;

  const allowed = TAB_KEYS.filter((k) => (k === 'taleplerim' ? hasEmployee : isApprover));
  const requested = searchParams.get('sekme');

  const approvals = useApi(isApprover ? '/leaves?scope=approvals' : null);

  // Varsayılan sekme bir kez belirlenir: onay bekleyen varsa onlar, yoksa kendi talepleri.
  const [autoTab, setAutoTab] = useState(null);
  const waitingApprovals = isApprover && !approvals.data && !approvals.error;
  const fallbackTab = hasEmployee ? 'taleplerim' : isApprover ? 'tumu' : null;
  useEffect(() => {
    if (autoTab || waitingApprovals || !fallbackTab) return;
    setAutoTab(approvals.data?.length ? 'onay' : fallbackTab);
  }, [autoTab, waitingApprovals, fallbackTab, approvals.data]);
  const tab = allowed.includes(requested) ? requested : autoTab;

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const mine = useApi(tab === 'taleplerim' ? '/leaves?scope=mine' : null);
  const balance = useApi(tab === 'taleplerim' && hasEmployee ? `/leaves/balance/${user.employee_id}` : null);
  const all = useApi(tab === 'tumu' ? `/leaves${qs({ scope: 'all', ...filters })}` : null);

  const [newOpen, setNewOpen] = useState(false);
  const [decision, setDecision] = useState(null);

  // Gösterge panelindeki kısayol: /izinler?yeni=1
  useEffect(() => {
    if (searchParams.get('yeni') !== '1') return;
    if (canCreate) setNewOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('yeni');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, canCreate]);

  const reloadApprovals = approvals.reload;
  const reloadMine = mine.reload;
  const reloadBalance = balance.reload;
  const reloadAll = all.reload;
  const changed = useCallback(() => {
    reloadApprovals();
    reloadMine();
    reloadBalance();
    reloadAll();
    notifyLeavesChanged();
  }, [reloadApprovals, reloadMine, reloadBalance, reloadAll]);

  const closeNew = useCallback(() => setNewOpen(false), []);
  const savedNew = useCallback(() => {
    setNewOpen(false);
    changed();
  }, [changed]);
  const closeDecision = useCallback(() => setDecision(null), []);
  const decided = useCallback(() => {
    setDecision(null);
    changed();
  }, [changed]);

  const changeTab = (key) => {
    const next = new URLSearchParams(searchParams);
    next.set('sekme', key);
    setSearchParams(next, { replace: true });
  };

  const canCancel = (row) =>
    isHR
      ? row.status === 'beklemede' || row.status === 'onaylandi'
      : row.employee_id === user.employee_id && row.status === 'beklemede';

  const cancel = async (row) => {
    const own = row.employee_id === user.employee_id;
    const what = `${row.leave_type_name} (${formatDateRange(row.start_date, row.end_date)}, ${formatDays(row.days)})`;
    const ok = await confirm({
      title: 'İzin talebini iptal et',
      message: (
        <>
          <p>{own ? `${what} talebiniz iptal edilecek.` : `${row.employee_name} adlı personelin ${what} izni iptal edilecek.`}</p>
          {row.status === 'onaylandi' && row.deducts_balance ? (
            <p className="muted small mt-0">Onaylanmış yıllık izin iptal edildiğinde günler bakiyeye geri eklenir.</p>
          ) : null}
          <div>Devam etmek istiyor musunuz?</div>
        </>
      ),
      confirmText: 'İptal et',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.post(`/leaves/${row.id}/cancel`);
      toast.success('İzin talebi iptal edildi.');
      changed();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onDecide = (row, action) => setDecision({ row, action });

  const tableProps = { onDecide, onCancel: cancel, canCancel };

  const tabs = allowed.map((key) =>
    key === 'taleplerim'
      ? { key, label: 'Taleplerim' }
      : key === 'onay'
        ? { key, label: 'Onay Bekleyenler', count: approvals.data ? approvals.data.length : undefined }
        : { key, label: 'Tüm Talepler' },
  );

  const allRows = (all.data ?? []).filter((r) => matches(r.employee_name, search) || matches(r.sicil_no, search));

  let body;
  if (!allowed.length) {
    body = <Alert tone="warning">Hesabınız bir personel kaydına bağlı olmadığı için izin talepleri görüntülenemiyor. Lütfen İK birimiyle iletişime geçin.</Alert>;
  } else if (!tab) {
    body = <Loading />;
  } else if (tab === 'taleplerim') {
    body = (
      <>
        {balance.data && <BalanceSummary balance={balance.data} />}
        <Card flush>
          {mine.error ? (
            <ErrorState error={mine.error} onRetry={mine.reload} />
          ) : !mine.data ? (
            <Loading />
          ) : (
            <LeaveTable
              {...tableProps}
              rows={mine.data}
              empty={
                <EmptyState title="Henüz izin talebiniz yok">
                  Yeni bir talep oluşturmak için “Yeni İzin Talebi” düğmesini kullanabilirsiniz.
                </EmptyState>
              }
            />
          )}
        </Card>
      </>
    );
  } else if (tab === 'onay') {
    body = (
      <Card flush>
        {approvals.error ? (
          <ErrorState error={approvals.error} onRetry={approvals.reload} />
        ) : !approvals.data ? (
          <Loading />
        ) : (
          <LeaveTable
            {...tableProps}
            rows={approvals.data}
            showPerson
            initialSort={{ key: 'start_date', dir: 'asc' }}
            empty={
              <EmptyState title="Onay bekleyen talep yok" icon={CheckCircle2}>
                Yeni talepler geldiğinde burada listelenecek.
              </EmptyState>
            }
          />
        )}
      </Card>
    );
  } else {
    body = (
      <>
        <AllFilters filters={filters} setFilters={setFilters} search={search} setSearch={setSearch} showCompany={isHR} />
        <Card
          flush
          title={all.data ? `${formatNumber(allRows.length)} talep` : 'Talepler'}
          hint={all.data?.length >= 1000 ? 'En yeni 1000 kayıt gösteriliyor; filtreleri daraltın.' : undefined}
          actions={
            <button className="btn btn-sm" onClick={() => exportLeaves(allRows)} disabled={!allRows.length}>
              <Download size={14} /> CSV indir
            </button>
          }
        >
          {all.error ? (
            <ErrorState error={all.error} onRetry={all.reload} />
          ) : !all.data ? (
            <Loading />
          ) : (
            <LeaveTable
              {...tableProps}
              rows={allRows}
              showPerson
              empty={<EmptyState title="Kayıt bulunamadı">Filtrelere uyan izin talebi yok.</EmptyState>}
            />
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="İzin Talepleri"
        subtitle={isApprover ? 'İzin taleplerini oluşturun, onaylayın ve takip edin.' : 'İzin taleplerinizi oluşturun ve durumlarını takip edin.'}
        actions={
          <>
            <Link className="btn" to="/izin-takvimi">
              <CalendarRange size={16} /> İzin Takvimi
            </Link>
            {canCreate && (
              <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
                <Plus size={16} /> Yeni İzin Talebi
              </button>
            )}
          </>
        }
      />
      {allowed.length > 1 && tab && <Tabs tabs={tabs} active={tab} onChange={changeTab} />}
      {body}
      {newOpen && (
        <NewLeaveModal
          defaultEmployeeId={isHR && tab && tab !== 'taleplerim' ? '' : (user.employee_id ?? '')}
          onClose={closeNew}
          onSaved={savedNew}
        />
      )}
      {decision && <DecisionModal row={decision.row} action={decision.action} onClose={closeDecision} onDone={decided} />}
    </>
  );
}
