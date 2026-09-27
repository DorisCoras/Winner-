import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  CalendarHeart,
  Calculator,
  Check,
  Copy,
  Download,
  History,
  KeyRound,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  UserCog,
  X,
} from 'lucide-react';
import { api, useApi } from '../api.js';
import { ROLE_LABELS, useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import { downloadCsv } from '../csv.js';
import EmployeeSelect from '../components/EmployeeSelect.jsx';
import { formatDate, formatDateTime, formatDays, formatMoney, formatNumber, formatPercent, matches, todayStr } from '../format.js';
import {
  Alert,
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  SearchInput,
  Tabs,
  useConfirm,
  useForm,
  useToast,
} from '../components/ui.jsx';

export default function Settings() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();

  const tabs = [
    { key: 'genel', label: 'Genel', icon: SlidersHorizontal },
    { key: 'izin-turleri', label: 'İzin Türleri', icon: CalendarDays },
    { key: 'resmi-tatiller', label: 'Resmi Tatiller', icon: CalendarHeart },
    { key: 'bordro', label: 'Bordro Parametreleri', icon: Calculator },
    ...(isAdmin
      ? [
          { key: 'kullanicilar', label: 'Kullanıcılar', icon: UserCog },
          { key: 'islem-gecmisi', label: 'İşlem Geçmişi', icon: History },
        ]
      : []),
  ];
  const requested = params.get('sekme');
  const active = tabs.some((t) => t.key === requested) ? requested : 'genel';
  const setActive = (key) => setParams(key === 'genel' ? {} : { sekme: key }, { replace: true });

  return (
    <>
      <PageHeader title="Ayarlar" subtitle="Sistem ayarları, izin türleri, resmi tatiller ve bordro parametreleri." />
      <Tabs tabs={tabs} active={active} onChange={setActive} />
      {active === 'genel' && <GeneralTab />}
      {active === 'izin-turleri' && <LeaveTypesTab />}
      {active === 'resmi-tatiller' && <HolidaysTab />}
      {active === 'bordro' && <PayrollParamsTab />}
      {active === 'kullanicilar' && isAdmin && <UsersTab />}
      {active === 'islem-gecmisi' && isAdmin && <AuditTab />}
    </>
  );
}

/** Modal alt çubuğu: Vazgeç + formu gönderen Kaydet düğmesi. */
function FormFooter({ formId, onClose, submitting, label = 'Kaydet' }) {
  return (
    <>
      <button className="btn" type="button" onClick={onClose}>
        Vazgeç
      </button>
      <button className="btn btn-primary" type="submit" form={formId} disabled={submitting}>
        {submitting ? 'Kaydediliyor…' : label}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Genel
// ---------------------------------------------------------------------------

function GeneralTab() {
  const { data, loading, error, reload, setData } = useApi('/settings');
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  return <GeneralForm initial={data} onSaved={setData} />;
}

function GeneralForm({ initial, onSaved }) {
  const toast = useToast();
  const f = useForm({
    app_name: initial.app_name ?? '',
    saturday_workday: initial.saturday_workday === '1',
    employer_incentive: initial.employer_incentive === '1',
    sicil_prefix: initial.sicil_prefix ?? '',
  });

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const saved = await api.put('/settings', {
        app_name: v.app_name,
        saturday_workday: v.saturday_workday ? '1' : '0',
        employer_incentive: v.employer_incentive ? '1' : '0',
        sicil_prefix: v.sicil_prefix.trim().toUpperCase(),
      });
      onSaved(saved);
      toast.success('Ayarlar kaydedildi.');
    });
  };

  const prefix = f.values.sicil_prefix.trim() || 'FMR';

  return (
    <form onSubmit={onSubmit}>
      <Card
        title="Genel ayarlar"
        hint="Bu ayarlar tüm şirketler için geçerlidir."
        footer={
          <button className="btn btn-primary" type="submit" disabled={f.submitting}>
            {f.submitting ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        }
      >
        <div className="stack" style={{ maxWidth: 760 }}>
          {f.formError && <Alert tone="error">{f.formError}</Alert>}
          <div className="form-grid">
            <Field
              label="Uygulama adı"
              error={f.errors.app_name}
              htmlFor="f-app_name"
              required
              hint="Giriş ekranında ve tarayıcı başlığında görünen ad."
            >
              <input className="input" maxLength={80} {...f.bind('app_name')} />
            </Field>
            <Field
              label="Sicil numarası öneki"
              error={f.errors.sicil_prefix}
              htmlFor="f-sicil_prefix"
              required
              hint={`Yalnızca büyük harf ve rakam, en fazla 8 karakter. Yeni personele önerilen sicil: ${prefix}00001 biçiminde. Mevcut sicil numaraları değişmez.`}
            >
              <input
                className="input mono"
                maxLength={8}
                autoCapitalize="characters"
                spellCheck={false}
                {...f.bind('sicil_prefix')}
                onChange={(e) => f.set('sicil_prefix', e.target.value.toUpperCase().replace(/\s+/g, ''))}
              />
            </Field>
          </div>

          <div className="form-section-title">İzin hesabı</div>
          <div>
            <label className="checkbox">
              <input type="checkbox" {...f.bind('saturday_workday', { type: 'checkbox' })} />
              <span className="strong">Cumartesi iş günü sayılsın</span>
            </label>
            <div className="field-hint" style={{ marginLeft: 24 }}>
              Haftada 6 gün çalışılan işyerlerinde işaretleyin: izin süresi hesaplanırken cumartesiler de izin gününden düşülür. Pazar
              günleri ve resmi tatiller her durumda sayılmaz. Değişiklik yalnızca bundan sonra oluşturulan taleplerin gün hesabını etkiler;
              kayıtlı talepler yeniden hesaplanmaz.
            </div>
          </div>

          <div className="form-section-title">Bordro</div>
          <div>
            <label className="checkbox">
              <input type="checkbox" {...f.bind('employer_incentive', { type: 'checkbox' })} />
              <span className="strong">5 puanlık SGK işveren hazine teşviki uygulansın</span>
            </label>
            <div className="field-hint" style={{ marginLeft: 24 }}>
              5510 sayılı Kanun kapsamındaki hazine desteği: işveren SGK payından “Bordro Parametreleri” sekmesindeki teşvik oranı (genellikle 5
              puan) düşülür ve bordrodaki işveren maliyeti buna göre hesaplanır. Yalnızca teşvik şartlarını sağlayan (ör. SGK borcu
              bulunmayan) işyerleri için işaretleyin. Taslak bordrolara yansıması için bordroyu yeniden hesaplayın.
            </div>
          </div>
        </div>
      </Card>
    </form>
  );
}

// ---------------------------------------------------------------------------
// İzin türleri
// ---------------------------------------------------------------------------

function YesNo({ value }) {
  return value ? <Badge tone="blue">Evet</Badge> : <span className="muted">Hayır</span>;
}

function LeaveTypesTab() {
  const { data, loading, error, reload } = useApi('/leave-types');
  const { reloadLookups } = useLookups();
  const [editing, setEditing] = useState(null);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const nextSort = data.reduce((m, t) => Math.max(m, t.sort ?? 0), 0) + 1;

  const columns = [
    {
      key: 'color',
      header: 'Renk',
      sortable: false,
      width: 64,
      render: (t) => <span className="dot" style={{ background: t.color, width: 14, height: 14 }} title={t.color} />,
    },
    { key: 'name', header: 'Ad', render: (t) => <span className="strong">{t.name}</span> },
    { key: 'code', header: 'Kod', render: (t) => <span className="mono">{t.code}</span> },
    { key: 'deducts_balance', header: 'Bakiyeden düşer', render: (t) => <YesNo value={t.deducts_balance} /> },
    { key: 'paid', header: 'Ücretli', render: (t) => <YesNo value={t.paid} /> },
    {
      key: 'max_days',
      header: 'Azami gün',
      align: 'right',
      render: (t) => (t.max_days == null ? <span className="muted">Sınırsız</span> : formatDays(t.max_days)),
    },
    {
      key: 'active',
      header: 'Durum',
      render: (t) => (t.active ? <Badge tone="green">Aktif</Badge> : <Badge>Pasif</Badge>),
    },
    { key: 'sort', header: 'Sıra', align: 'right' },
    {
      key: '_actions',
      header: '',
      align: 'right',
      render: (t) => (
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditing(t)} aria-label={`${t.name} izin türünü düzenle`}>
          <Pencil size={15} />
        </button>
      ),
    },
  ];

  const saved = () => {
    setEditing(null);
    reload();
    reloadLookups();
  };

  return (
    <>
      <Card
        title="İzin türleri"
        hint="Pasif türler yeni taleplerde seçilemez; geçmiş kayıtlar korunur."
        flush
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({ sort: nextSort })}>
            <Plus size={15} /> Yeni izin türü
          </button>
        }
      >
        <DataTable columns={columns} rows={data} empty={<EmptyState title="İzin türü tanımlanmamış" />} />
      </Card>
      {editing && <LeaveTypeModal key={editing.id ?? 'yeni'} type={editing} onClose={() => setEditing(null)} onSaved={saved} />}
    </>
  );
}

function LeaveTypeModal({ type, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!type.id;
  const f = useForm({
    code: type.code ?? '',
    name: type.name ?? '',
    deducts_balance: !!type.deducts_balance,
    paid: isEdit ? !!type.paid : true,
    max_days: type.max_days ?? '',
    color: type.color ?? '#2563eb',
    active: isEdit ? !!type.active : true,
    sort: type.sort ?? 0,
  });

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const body = {
        ...v,
        code: v.code.trim(),
        max_days: v.max_days === '' ? null : v.max_days,
        sort: v.sort === '' ? 0 : v.sort,
      };
      if (isEdit) await api.put(`/leave-types/${type.id}`, body);
      else await api.post('/leave-types', body);
      toast.success(isEdit ? 'İzin türü güncellendi.' : 'İzin türü eklendi.');
      onSaved();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'İzin türünü düzenle' : 'Yeni izin türü'}
      footer={<FormFooter formId="leave-type-form" onClose={onClose} submitting={f.submitting} />}
    >
      <form id="leave-type-form" onSubmit={onSubmit} className="stack" style={{ gap: 14 }}>
        {f.formError && <Alert tone="error">{f.formError}</Alert>}
        <div className="form-grid">
          <Field label="Ad" error={f.errors.name} htmlFor="f-name" required className="full">
            <input className="input" maxLength={80} {...f.bind('name')} placeholder="ör. Doğum Sonrası Yarım Gün İzni" />
          </Field>
          <Field
            label="Kod"
            error={f.errors.code}
            htmlFor="f-code"
            required
            hint={isEdit ? 'Kod oluşturulduktan sonra değiştirilemez.' : 'Küçük harf, rakam ve _ (2–30 karakter).'}
          >
            <input
              className="input mono"
              maxLength={30}
              spellCheck={false}
              disabled={isEdit}
              {...f.bind('code')}
              onChange={(e) => f.set('code', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              placeholder="ör. dogum_sonrasi"
            />
          </Field>
          <Field label="Renk" error={f.errors.color} htmlFor="f-color" hint="Takvim ve listelerde kullanılır.">
            <div className="row">
              <input type="color" className="input" style={{ width: 56, padding: 3 }} {...f.bind('color')} />
              <span className="mono muted">{f.values.color}</span>
            </div>
          </Field>
          <Field label="Azami gün (tek talep)" error={f.errors.max_days} htmlFor="f-max_days" hint="Boş bırakılırsa sınırsız.">
            <input className="input" type="number" min="0.5" step="0.5" inputMode="decimal" {...f.bind('max_days')} placeholder="Sınırsız" />
          </Field>
          <Field label="Sıra" error={f.errors.sort} htmlFor="f-sort" hint="Listelerde küçükten büyüğe sıralanır.">
            <input className="input" type="number" step="1" {...f.bind('sort')} />
          </Field>
          <div className="full stack" style={{ gap: 10 }}>
            <label className="checkbox">
              <input type="checkbox" {...f.bind('deducts_balance', { type: 'checkbox' })} /> Yıllık izin bakiyesinden düşer
            </label>
            <label className="checkbox">
              <input type="checkbox" {...f.bind('paid', { type: 'checkbox' })} /> Ücretli izin
            </label>
            <div className="field-hint" style={{ marginTop: -6, marginLeft: 24 }}>
              Ücretsiz izin günleri bordroda SGK gün sayısından ve ücretten düşülür.
            </div>
            <label className="checkbox">
              <input type="checkbox" {...f.bind('active', { type: 'checkbox' })} /> Aktif (izin talebinde seçilebilir)
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Resmi tatiller
// ---------------------------------------------------------------------------

const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
function weekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function HolidaysTab() {
  // Tüm tatiller tek istekle alınır; yıl listesi ve yıl filtresi istemcide oluşturulur.
  const { data, loading, error, reload } = useApi('/holidays');
  const confirm = useConfirm();
  const toast = useToast();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [editing, setEditing] = useState(null);

  const years = useMemo(() => {
    const set = new Set([currentYear - 1, currentYear, currentYear + 1]);
    for (const h of data ?? []) set.add(Number(h.date.slice(0, 4)));
    return [...set].sort((a, b) => a - b);
  }, [data, currentYear]);

  const rows = useMemo(() => (data ?? []).filter((h) => h.date.startsWith(`${year}-`)), [data, year]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const weekdayLoss = rows.reduce((n, h) => {
    const wd = weekday(h.date);
    return wd === 0 || wd === 6 ? n : n + (h.half_day ? 0.5 : 1);
  }, 0);

  const remove = async (h) => {
    const ok = await confirm({
      title: 'Resmi tatili sil',
      message: `${formatDate(h.date)} tarihli “${h.name}” listeden kaldırılacak. Bu tarih bundan sonra izin hesaplarında iş günü sayılır.`,
      confirmText: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/holidays/${h.date}`);
      toast.success('Resmi tatil silindi.');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saved = (date) => {
    setEditing(null);
    setYear(Number(date.slice(0, 4)));
    reload();
  };

  const columns = [
    { key: 'date', header: 'Tarih', className: 'nowrap', render: (h) => formatDate(h.date) },
    {
      key: '_weekday',
      header: 'Gün',
      render: (h) => {
        const wd = weekday(h.date);
        return wd === 0 || wd === 6 ? (
          <span className="muted" title="Hafta sonuna denk geliyor">
            {WEEKDAYS[wd]}
          </span>
        ) : (
          WEEKDAYS[wd]
        );
      },
    },
    {
      key: 'name',
      header: 'Ad',
      render: (h) => (
        <span className="row wrap" style={{ gap: 6 }}>
          <span className="strong">{h.name}</span>
          {!!h.half_day && <Badge tone="amber">Yarım gün</Badge>}
        </span>
      ),
    },
    {
      key: '_actions',
      header: '',
      align: 'right',
      render: (h) => (
        <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditing(h)} aria-label={`${h.name} kaydını düzenle`}>
            <Pencil size={15} />
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(h)} aria-label={`${h.name} kaydını sil`}>
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="stack">
      <Alert tone="info" title="Tarihleri her yıl kontrol edin">
        Ramazan ve Kurban Bayramı tarihleri hicri takvime göre her yıl değişir; yılbaşında Diyanet İşleri Başkanlığı takvimiyle
        doğrulayın. Arife günleri 13:00’ten itibaren yarım gün tatildir. Resmi tatiller izin gün hesabında sayılmaz.
      </Alert>
      <Card
        title={`${year} resmi tatilleri`}
        hint={
          rows.length
            ? `${rows.length} kayıt · hafta içine denk gelen: ${formatDays(weekdayLoss)}`
            : 'Bu yıl için kayıt yok'
        }
        flush
        actions={
          <>
            <select className="select" style={{ width: 'auto', height: 30 }} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Yıl">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setEditing({ date: year === currentYear ? todayStr() : `${year}-01-01` })}
            >
              <Plus size={15} /> Tatil ekle
            </button>
          </>
        }
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey="date"
          pageSize={50}
          empty={
            <EmptyState title={`${year} için resmi tatil tanımlanmamış`} icon={CalendarHeart}>
              “Tatil ekle” ile bu yılın resmi tatillerini girin.
            </EmptyState>
          }
        />
      </Card>
      {editing && (
        <HolidayModal key={editing.name ? editing.date : 'yeni'} holiday={editing} all={data} onClose={() => setEditing(null)} onSaved={saved} />
      )}
    </div>
  );
}

function HolidayModal({ holiday, all, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!holiday.name;
  const f = useForm({ date: holiday.date ?? '', name: holiday.name ?? '', half_day: !!holiday.half_day });
  const existing = !isEdit ? all.find((h) => h.date === f.values.date) : null;

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      await api.post('/holidays', v);
      toast.success(isEdit || existing ? 'Resmi tatil güncellendi.' : 'Resmi tatil eklendi.');
      onSaved(v.date);
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Resmi tatili düzenle' : 'Resmi tatil ekle'}
      size="sm"
      footer={<FormFooter formId="holiday-form" onClose={onClose} submitting={f.submitting} />}
    >
      <form id="holiday-form" onSubmit={onSubmit} className="stack" style={{ gap: 14 }}>
        {f.formError && <Alert tone="error">{f.formError}</Alert>}
        <Field
          label="Tarih"
          error={f.errors.date}
          htmlFor="f-date"
          required
          hint={
            isEdit
              ? 'Tarihi değiştirmek için kaydı silip yeniden ekleyin.'
              : existing
                ? `Bu tarihte “${existing.name}” kayıtlı; kaydederseniz güncellenir.`
                : f.values.date
                  ? WEEKDAYS[weekday(f.values.date)]
                  : undefined
          }
        >
          <input className="input" type="date" disabled={isEdit} {...f.bind('date')} />
        </Field>
        <Field label="Ad" error={f.errors.name} htmlFor="f-name" required>
          <input className="input" maxLength={120} {...f.bind('name')} placeholder="ör. Kurban Bayramı 1. Gün" />
        </Field>
        <label className="checkbox">
          <input type="checkbox" {...f.bind('half_day', { type: 'checkbox' })} /> Yarım gün (arife)
        </label>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Bordro parametreleri
// ---------------------------------------------------------------------------

const round = (n, digits) => Number(Number(n).toFixed(digits));
/** 0.2075 → '20.75' (form alanı yüzde olarak) */
const toPct = (rate) => (rate == null ? '' : String(round(rate * 100, 6)));
/** '20,75' / '20.75' → 0.2075 */
const fromPct = (s) => round(parseNum(s) / 100, 8);
function parseNum(s) {
  if (s === '' || s == null) return NaN;
  return Number(String(s).trim().replace(',', '.'));
}

const RATE_FIELDS = [
  'sgkEmployeeRate',
  'unemploymentEmployeeRate',
  'stampTaxRate',
  'sgkEmployerRate',
  'unemploymentEmployerRate',
  'employerIncentiveRate',
];
const NUMBER_FIELDS = ['minWageGross', 'sgkCeilingMultiplier', 'severanceCeiling'];

function paramsToForm(p) {
  const out = {};
  for (const k of NUMBER_FIELDS) out[k] = p[k] == null ? '' : String(p[k]);
  for (const k of RATE_FIELDS) out[k] = toPct(p[k]);
  out.brackets = (p.brackets ?? []).map((b) => ({ upTo: b.upTo == null ? '' : String(b.upTo), rate: toPct(b.rate) }));
  if (!out.brackets.length) out.brackets = [{ upTo: '', rate: '' }];
  return out;
}

/** Form değerlerini doğrular; { payload } veya { errors } döndürür. */
function formToParams(v) {
  const errors = {};
  const payload = {};
  for (const k of NUMBER_FIELDS) {
    const n = parseNum(v[k]);
    if (!Number.isFinite(n) || n <= 0) errors[k] = 'Pozitif bir sayı giriniz.';
    else payload[k] = n;
  }
  for (const k of RATE_FIELDS) {
    const n = parseNum(v[k]);
    if (!Number.isFinite(n) || n < 0) errors[k] = 'Geçerli bir oran giriniz.';
    else if (n > 100) errors[k] = 'En fazla %100 olabilir.';
    else payload[k] = fromPct(v[k]);
  }
  let prev = 0;
  payload.brackets = v.brackets.map((b, i, arr) => {
    const last = i === arr.length - 1;
    const rate = parseNum(b.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) errors[`brackets.${i}.rate`] = '0–100 arası.';
    let upTo = null;
    if (!last) {
      upTo = parseNum(b.upTo);
      if (!Number.isFinite(upTo) || upTo <= 0) errors[`brackets.${i}.upTo`] = 'Üst sınır giriniz.';
      else if (upTo <= prev) errors[`brackets.${i}.upTo`] = 'Önceki sınırdan büyük olmalı.';
      else prev = upTo;
    }
    return { upTo, rate: Number.isFinite(rate) ? fromPct(b.rate) : null };
  });
  return Object.keys(errors).length ? { errors } : { payload };
}

function PayrollParamsTab() {
  const list = useApi('/payroll/params');
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [drafts, setDrafts] = useState({}); // kaydedilmemiş yeni yıllar: { 2027: { values, from } }
  const [adding, setAdding] = useState(false);
  const valuesRef = useRef(null);

  const draft = drafts[year];
  const params = useApi(draft ? null : `/payroll/params/${year}`);
  const stored = list.data?.years ?? [];

  const years = useMemo(
    () => [...new Set([...stored, ...Object.keys(drafts).map(Number), currentYear])].sort((a, b) => a - b),
    [stored, drafts, currentYear],
  );

  if (list.loading && !list.data) return <Loading />;
  if (list.error && !list.data) return <ErrorState error={list.error} onRetry={list.reload} />;

  const addYear = (newYear) => {
    setDrafts((d) => ({ ...d, [newYear]: { values: valuesRef.current, from: year } }));
    setYear(newYear);
    setAdding(false);
  };

  const discardDraft = () => {
    setDrafts(({ [year]: _, ...rest }) => rest);
    setYear(stored.includes(currentYear) ? currentYear : (stored.at(-1) ?? currentYear));
  };

  const saved = () => {
    setDrafts(({ [year]: _, ...rest }) => rest);
    list.reload();
    params.reload();
  };

  const isStored = stored.includes(year);

  return (
    <div className="stack">
      <Alert tone="warning" title="Resmi oranları doğrulayın">
        Asgari ücret, SGK prim oranları, gelir vergisi dilimleri, damga vergisi ve kıdem tazminatı tavanı her dönem değişebilir. Bu
        değerleri her dönem başında mali müşavirinizle ve resmi duyurularla (SGK, Gelir İdaresi, Resmî Gazete) doğrulayın. Kaydedilen
        değerler o yılın yeni bordro hesaplamalarında kullanılır.
      </Alert>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <label className="field-label" htmlFor="params-year">
          Yıl
        </label>
        <select id="params-year" className="select" style={{ minWidth: 150 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
              {drafts[y] ? ' (yeni, kaydedilmedi)' : stored.includes(y) ? '' : ' (kayıtlı değil)'}
            </option>
          ))}
        </select>
        {draft ? (
          <Badge tone="amber">Yeni yıl — kaydedilmedi</Badge>
        ) : isStored ? (
          <Badge tone="green">Kayıtlı</Badge>
        ) : (
          <Badge tone="amber">Varsayılan değerler</Badge>
        )}
        <span className="spacer" />
        {draft && (
          <button className="btn btn-sm btn-ghost" onClick={discardDraft}>
            <X size={15} /> Taslağı at
          </button>
        )}
        <button className="btn btn-sm" onClick={() => setAdding(true)} disabled={!draft && !params.data}>
          <Plus size={15} /> Yeni yıl ekle
        </button>
      </div>

      {draft ? (
        <Alert tone="info">
          {year} yılı için değerler {draft.from} yılından kopyalandı. Yeni yılın resmi rakamlarını girip kaydedin.
        </Alert>
      ) : (
        !isStored &&
        params.data && (
          <Alert tone="info">
            {year} yılı için kayıtlı parametre yok; gösterilen değerler sistemin varsayılanları veya önceki yılın değerleridir.
            Kaydettiğinizde {year} için ayrı bir parametre seti oluşturulur.
          </Alert>
        )
      )}

      {draft ? (
        <ParamsForm key={`${year}-taslak`} year={year} initial={draft.values} incentive={list.data?.incentive} valuesRef={valuesRef} onSaved={saved} />
      ) : params.error && !params.data ? (
        <ErrorState error={params.error} onRetry={params.reload} />
      ) : params.data?.year !== year ? (
        <Loading />
      ) : params.data ? (
        <ParamsForm
          key={`${year}-kayit`}
          year={year}
          initial={paramsToForm(params.data)}
          incentive={list.data?.incentive}
          valuesRef={valuesRef}
          onSaved={saved}
        />
      ) : null}

      {adding && <AddYearModal years={years} onClose={() => setAdding(false)} onAdd={addYear} />}
    </div>
  );
}

function AddYearModal({ years, onClose, onAdd }) {
  const f = useForm({ year: String(Math.max(...years) + 1) });
  const onSubmit = (e) => {
    e.preventDefault();
    const y = Number(f.values.year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      f.setErrors({ year: '2000–2100 arasında bir yıl giriniz.' });
      return;
    }
    if (years.includes(y)) {
      f.setErrors({ year: 'Bu yıl listede zaten var; listeden seçiniz.' });
      return;
    }
    onAdd(y);
  };
  return (
    <Modal open onClose={onClose} title="Yeni yıl ekle" size="sm" footer={<FormFooter formId="add-year-form" onClose={onClose} label="Ekle" />}>
      <form id="add-year-form" onSubmit={onSubmit} className="stack" style={{ gap: 12 }}>
        <Field label="Yıl" error={f.errors.year} htmlFor="f-year" required hint="Şu an ekrandaki değerler yeni yıla kopyalanır; kaydetmeden önce güncelleyin.">
          <input className="input" type="number" min="2000" max="2100" step="1" {...f.bind('year')} />
        </Field>
      </form>
    </Modal>
  );
}

function ParamsForm({ year, initial, incentive, valuesRef, onSaved }) {
  const toast = useToast();
  const f = useForm(initial);
  const v = f.values;
  // "Yeni yıl ekle" ekrandaki (kaydedilmemiş düzenlemeler dahil) değerleri kopyalar.
  useEffect(() => {
    valuesRef.current = v;
  }, [v, valuesRef]);

  const onSubmit = (e) => {
    e.preventDefault();
    const { payload, errors } = formToParams(v);
    if (errors) {
      f.setErrors(errors);
      f.setFormError('Lütfen işaretli alanları düzeltin.');
      return;
    }
    f.submit(async () => {
      await api.put(`/payroll/params/${year}`, payload);
      toast.success(`${year} bordro parametreleri kaydedildi.`);
      onSaved();
    });
  };

  const setBracket = (i, key, value) => {
    f.set(
      'brackets',
      v.brackets.map((b, j) => (j === i ? { ...b, [key]: value } : b)),
    );
    f.setErrors((errs) => ({ ...errs, [`brackets.${i}.${key}`]: undefined }));
  };
  const addBracket = () => {
    const list = [...v.brackets];
    list.splice(Math.max(0, list.length - 1), 0, { upTo: '', rate: '' });
    f.set('brackets', list);
  };
  const removeBracket = (i) => {
    f.set(
      'brackets',
      v.brackets.filter((_, j) => j !== i),
    );
    f.setErrors({});
  };

  const pctField = (name, label, hint) => (
    <Field label={label} error={f.errors[name]} htmlFor={`f-${name}`} hint={hint}>
      <div className="row" style={{ gap: 6 }}>
        <span className="muted">%</span>
        <input className="input num" type="number" step="any" min="0" max="100" inputMode="decimal" {...f.bind(name)} />
      </div>
    </Field>
  );

  // Canlı hesaplanan bilgiler
  const minWage = parseNum(v.minWageGross);
  const mult = parseNum(v.sgkCeilingMultiplier);
  const r = (k) => parseNum(v[k]) / 100;
  const employerRate = r('sgkEmployerRate') + r('unemploymentEmployerRate');
  const employerRateWithIncentive = employerRate - (incentive ? r('employerIncentiveRate') : 0);
  const ok = (n) => Number.isFinite(n);

  return (
    <form onSubmit={onSubmit}>
      <div className="grid grid-3" style={{ alignItems: 'start' }}>
        <Card
          className="span-2"
          title={`${year} bordro parametreleri`}
          footer={
            <button className="btn btn-primary" type="submit" disabled={f.submitting}>
              {f.submitting ? 'Kaydediliyor…' : `${year} parametrelerini kaydet`}
            </button>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            {f.formError && <Alert tone="error">{f.formError}</Alert>}
            <div className="form-grid cols-3">
              <div className="form-section-title">Asgari ücret ve tavanlar</div>
              <Field label="Asgari ücret (brüt, aylık)" error={f.errors.minWageGross} htmlFor="f-minWageGross" hint="SGK prim tabanı.">
                <div className="row" style={{ gap: 6 }}>
                  <span className="muted">₺</span>
                  <input className="input num" type="number" step="any" min="0" inputMode="decimal" {...f.bind('minWageGross')} />
                </div>
              </Field>
              <Field
                label="SGK tavan katsayısı"
                error={f.errors.sgkCeilingMultiplier}
                htmlFor="f-sgkCeilingMultiplier"
                hint="Tavan = asgari ücret × katsayı."
              >
                <div className="row" style={{ gap: 6 }}>
                  <span className="muted">×</span>
                  <input className="input num" type="number" step="any" min="0" inputMode="decimal" {...f.bind('sgkCeilingMultiplier')} />
                </div>
              </Field>
              <Field
                label="Kıdem tazminatı tavanı"
                error={f.errors.severanceCeiling}
                htmlFor="f-severanceCeiling"
                hint="Ocak ve temmuzda güncellenir."
              >
                <div className="row" style={{ gap: 6 }}>
                  <span className="muted">₺</span>
                  <input className="input num" type="number" step="any" min="0" inputMode="decimal" {...f.bind('severanceCeiling')} />
                </div>
              </Field>

              <div className="form-section-title">Çalışan kesintileri</div>
              {pctField('sgkEmployeeRate', 'SGK işçi payı')}
              {pctField('unemploymentEmployeeRate', 'İşsizlik sigortası işçi payı')}
              {pctField('stampTaxRate', 'Damga vergisi', 'Binde 7,59 için 0,759 giriniz.')}

              <div className="form-section-title">İşveren payları</div>
              {pctField('sgkEmployerRate', 'SGK işveren payı')}
              {pctField('unemploymentEmployerRate', 'İşsizlik sigortası işveren payı')}
              {pctField(
                'employerIncentiveRate',
                'Hazine teşviki (indirim)',
                incentive ? 'Genel ayarlarda teşvik açık.' : 'Genel ayarlarda teşvik kapalı; uygulanmıyor.',
              )}
            </div>

            <div className="form-section-title" style={{ marginTop: 4 }}>
              Gelir vergisi dilimleri (yıllık kümülatif matrah)
            </div>
            {f.errors.brackets && <Alert tone="error">{f.errors.brackets}</Alert>}
            <div className="table-wrap">
              <table className="table compact">
                <thead>
                  <tr>
                    <th>Dilim</th>
                    <th className="num">Alt sınır</th>
                    <th>Üst sınır (₺)</th>
                    <th>Oran (%)</th>
                    <th aria-label="İşlemler" />
                  </tr>
                </thead>
                <tbody>
                  {v.brackets.map((b, i, arr) => {
                    const last = i === arr.length - 1;
                    const lower = i === 0 ? 0 : parseNum(arr[i - 1].upTo);
                    const upErr = f.errors[`brackets.${i}.upTo`];
                    const rateErr = f.errors[`brackets.${i}.rate`];
                    return (
                      <tr key={i}>
                        <td className="nowrap">{i + 1}. dilim</td>
                        <td className="num muted">{ok(lower) ? formatNumber(lower) : '—'}</td>
                        <td style={{ minWidth: 150 }}>
                          <input
                            className="input num"
                            type="number"
                            step="any"
                            min="0"
                            inputMode="decimal"
                            aria-label={`${i + 1}. dilim üst sınırı`}
                            aria-invalid={upErr ? 'true' : undefined}
                            disabled={last}
                            placeholder={last ? 've üzeri' : ''}
                            value={last ? '' : b.upTo}
                            onChange={(e) => setBracket(i, 'upTo', e.target.value)}
                          />
                          {upErr && <div className="field-error">{upErr}</div>}
                        </td>
                        <td style={{ minWidth: 110 }}>
                          <input
                            className="input num"
                            type="number"
                            step="any"
                            min="0"
                            max="100"
                            inputMode="decimal"
                            aria-label={`${i + 1}. dilim oranı`}
                            aria-invalid={rateErr ? 'true' : undefined}
                            value={b.rate}
                            onChange={(e) => setBracket(i, 'rate', e.target.value)}
                          />
                          {rateErr && <div className="field-error">{rateErr}</div>}
                        </td>
                        <td className="num">
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => removeBracket(i)}
                            disabled={arr.length <= 1}
                            aria-label={`${i + 1}. dilimi kaldır`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="row wrap">
              <button type="button" className="btn btn-sm" onClick={addBracket}>
                <Plus size={15} /> Dilim ekle
              </button>
              <span className="small muted">Son dilimin üst sınırı yoktur (“ve üzeri”). Yeni dilim sondan bir önceki sıraya eklenir.</span>
            </div>
          </div>
        </Card>

        <Card title="Özet" hint="Girilen değerlere göre anlık hesaplanır.">
          <dl className="kv">
            <dt>SGK tabanı</dt>
            <dd className="num">{ok(minWage) ? formatMoney(minWage) : '—'}</dd>
            <dt>SGK tavanı</dt>
            <dd className="num">{ok(minWage) && ok(mult) ? formatMoney(minWage * mult) : '—'}</dd>
            <dt>Asgari ücret net (yaklaşık)</dt>
            <dd className="num">
              {ok(minWage) && ok(r('sgkEmployeeRate')) && ok(r('unemploymentEmployeeRate'))
                ? formatMoney(minWage * (1 - r('sgkEmployeeRate') - r('unemploymentEmployeeRate')))
                : '—'}
            </dd>
            <dt>İşçi kesinti oranı</dt>
            <dd className="num">
              {ok(r('sgkEmployeeRate') + r('unemploymentEmployeeRate'))
                ? formatPercent(round((r('sgkEmployeeRate') + r('unemploymentEmployeeRate')) * 100, 4), 2)
                : '—'}
            </dd>
            <dt>İşveren prim oranı</dt>
            <dd className="num">
              {ok(employerRate) ? formatPercent(round(employerRate * 100, 4), 2) : '—'}
              {incentive && ok(employerRateWithIncentive) && (
                <div className="small muted">teşvikle {formatPercent(round(employerRateWithIncentive * 100, 4), 2)}</div>
              )}
            </dd>
            <dt>Asgari ücret işveren maliyeti</dt>
            <dd className="num">
              {ok(minWage) && ok(employerRateWithIncentive) ? formatMoney(minWage * (1 + employerRateWithIncentive)) : '—'}
            </dd>
          </dl>
          <p className="small muted mt-2" style={{ marginBottom: 0 }}>
            Asgari ücrete isabet eden kısım gelir ve damga vergisinden istisnadır; net tutar yalnızca SGK ve işsizlik sigortası işçi
            payları düşülerek bulunur.
          </p>
        </Card>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Kullanıcılar (yalnızca sistem yöneticisi)
// ---------------------------------------------------------------------------

const ROLE_TONES = { admin: 'blue', ik: 'teal', yonetici: 'amber', personel: '' };
const ROLE_HINTS = {
  admin: 'Tüm yetkiler; kullanıcı yönetimi ve işlem geçmişi dahil.',
  ik: 'Personel, izin, bordro, işe alım ve raporlar; kullanıcı yönetimi hariç.',
  yonetici: 'Ekibinin bilgilerini görür ve izin taleplerini onaylar.',
  personel: 'Kendi bilgilerini, izinlerini ve bordrolarını görür.',
};

function UsersTab() {
  const { user: me } = useAuth();
  const { roles } = useLookups();
  const { data, loading, error, reload } = useApi('/users');
  const confirm = useConfirm();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [editing, setEditing] = useState(null);
  const [secret, setSecret] = useState(null);

  const roleMap = roles ?? ROLE_LABELS;
  const roleLabel = (code) => roleMap[code] ?? code;

  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (u) => (!role || u.role === role) && (matches(u.email, q) || matches(u.employee_name, q) || matches(u.company_name, q)),
      ),
    [data, q, role],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const resetPassword = async (u) => {
    const ok = await confirm({
      title: 'Şifre sıfırla',
      message: `${u.email} için yeni bir geçici şifre oluşturulacak. Kullanıcının açık oturumları kapatılır ve ilk girişte şifresini değiştirmesi istenir.`,
      confirmText: 'Şifreyi sıfırla',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api.post(`/users/${u.id}/reset-password`);
      setSecret({ title: 'Şifre sıfırlandı', email: u.email, password: res.temp_password });
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (u) => {
    const ok = await confirm({
      title: 'Kullanıcıyı sil',
      message: `${u.email} hesabı kalıcı olarak silinecek. Bağlı personel kaydı silinmez. Erişimi geçici olarak kapatmak için hesabı pasife almayı tercih edebilirsiniz.`,
      confirmText: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/users/${u.id}`);
      toast.success('Kullanıcı silindi.');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    {
      key: 'email',
      header: 'E-posta',
      render: (u) => (
        <span className="row wrap" style={{ gap: 6 }}>
          <span className="strong">{u.email}</span>
          {u.id === me.id && <Badge tone="blue">Siz</Badge>}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      sortValue: (u) => roleLabel(u.role),
      render: (u) => <Badge tone={ROLE_TONES[u.role]}>{roleLabel(u.role)}</Badge>,
    },
    {
      key: 'employee_name',
      header: 'Bağlı personel',
      render: (u) => u.employee_name ?? <span className="muted">Bağlı değil</span>,
    },
    { key: 'company_name', header: 'Şirket', render: (u) => u.company_name ?? '—' },
    {
      key: 'active',
      header: 'Durum',
      render: (u) => (
        <span className="row wrap" style={{ gap: 4 }}>
          {u.active ? <Badge tone="green">Aktif</Badge> : <Badge tone="red">Pasif</Badge>}
          {!!u.must_change_password && <Badge tone="amber">Şifre değişimi bekliyor</Badge>}
        </span>
      ),
    },
    {
      key: 'last_login_at',
      header: 'Son giriş',
      className: 'nowrap',
      render: (u) => (u.last_login_at ? formatDateTime(u.last_login_at) : <span className="muted">Hiç giriş yapmadı</span>),
    },
    {
      key: '_actions',
      header: '',
      align: 'right',
      render: (u) => (
        <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditing(u)} aria-label={`${u.email} hesabını düzenle`} title="Düzenle">
            <Pencil size={15} />
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => resetPassword(u)}
            aria-label={`${u.email} şifresini sıfırla`}
            title="Şifre sıfırla"
          >
            <KeyRound size={15} />
          </button>
          {u.id !== me.id && (
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(u)} aria-label={`${u.email} hesabını sil`} title="Sil">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="E-posta, personel veya şirket ara…" />
        <select className="select" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rol">
          <option value="">Tüm roller</option>
          {Object.entries(roleMap).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <span className="muted small">{rows.length} kullanıcı</span>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          <Plus size={16} /> Yeni kullanıcı
        </button>
      </div>
      <Card flush>
        <DataTable columns={columns} rows={rows} empty={<EmptyState title="Kullanıcı bulunamadı" />} />
      </Card>
      {editing && (
        <UserModal
          key={editing.id ?? 'yeni'}
          account={editing}
          users={data}
          roleMap={roleMap}
          isSelf={editing.id === me.id}
          onClose={() => setEditing(null)}
          onSaved={(res) => {
            setEditing(null);
            reload();
            if (res?.temp_password) setSecret({ title: 'Kullanıcı oluşturuldu', email: res.email, password: res.temp_password });
          }}
        />
      )}
      {secret && <TempPasswordModal info={secret} onClose={() => setSecret(null)} />}
    </>
  );
}

function UserModal({ account, users, roleMap, isSelf, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!account.id;
  const f = useForm({
    email: account.email ?? '',
    role: account.role ?? 'personel',
    employee_id: account.employee_id ?? '',
    active: isEdit ? !!account.active : true,
    password: '',
  });

  // Başka bir hesaba bağlı personeller listelenmez.
  const linked = useMemo(
    () => new Set(users.filter((u) => u.employee_id && u.id !== account.id).map((u) => u.employee_id)),
    [users, account.id],
  );
  const employeeFilter = useCallback((e) => !linked.has(e.id), [linked]);

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const body = { email: v.email, role: v.role, employee_id: v.employee_id || null, active: !!v.active };
      if (isEdit) {
        await api.put(`/users/${account.id}`, body);
        toast.success('Kullanıcı güncellendi.');
        onSaved();
      } else {
        const res = await api.post('/users', { ...body, password: v.password });
        toast.success('Kullanıcı oluşturuldu.');
        onSaved(res);
      }
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı'}
      footer={<FormFooter formId="user-form" onClose={onClose} submitting={f.submitting} label={isEdit ? 'Kaydet' : 'Oluştur'} />}
    >
      <form id="user-form" onSubmit={onSubmit} className="stack" style={{ gap: 14 }}>
        {f.formError && <Alert tone="error">{f.formError}</Alert>}
        <Field label="E-posta" error={f.errors.email} htmlFor="f-email" required hint="Kullanıcı bu adresle giriş yapar.">
          <input className="input" type="email" autoComplete="off" {...f.bind('email')} />
        </Field>
        <Field
          label="Rol"
          error={f.errors.role}
          htmlFor="f-role"
          required
          hint={isSelf ? 'Kendi rolünüzü değiştiremezsiniz.' : ROLE_HINTS[f.values.role]}
        >
          <select className="select" disabled={isSelf} {...f.bind('role')}>
            {Object.entries(roleMap).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Bağlı personel"
          error={f.errors.employee_id}
          htmlFor="f-employee_id"
          hint="İsteğe bağlı. Personel bağlanmadan kullanıcı kendi izin ve bordro ekranlarını kullanamaz."
        >
          <EmployeeSelect
            id="f-employee_id"
            value={f.values.employee_id}
            onChange={(id) => f.set('employee_id', id)}
            filter={employeeFilter}
            placeholder="Personel bağlama"
            invalid={!!f.errors.employee_id}
          />
        </Field>
        {isEdit ? (
          <div>
            <label className="checkbox">
              <input type="checkbox" disabled={isSelf} {...f.bind('active', { type: 'checkbox' })} /> Hesap aktif
            </label>
            <div className="field-hint" style={{ marginLeft: 24 }}>
              {isSelf ? 'Kendi hesabınızı pasife alamazsınız.' : 'Pasif hesaplar giriş yapamaz; açık oturumları kapatılır.'}
            </div>
          </div>
        ) : (
          <Field
            label="Geçici şifre"
            error={f.errors.password}
            htmlFor="f-password"
            hint="Boş bırakırsanız güçlü bir şifre üretilir. En az 8 karakter; harf ve rakam içermeli. Kullanıcı ilk girişte değiştirir."
          >
            <input className="input mono" type="text" autoComplete="off" spellCheck={false} {...f.bind('password')} placeholder="Otomatik üret" />
          </Field>
        )}
      </form>
    </Modal>
  );
}

function TempPasswordModal({ info, onClose }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.password);
      setCopied(true);
      toast.success('Şifre panoya kopyalandı.');
    } catch {
      toast.error('Panoya kopyalanamadı; şifreyi seçip elle kopyalayın.');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={info.title}
      size="sm"
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Tamam
        </button>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <Alert tone="success" title="Geçici şifre">
          <div className="small">{info.email}</div>
          <div className="row mt-1" style={{ gap: 6 }}>
            <input
              className="input mono"
              readOnly
              value={info.password}
              onFocus={(e) => e.target.select()}
              aria-label="Geçici şifre"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button className="btn" type="button" onClick={copy}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Kopyalandı' : 'Kopyala'}
            </button>
          </div>
        </Alert>
        <p className="small muted" style={{ margin: 0 }}>
          Şifreyi kullanıcıya güvenli bir kanaldan (yüz yüze, telefonla veya şifreli mesajla) iletin; düz e-postayla göndermeyin. Kullanıcı
          ilk girişte şifresini değiştirmek zorundadır. Bu pencere kapandıktan sonra şifre yeniden görüntülenemez.
        </p>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// İşlem geçmişi (yalnızca sistem yöneticisi)
// ---------------------------------------------------------------------------

const ACTION_LABELS = {
  olustur: 'Oluşturma',
  guncelle: 'Güncelleme',
  sil: 'Silme',
  giris: 'Giriş',
  onayla: 'Onay',
  reddet: 'Ret',
  iptal: 'İptal',
  kaydet: 'Kaydetme',
  sifre_sifirla: 'Şifre sıfırlama',
  sifre_degistir: 'Şifre değişikliği',
  isten_cikis: 'İşten çıkış',
  yeniden_aktif: 'Yeniden işe alım',
  asama_degistir: 'Aşama değişikliği',
  belge_guncelle: 'Belge güncelleme',
  belge_sil: 'Belge silme',
  zimmetle: 'Zimmet verme',
  iade_al: 'Zimmet iadesi',
  okundu: 'Okundu',
  onay_geri_al: 'Onay geri alma',
  yeniden_hesapla: 'Yeniden hesaplama',
};
const ACTION_TONES = { olustur: 'green', guncelle: 'blue', kaydet: 'blue', sil: 'red', onayla: 'green', reddet: 'red', iptal: 'amber' };

const ENTITY_LABELS = {
  personel: 'Personel',
  izin: 'İzin',
  izin_turu: 'İzin türü',
  resmi_tatil: 'Resmi tatil',
  bordro: 'Bordro',
  bordro_satiri: 'Bordro satırı',
  bordro_parametre: 'Bordro parametresi',
  kullanici: 'Kullanıcı',
  sirket: 'Şirket',
  departman: 'Departman',
  ayarlar: 'Ayarlar',
  aday: 'Aday',
  ilan: 'İş ilanı',
  demirbas: 'Demirbaş',
  duyuru: 'Duyuru',
  performans: 'Performans',
};

const actionLabel = (a) => ACTION_LABELS[a] ?? a;
const entityLabel = (e) => ENTITY_LABELS[e] ?? e;

function scalarText(x) {
  if (x === null || x === undefined) return '—';
  if (typeof x === 'boolean') return x ? 'evet' : 'hayır';
  if (typeof x === 'object') return JSON.stringify(x);
  return String(x);
}

/** Ayrıntı alanı: JSON ise "anahtar: değer" biçiminde kısa metin, değilse olduğu gibi. */
function detailsText(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return String(raw);
  }
  if (Array.isArray(value)) return value.map(scalarText).join(', ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([k, x]) => `${k}: ${scalarText(x)}`)
      .join(', ');
  }
  return scalarText(value);
}

function AuditTab() {
  const { data, loading, error, reload } = useApi('/audit?limit=300');
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');

  const all = useMemo(() => (data ?? []).map((r) => ({ ...r, detailText: detailsText(r.details) })), [data]);
  const entities = useMemo(
    () => [...new Set(all.map((r) => r.entity))].sort((a, b) => entityLabel(a).localeCompare(entityLabel(b), 'tr')),
    [all],
  );
  const rows = useMemo(
    () =>
      all.filter(
        (r) =>
          (!entity || r.entity === entity) &&
          (!q ||
            matches(r.user_email ?? 'Sistem', q) ||
            matches(actionLabel(r.action), q) ||
            matches(entityLabel(r.entity), q) ||
            matches(r.entity_id, q) ||
            matches(r.detailText, q)),
      ),
    [all, q, entity],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const exportCsv = () =>
    downloadCsv(
      'islem-gecmisi.csv',
      [
        { header: 'Tarih', value: (r) => formatDateTime(r.created_at) },
        { header: 'Kullanıcı', value: (r) => r.user_email ?? 'Sistem' },
        { header: 'İşlem', value: (r) => actionLabel(r.action) },
        { header: 'Kayıt türü', value: (r) => entityLabel(r.entity) },
        { header: 'Kayıt no', value: (r) => r.entity_id },
        { header: 'Ayrıntı', value: (r) => r.detailText },
      ],
      rows,
    );

  const columns = [
    { key: 'created_at', header: 'Tarih', className: 'nowrap', sortValue: (r) => r.id, render: (r) => formatDateTime(r.created_at) },
    {
      key: 'user_email',
      header: 'Kullanıcı',
      sortValue: (r) => r.user_email ?? '',
      render: (r) => r.user_email ?? <span className="muted">Sistem</span>,
    },
    {
      key: 'action',
      header: 'İşlem',
      sortValue: (r) => actionLabel(r.action),
      render: (r) => <Badge tone={ACTION_TONES[r.action] ?? ''}>{actionLabel(r.action)}</Badge>,
    },
    { key: 'entity', header: 'Kayıt türü', sortValue: (r) => entityLabel(r.entity), render: (r) => entityLabel(r.entity) },
    { key: 'entity_id', header: 'Kayıt no', align: 'right', render: (r) => r.entity_id ?? '—' },
    {
      key: 'detailText',
      header: 'Ayrıntı',
      render: (r) =>
        r.detailText ? (
          <span className="truncate small" style={{ display: 'block', maxWidth: 360 }} title={r.detailText}>
            {r.detailText}
          </span>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ];

  return (
    <>
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Kullanıcı, işlem veya ayrıntı ara…" />
        <select className="select" value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Kayıt türü">
          <option value="">Tüm kayıt türleri</option>
          {entities.map((e) => (
            <option key={e} value={e}>
              {entityLabel(e)}
            </option>
          ))}
        </select>
        <span className="muted small">
          {rows.length} kayıt{data.length >= 300 ? ' (son 300 işlem)' : ''}
        </span>
        <span className="spacer" />
        <button className="btn btn-sm" onClick={reload} disabled={loading}>
          Yenile
        </button>
        <button className="btn btn-sm" onClick={exportCsv} disabled={!rows.length}>
          <Download size={15} /> CSV
        </button>
      </div>
      <Card flush>
        <DataTable columns={columns} rows={rows} pageSize={50} compact empty={<EmptyState title="Kayıt bulunamadı" icon={History} />} />
      </Card>
    </>
  );
}
