import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Calculator,
  CalendarDays,
  FileCheck2,
  FileText,
  Mail,
  Package,
  Pencil,
  Phone,
  Printer,
  RotateCcw,
  Trash2,
  User,
  UserMinus,
  Wallet,
} from 'lucide-react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import {
  Alert,
  Avatar,
  Badge,
  Card,
  DataTable,
  EmployeeStatusBadge,
  EmptyState,
  ErrorState,
  Field,
  KeyValue,
  LeaveStatusBadge,
  Loading,
  Modal,
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
  formatMoney,
  formatNumber,
  formatTenure,
  periodLabel,
  todayStr,
} from '../format.js';

const GENDER = { K: 'Kadın', E: 'Erkek' };

export default function EmployeeDetail() {
  const { id } = useParams();
  const { isHR, isAdmin, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('sekme') ?? 'genel';
  const setTab = (key) => setParams(key === 'genel' ? {} : { sekme: key }, { replace: true });
  const { data: emp, loading, error, reload } = useApi(`/employees/${id}`);
  const [modal, setModal] = useState(null);
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();

  if (loading && !emp) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!emp) return null;

  const name = `${emp.first_name} ${emp.last_name}`;
  const own = user.employee_id === emp.id;
  const sensitive = isHR || own;

  const tabs = [
    { key: 'genel', label: 'Genel', icon: User },
    { key: 'izinler', label: 'İzinler', icon: CalendarDays },
    ...(sensitive ? [{ key: 'belgeler', label: 'Özlük Dosyası', icon: FileCheck2 }] : []),
    { key: 'zimmet', label: 'Zimmetler', icon: Package },
    { key: 'performans', label: 'Performans', icon: Award },
    ...(isHR ? [{ key: 'bordro', label: 'Bordro', icon: Wallet }] : []),
  ];

  const reactivate = async () => {
    if (!(await confirm({ title: 'Personeli yeniden aktifleştir', message: `${name} yeniden aktif çalışan olarak işaretlenecek ve kullanıcı hesabı açılacak.`, confirmText: 'Aktifleştir' }))) return;
    try {
      await api.post(`/employees/${id}/reactivate`, {});
      toast.success('Personel yeniden aktifleştirildi.');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async () => {
    if (
      !(await confirm({
        title: 'Personel kaydını sil',
        message: 'Bu işlem geri alınamaz. Personelin tüm izin, belge ve zimmet kayıtları da silinir. Bordro kaydı olan personel silinemez; bunun yerine işten çıkış işlemi yapın.',
        confirmText: 'Kalıcı olarak sil',
        danger: true,
      }))
    )
      return;
    try {
      await api.del(`/employees/${id}`);
      toast.success('Personel kaydı silindi.');
      navigate('/personel');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      {(isHR || user.role === 'yonetici') && (
        <Link className="back-link" to="/personel">
          <ArrowLeft size={14} /> Personel listesi
        </Link>
      )}
      <div className="page-header">
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <Avatar name={name} size="lg" />
          <div>
            <h1>{name}</h1>
            <div className="subtitle">
              {emp.position ?? '—'} · {emp.department_name ?? 'Departmansız'} · {emp.company_name}
            </div>
            <div className="row wrap mt-1" style={{ gap: 6 }}>
              <EmployeeStatusBadge status={emp.status} />
              <Badge tone="blue">Sicil {emp.sicil_no}</Badge>
              <Badge>{formatTenure(emp.hire_date, emp.exit_date ?? undefined)}</Badge>
            </div>
          </div>
        </div>
        {isHR && (
          <div className="page-actions">
            <Link className="btn" to={`/yazdir/calisma-belgesi/${emp.id}`}>
              <Printer size={16} /> Çalışma belgesi
            </Link>
            <Link className="btn" to={`/personel/${emp.id}/duzenle`}>
              <Pencil size={16} /> Düzenle
            </Link>
            {emp.status === 'aktif' ? (
              <button className="btn btn-danger" onClick={() => setModal('terminate')}>
                <UserMinus size={16} /> İşten çıkış
              </button>
            ) : (
              <button className="btn" onClick={reactivate}>
                <RotateCcw size={16} /> Yeniden aktifleştir
              </button>
            )}
            {isAdmin && (
              <button className="btn btn-ghost btn-icon" onClick={remove} aria-label="Personeli sil" title="Sil">
                <Trash2 size={17} />
              </button>
            )}
          </div>
        )}
      </div>

      {emp.status === 'ayrildi' && (
        <div className="mb-2">
          <ExitInfo emp={emp} />
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'genel' && <OverviewTab emp={emp} sensitive={sensitive} isHR={isHR} />}
      {tab === 'izinler' && <LeavesTab emp={emp} />}
      {tab === 'belgeler' && sensitive && <DocumentsTab employeeId={emp.id} canEdit={isHR} />}
      {tab === 'zimmet' && <AssetsTab employeeId={emp.id} />}
      {tab === 'performans' && <ReviewsTab employeeId={emp.id} />}
      {tab === 'bordro' && isHR && <PayrollTab employeeId={emp.id} />}

      {modal === 'terminate' && (
        <TerminateModal
          emp={emp}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function ExitInfo({ emp }) {
  const { exitCode } = useLookups();
  const code = exitCode(emp.exit_code);
  return (
    <Alert tone="warning" title={`${formatDate(emp.exit_date)} tarihinde işten ayrıldı`}>
      {code ? `Çıkış kodu ${code.code} – ${code.label}` : null}
      {emp.exit_note ? <div className="small">{emp.exit_note}</div> : null}
    </Alert>
  );
}

// ---------------------------------------------------------------------------

function OverviewTab({ emp, sensitive, isHR }) {
  const { employmentTypes } = useLookups();
  const bal = emp.leave_balance;
  return (
    <div className="grid grid-3">
      <div className="stack span-2">
        <Card title="İş bilgileri">
          <KeyValue
            items={[
              ['Şirket', emp.company_name],
              ['Departman', emp.department_name],
              ['Pozisyon', emp.position],
              ['Yönetici', emp.manager_id ? <Link to={`/personel/${emp.manager_id}`}>{emp.manager_name}</Link> : null],
              ['İşe giriş tarihi', `${formatDate(emp.hire_date)} (${formatTenure(emp.hire_date, emp.exit_date ?? undefined)})`],
              ['Çalışma şekli', employmentTypes?.[emp.employment_type] ?? emp.employment_type],
              sensitive && ['Aylık brüt ücret', formatMoney(emp.gross_salary)],
              sensitive && ['SGK sicil no', emp.sgk_no],
              sensitive && ['IBAN', emp.iban ? <span className="mono">{emp.iban.replace(/(.{4})/g, '$1 ').trim()}</span> : null],
            ]}
          />
        </Card>
        {sensitive ? (
          <Card title="Kişisel bilgiler" hint="KVKK kapsamında yalnızca yetkili kişilerce görüntülenir.">
            <KeyValue
              items={[
                ['T.C. Kimlik No', emp.tc_kimlik],
                ['Doğum tarihi', emp.birth_date ? `${formatDate(emp.birth_date)}${emp.age != null ? ` (${emp.age} yaş)` : ''}` : null],
                ['Cinsiyet', GENDER[emp.gender]],
                ['Medeni durum', emp.marital_status],
                ['Eğitim', emp.education],
                ['Kan grubu', emp.blood_type],
                ['Adres', [emp.address, emp.city].filter(Boolean).join(', ')],
                ['Acil durum kişisi', emp.emergency_contact],
                ['Acil durum telefonu', emp.emergency_phone],
                isHR && emp.notes && ['Notlar', <span style={{ whiteSpace: 'pre-wrap' }}>{emp.notes}</span>],
              ]}
            />
          </Card>
        ) : (
          <Alert>Kişisel ve ücret bilgileri yalnızca İK birimi ve çalışanın kendisi tarafından görüntülenebilir.</Alert>
        )}
      </div>
      <div className="stack">
        <Card title="İletişim">
          <div className="stack" style={{ gap: 10 }}>
            <div className="row">
              <Mail size={16} className="muted" />
              {emp.email ? <a href={`mailto:${emp.email}`}>{emp.email}</a> : '—'}
            </div>
            <div className="row">
              <Phone size={16} className="muted" />
              {emp.phone ? <a href={`tel:${emp.phone.replace(/\s/g, '')}`}>{emp.phone}</a> : '—'}
            </div>
          </div>
        </Card>
        <Card title="Yıllık izin">
          <div className="stat-value">{formatDays(bal.available)}</div>
          <div className="muted small">kullanılabilir bakiye</div>
          <div className="mt-2">
            <KeyValue
              items={[
                bal.baseDate
                  ? [`Devreden (${formatDate(bal.baseDate)})`, formatDays(bal.carryover)]
                  : bal.carryover
                    ? ['Bakiye düzeltmesi', formatDays(bal.carryover)]
                    : null,
                [bal.baseDate ? 'Devirden sonra hak edilen' : 'Hak edilen (toplam)', formatDays(bal.earned)],
                ['Kullanılan', formatDays(bal.used)],
                ['Onay bekleyen', formatDays(bal.pending)],
                ['Sonraki hak ediş', bal.next ? `${formatDate(bal.next.date)} · ${bal.next.days} gün` : null],
              ]}
            />
          </div>
        </Card>
        <Card title="Doğrudan bağlı çalışanlar" flush>
          {emp.direct_reports.length ? (
            <ul className="list">
              {emp.direct_reports.map((r) => (
                <li key={r.id}>
                  <Avatar name={`${r.first_name} ${r.last_name}`} size="sm" />
                  <div className="grow">
                    <Link to={`/personel/${r.id}`} className="strong">
                      {r.first_name} {r.last_name}
                    </Link>
                    <div className="muted small">{r.position}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted small" style={{ padding: '14px 18px' }}>
              Bağlı çalışan yok.
            </div>
          )}
        </Card>
        {isHR && (
          <Card title="Kullanıcı hesabı">
            {emp.account ? (
              <KeyValue
                items={[
                  ['E-posta', emp.account.email],
                  ['Rol', { admin: 'Sistem Yöneticisi', ik: 'İK Uzmanı', yonetici: 'Yönetici', personel: 'Personel' }[emp.account.role]],
                  ['Durum', emp.account.active ? <Badge tone="green">Aktif</Badge> : <Badge tone="red">Pasif</Badge>],
                  ['Son giriş', formatDateTime(emp.account.last_login_at)],
                ]}
              />
            ) : (
              <div className="muted small">Bu personelin sisteme giriş hesabı yok. Ayarlar &gt; Kullanıcılar bölümünden oluşturabilirsiniz.</div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function LeavesTab({ emp }) {
  const { data, loading, error, reload } = useApi(`/leaves?scope=all&employee_id=${emp.id}`);
  const bal = emp.leave_balance;
  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatCard icon={CalendarDays} label="Kullanılabilir bakiye" value={formatDays(bal.available)} />
        <StatCard
          icon={CalendarDays}
          tone="green"
          label={bal.baseDate ? 'Devreden + hak edilen' : 'Toplam hak edilen'}
          value={formatDays(bal.earned + bal.carryover)}
          sub={bal.baseDate ? `${formatDate(bal.baseDate)} devri: ${formatDays(bal.carryover)} · ${bal.serviceYears} yıl kıdem` : `${bal.serviceYears} yıllık kıdem`}
        />
        <StatCard icon={CalendarDays} tone="amber" label="Kullanılan" value={formatDays(bal.used)} />
        <StatCard
          icon={CalendarDays}
          tone="teal"
          label="Sonraki hak ediş"
          value={bal.next ? `${bal.next.days} gün` : '—'}
          sub={bal.next ? formatDate(bal.next.date) : undefined}
        />
      </div>
      <div className="grid grid-3">
        <Card title="İzin geçmişi" className="span-2" flush>
          {loading && !data ? (
            <Loading />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <DataTable
              compact
              rows={data}
              empty={<EmptyState title="İzin kaydı yok" icon={CalendarDays} />}
              columns={[
                {
                  key: 'leave_type_name',
                  header: 'İzin türü',
                  render: (r) => (
                    <span className="row">
                      <i className="dot" style={{ background: r.color }} />
                      {r.leave_type_name}
                    </span>
                  ),
                },
                { key: 'start_date', header: 'Tarih', render: (r) => formatDateRange(r.start_date, r.end_date) },
                { key: 'days', header: 'Gün', align: 'right', render: (r) => formatNumber(r.days) },
                { key: 'status', header: 'Durum', render: (r) => <LeaveStatusBadge status={r.status} /> },
                { key: 'reason', header: 'Açıklama', render: (r) => <span className="muted">{r.reason ?? '—'}</span> },
              ]}
            />
          )}
        </Card>
        <Card title="Hak ediş geçmişi" hint="4857 s. İş Kanunu m.53" flush>
          {bal.history.length ? (
            <table className="table compact">
              <thead>
                <tr>
                  <th>Yıl</th>
                  <th>Tarih</th>
                  <th className="num">Gün</th>
                </tr>
              </thead>
              <tbody>
                {[...bal.history].reverse().map((h) => (
                  <tr key={h.year} className={h.counted ? '' : 'muted'} title={h.counted ? undefined : 'Devir bakiyesine dahil'}>
                    <td>{h.year}. yıl</td>
                    <td>{formatDate(h.date)}</td>
                    <td className="num">{h.counted ? h.days : `(${h.days})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="muted small" style={{ padding: '14px 18px' }}>
              Henüz bir yıllık hizmet süresi dolmadı; ilk hak ediş {formatDate(bal.next?.date)} tarihinde.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DocumentsTab({ employeeId, canEdit }) {
  const { data, loading, error, reload } = useApi(`/employees/${employeeId}/documents`);
  const [editing, setEditing] = useState(null);
  const confirm = useConfirm();
  const toast = useToast();
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const required = data.filter((d) => d.required);
  const done = required.filter((d) => d.record?.received_date).length;
  const today = todayStr();

  const clear = async (doc) => {
    if (!(await confirm({ title: 'Belge kaydını kaldır', message: `"${doc.label}" teslim bilgisi silinecek.`, confirmText: 'Kaldır', danger: true }))) return;
    try {
      await api.del(`/employees/${employeeId}/documents/${doc.code}`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Card
      title="Özlük dosyası"
      hint={`Zorunlu belgeler: ${done} / ${required.length} tamam`}
      actions={
        <div style={{ width: 160 }} className="progress" aria-label={`${done} / ${required.length}`}>
          <span style={{ width: `${(done / Math.max(1, required.length)) * 100}%` }} />
        </div>
      }
      flush
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Belge</th>
              <th>Durum</th>
              <th>Teslim tarihi</th>
              <th>Geçerlilik</th>
              <th>Not</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const rec = d.record;
              const expired = rec?.expiry_date && rec.expiry_date < today;
              return (
                <tr key={d.code}>
                  <td>
                    <div className="strong">{d.label}</div>
                    {d.required ? <div className="muted small">Zorunlu</div> : <div className="muted small">İsteğe bağlı</div>}
                  </td>
                  <td>
                    {rec?.received_date ? (
                      expired ? (
                        <Badge tone="red">Süresi dolmuş</Badge>
                      ) : (
                        <Badge tone="green">Teslim alındı</Badge>
                      )
                    ) : d.required ? (
                      <Badge tone="amber">Eksik</Badge>
                    ) : (
                      <Badge>—</Badge>
                    )}
                  </td>
                  <td>{formatDate(rec?.received_date)}</td>
                  <td>{rec?.expiry_date ? formatDate(rec.expiry_date) : '—'}</td>
                  <td className="muted small">{rec?.notes ?? ''}</td>
                  {canEdit && (
                    <td className="right nowrap">
                      <button className="btn btn-sm" onClick={() => setEditing(d)}>
                        {rec ? 'Düzenle' : 'Teslim al'}
                      </button>
                      {rec && (
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => clear(d)} aria-label="Kaydı kaldır">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editing && (
        <DocumentModal
          employeeId={employeeId}
          doc={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </Card>
  );
}

function DocumentModal({ employeeId, doc, onClose, onSaved }) {
  const toast = useToast();
  const f = useForm({
    received_date: doc.record?.received_date ?? todayStr(),
    expiry_date: doc.record?.expiry_date ?? '',
    notes: doc.record?.notes ?? '',
  });
  const save = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      await api.put(`/employees/${employeeId}/documents/${doc.code}`, v);
      toast.success('Belge bilgisi kaydedildi.');
      onSaved();
    });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={doc.label}
      size="sm"
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn btn-primary" onClick={save} disabled={f.submitting}>
            Kaydet
          </button>
        </>
      }
    >
      <form onSubmit={save} className="stack" style={{ gap: 12 }}>
        {f.formError && <Alert tone="error">{f.formError}</Alert>}
        <Field label="Teslim tarihi" error={f.errors.received_date} htmlFor="f-received_date">
          <input className="input" type="date" {...f.bind('received_date')} />
        </Field>
        <Field label="Geçerlilik bitiş tarihi" hint="Sağlık raporu, sertifika gibi süreli belgeler için." error={f.errors.expiry_date} htmlFor="f-expiry_date">
          <input className="input" type="date" {...f.bind('expiry_date')} />
        </Field>
        <Field label="Not" htmlFor="f-notes">
          <input className="input" {...f.bind('notes')} />
        </Field>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function AssetsTab({ employeeId }) {
  const { data, loading, error, reload } = useApi(`/employees/${employeeId}/assets`);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <Card title="Zimmetli demirbaşlar" flush>
      <DataTable
        rows={data}
        empty={<EmptyState title="Zimmet kaydı yok" icon={Package} />}
        columns={[
          { key: 'category', header: 'Kategori' },
          { key: 'asset_name', header: 'Demirbaş' },
          { key: 'serial_no', header: 'Seri no / plaka', render: (a) => <span className="mono">{a.serial_no ?? '—'}</span> },
          { key: 'assigned_at', header: 'Zimmet tarihi', render: (a) => formatDate(a.assigned_at) },
          {
            key: 'returned_at',
            header: 'Durum',
            render: (a) => (a.returned_at ? <Badge>İade edildi · {formatDate(a.returned_at)}</Badge> : <Badge tone="blue">Zimmette</Badge>),
          },
          {
            key: '_print',
            header: '',
            render: (a) => (
              <Link className="btn btn-sm" to={`/yazdir/zimmet/${a.id}`}>
                <FileText size={14} /> Tutanak
              </Link>
            ),
          },
        ]}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------

function ReviewsTab({ employeeId }) {
  const { data, loading, error, reload } = useApi(`/reviews?employee_id=${employeeId}`);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <Card
      title="Performans değerlendirmeleri"
      actions={
        <Link className="btn btn-sm" to="/performans">
          Performans modülü
        </Link>
      }
      flush
    >
      <DataTable
        rows={data}
        empty={<EmptyState title="Değerlendirme bulunmuyor" icon={Award} />}
        columns={[
          { key: 'period', header: 'Dönem' },
          {
            key: 'overall',
            header: 'Genel puan',
            render: (r) =>
              r.overall != null ? (
                <span className="row">
                  <span className="strong">{formatNumber(r.overall, 2)}</span>
                  <span className="muted">/ 5</span>
                </span>
              ) : (
                '—'
              ),
          },
          { key: 'status', header: 'Durum', render: (r) => (r.status === 'tamamlandi' ? <Badge tone="green">Tamamlandı</Badge> : <Badge tone="amber">Taslak</Badge>) },
          { key: 'reviewer_name', header: 'Değerlendiren' },
          { key: 'updated_at', header: 'Güncelleme', render: (r) => formatDateTime(r.updated_at) },
        ]}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------

function PayrollTab({ employeeId }) {
  const { data, loading, error, reload } = useApi(`/payroll/employee/${employeeId}`);
  const navigate = useNavigate();
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <Card title="Bordro geçmişi" flush>
      <DataTable
        rows={data}
        onRowClick={(r) => navigate(`/bordro-pusulasi/${r.id}`)}
        empty={<EmptyState title="Bordro kaydı yok" icon={Wallet} />}
        columns={[
          { key: 'period', header: 'Dönem', sortValue: (r) => r.year * 100 + r.month, render: (r) => periodLabel(r.year, r.month) },
          { key: 'days', header: 'Gün', align: 'right' },
          { key: 'gross', header: 'Brüt', align: 'right', render: (r) => formatMoney(r.gross) },
          { key: 'income_tax', header: 'Gelir V.', align: 'right', render: (r) => formatMoney(r.income_tax) },
          { key: 'net', header: 'Net', align: 'right', render: (r) => <span className="strong">{formatMoney(r.net)}</span> },
          { key: 'employer_cost', header: 'İşveren maliyeti', align: 'right', render: (r) => formatMoney(r.employer_cost) },
          { key: 'run_status', header: 'Durum', render: (r) => (r.run_status === 'onaylandi' ? <Badge tone="green">Onaylı</Badge> : <Badge tone="amber">Taslak</Badge>) },
        ]}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------

function TerminateModal({ emp, onClose, onDone }) {
  const { exitCodes } = useLookups();
  const toast = useToast();
  const f = useForm({ exit_date: todayStr(), exit_code: '', exit_note: '' });
  const [calc, setCalc] = useState({ include_kidem: null, include_ihbar: null, extra_monthly: '', income_tax_rate: 15 });
  const [result, setResult] = useState(null);
  const [calcError, setCalcError] = useState(null);
  const code = exitCodes?.find((c) => c.code === f.values.exit_code);
  const includeKidem = calc.include_kidem ?? code?.kidem ?? false;
  const includeIhbar = calc.include_ihbar ?? code?.ihbar ?? false;

  // Çıkış bilgisi veya hesap seçenekleri değiştikçe tazminatı yeniden hesapla.
  useEffect(() => {
    if (!f.values.exit_date || f.values.exit_date < emp.hire_date) {
      setResult(null);
      return undefined;
    }
    const t = setTimeout(() => {
      api
        .post(`/employees/${emp.id}/severance`, {
          exit_date: f.values.exit_date,
          exit_code: f.values.exit_code || undefined,
          include_kidem: includeKidem,
          include_ihbar: includeIhbar,
          extra_monthly: Number(calc.extra_monthly) || 0,
          income_tax_rate: (Number(calc.income_tax_rate) || 0) / 100,
        })
        .then((r) => {
          setResult(r);
          setCalcError(null);
        })
        .catch((err) => setCalcError(err.message));
    }, 250);
    return () => clearTimeout(t);
  }, [emp.id, emp.hire_date, f.values.exit_date, f.values.exit_code, includeKidem, includeIhbar, calc.extra_monthly, calc.income_tax_rate]);

  const submit = () =>
    f.submit(async (v) => {
      const res = await api.post(`/employees/${emp.id}/terminate`, v);
      toast.success('İşten çıkış kaydedildi.');
      if (res.open_assets) toast.info(`Personelin üzerinde ${res.open_assets} adet iade edilmemiş zimmet var. Zimmet ekranından iade alın.`);
      onDone();
    });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`İşten çıkış – ${emp.first_name} ${emp.last_name}`}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn btn-danger" onClick={submit} disabled={f.submitting}>
            <UserMinus size={16} /> İşten çıkışı kaydet
          </button>
        </>
      }
    >
      <div className="stack">
        {f.formError && <Alert tone="error">{f.formError}</Alert>}
        <div className="form-grid">
          <Field label="İşten çıkış tarihi (son çalışma günü)" error={f.errors.exit_date} htmlFor="f-exit_date" required>
            <input className="input" type="date" {...f.bind('exit_date')} min={emp.hire_date} />
          </Field>
          <Field label="SGK çıkış nedeni" error={f.errors.exit_code} htmlFor="f-exit_code" required>
            <select className="select" {...f.bind('exit_code')}>
              <option value="">Seçiniz</option>
              {(exitCodes ?? []).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} – {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Açıklama" htmlFor="f-exit_note" className="full">
            <textarea className="textarea" rows={2} {...f.bind('exit_note')} />
          </Field>
        </div>

        <div className="card" style={{ boxShadow: 'none' }}>
          <div className="card-header">
            <h3 className="row">
              <Calculator size={16} /> Tazminat ön hesabı
            </h3>
            <span className="hint">Tahminidir; kesin tutar için mali müşavir onayı alınız.</span>
          </div>
          <div className="card-body stack" style={{ gap: 14 }}>
            <div className="form-grid">
              <label className="checkbox">
                <input type="checkbox" checked={includeKidem} onChange={(e) => setCalc((c) => ({ ...c, include_kidem: e.target.checked }))} /> Kıdem tazminatı hesaplansın
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={includeIhbar} onChange={(e) => setCalc((c) => ({ ...c, include_ihbar: e.target.checked }))} /> İhbar tazminatı hesaplansın
              </label>
              <Field label="Giydirilmiş ücret ekleri (aylık, brüt)" hint="Düzenli yemek, yol, ikramiye vb. aylık ortalaması" htmlFor="extra_monthly">
                <input
                  id="extra_monthly"
                  className="input"
                  type="number"
                  min="0"
                  value={calc.extra_monthly}
                  onChange={(e) => setCalc((c) => ({ ...c, extra_monthly: e.target.value }))}
                />
              </Field>
              <Field label="İhbar için gelir vergisi oranı (%)" htmlFor="income_tax_rate">
                <select id="income_tax_rate" className="select" value={calc.income_tax_rate} onChange={(e) => setCalc((c) => ({ ...c, income_tax_rate: e.target.value }))}>
                  {[15, 20, 27, 35, 40].map((r) => (
                    <option key={r} value={r}>
                      %{r}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {calcError && <Alert tone="error">{calcError}</Alert>}
            {result && (
              <div className="grid grid-2">
                <KeyValue
                  items={[
                    ['Hizmet süresi', `${formatTenure(emp.hire_date, f.values.exit_date)} (${formatNumber(result.tenureDays)} gün)`],
                    ['Giydirilmiş brüt ücret', formatMoney(result.dressedGross)],
                    ['Kıdeme esas ücret', `${formatMoney(result.kidem.base)}${result.kidem.capped ? ' (tavan)' : ''}`],
                    ['Kıdem tazminatı (brüt)', result.kidem.eligible ? formatMoney(result.kidem.gross) : 'Hak yok'],
                    ['Damga vergisi', formatMoney(result.kidem.stampTax)],
                    ['Kıdem tazminatı (net)', <b>{formatMoney(result.kidem.net)}</b>],
                  ]}
                />
                <KeyValue
                  items={[
                    ['İhbar süresi', `${result.ihbar.weeks} hafta`],
                    ['İhbar tazminatı (brüt)', result.ihbar.eligible ? formatMoney(result.ihbar.gross) : 'Hesaplanmadı'],
                    ['Gelir + damga vergisi', formatMoney(result.ihbar.incomeTax + result.ihbar.stampTax)],
                    ['İhbar tazminatı (net)', <b>{formatMoney(result.ihbar.net)}</b>],
                    ['Kullanılmayan izin', `${formatDays(result.unusedLeave.days)} · ${formatMoney(result.unusedLeave.gross)} brüt`],
                    ['Toplam (brüt)', <b>{formatMoney(result.totalGross)}</b>],
                  ]}
                />
              </div>
            )}
            {result && !result.kidem.eligible && includeKidem && (
              <Alert tone="warning">Kıdem tazminatı için en az 1 yıllık hizmet süresi gerekir.</Alert>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
