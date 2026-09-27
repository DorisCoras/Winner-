import { Link, useSearchParams } from 'react-router-dom';
import {
  Award,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  FileText,
  Hourglass,
  KeyRound,
  Mail,
  Package,
  Phone,
  Printer,
  UserRound,
} from 'lucide-react';
import { useApi } from '../api.js';
import { ROLE_LABELS, useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import ChangePasswordForm from '../components/ChangePasswordForm.jsx';
import {
  Alert,
  Avatar,
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  KeyValue,
  Loading,
  PageHeader,
  StatCard,
  Tabs,
} from '../components/ui.jsx';
import { addDaysStr, formatDate, formatDays, formatNumber, formatTenure, relativeDays, todayStr } from '../format.js';

const TABS = [
  { key: 'bilgiler', label: 'Bilgilerim', icon: UserRound },
  { key: 'izin', label: 'İzin Hakkım', icon: CalendarCheck },
  { key: 'zimmet', label: 'Zimmetlerim', icon: Package },
  { key: 'belgeler', label: 'Belgelerim', icon: FileText },
  { key: 'sifre', label: 'Şifre', icon: KeyRound },
];

const GENDERS = { K: 'Kadın', E: 'Erkek' };

function formatIban(iban) {
  if (!iban) return null;
  return String(iban)
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

// ---------------------------------------------------------------------------
// Üst bilgi kartı
// ---------------------------------------------------------------------------

function ProfileHeader({ e, role }) {
  const name = `${e.first_name} ${e.last_name}`;
  return (
    <Card className="mb-2">
      <div className="row wrap" style={{ gap: 16, alignItems: 'center' }}>
        <Avatar name={name} size="lg" />
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <h2>{name}</h2>
            <Badge tone="blue">{ROLE_LABELS[role] ?? role}</Badge>
          </div>
          <div className="muted">{e.position || 'Pozisyon belirtilmemiş'}</div>
          <div className="small mt-1">
            {e.company_name}
            {e.department_name ? ` / ${e.department_name}` : ''}
          </div>
          {(e.email || e.phone) && (
            <div className="row wrap small muted mt-1" style={{ gap: 14 }}>
              {e.email && (
                <span className="row" style={{ gap: 5 }}>
                  <Mail size={14} /> {e.email}
                </span>
              )}
              {e.phone && (
                <span className="row" style={{ gap: 5 }}>
                  <Phone size={14} /> {e.phone}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="small" style={{ flex: '0 0 auto' }}>
          <div className="muted">İşe giriş</div>
          <div className="strong">{formatDate(e.hire_date)}</div>
          <div className="muted">{formatTenure(e.hire_date)}</div>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sekmeler
// ---------------------------------------------------------------------------

function InfoTab({ e }) {
  const { employmentTypes = {} } = useLookups();
  return (
    <>
      <Alert tone="info">Bilgilerinizde değişiklik için İK birimine başvurun.</Alert>
      <div className="grid grid-2 mt-2">
        <Card title="Kişisel bilgiler">
          <KeyValue
            items={[
              ['T.C. Kimlik No', e.tc_kimlik],
              ['Doğum tarihi', e.birth_date ? `${formatDate(e.birth_date)}${e.age != null ? ` (${e.age} yaş)` : ''}` : null],
              ['Cinsiyet', GENDERS[e.gender]],
              ['Medeni durum', e.marital_status],
              ['Kan grubu', e.blood_type],
              ['Eğitim', e.education],
              ['Adres', e.address],
              ['Şehir', e.city],
              ['Acil durum kişisi', e.emergency_contact],
              ['Acil durum telefonu', e.emergency_phone],
            ]}
          />
        </Card>
        <Card title="İş bilgileri">
          <KeyValue
            items={[
              ['Sicil no', e.sicil_no],
              ['Şirket', e.company_name],
              ['Departman', e.department_name],
              ['Pozisyon', e.position],
              ['Yönetici', e.manager_name],
              ['İşe giriş tarihi', formatDate(e.hire_date)],
              ['Kıdem', formatTenure(e.hire_date)],
              ['Çalışma şekli', employmentTypes[e.employment_type] ?? e.employment_type],
              ['SGK sicil no', e.sgk_no],
              ['IBAN', e.iban ? <span className="mono">{formatIban(e.iban)}</span> : null],
            ]}
          />
        </Card>
      </div>
    </>
  );
}

function signedDays(n) {
  return `${n > 0 ? '+' : ''}${formatDays(n)}`;
}

function LeaveTab({ b }) {
  if (!b) return <EmptyState title="İzin bilgisi bulunamadı" />;
  // baseDate (devir tarihi) varsa: carryover o tarihteki devreden bakiye, earned yalnızca sonraki yıldönümleri.
  // baseDate yoksa: carryover isteğe bağlı ± düzeltme (0 ise gösterilmez).
  const base = b.baseDate;
  const hasUncounted = b.history.some((h) => h.counted === false);

  return (
    <>
      <div className="grid grid-4">
        <StatCard
          icon={CalendarCheck}
          tone={b.available < 0 ? 'red' : 'green'}
          label="Kullanılabilir bakiye"
          value={formatDays(b.available)}
          sub="Onay bekleyenler düşülmüş"
        />
        <StatCard
          icon={Award}
          label="Toplam bakiye"
          value={formatDays(b.balance)}
          sub={
            base
              ? `Devreden ${formatNumber(b.carryover)} · hak edilen ${formatNumber(b.earned)} · kullanılan ${formatNumber(b.used)} gün`
              : `Hak edilen ${formatNumber(b.earned)} · kullanılan ${formatNumber(b.used)} gün`
          }
        />
        <StatCard icon={Hourglass} tone="amber" label="Onay bekleyen" value={formatDays(b.pending)} sub="Yıllık izin talepleri" />
        <StatCard
          icon={CalendarClock}
          tone="teal"
          label="Sonraki hak ediş"
          value={formatDate(b.next?.date)}
          sub={b.next ? `${formatDays(b.next.days)} · ${relativeDays(b.next.date)}` : undefined}
        />
      </div>

      <div className="grid grid-2 mt-2">
        <Card
          title="Hak ediş geçmişi"
          hint={`${b.serviceYears} tam hizmet yılı`}
          flush
          actions={
            <Link className="btn btn-sm" to="/izinler">
              İzin taleplerim
            </Link>
          }
        >
          {b.history.length === 0 ? (
            <EmptyState title="Henüz yıllık izin hak edişiniz yok">
              {b.next ? `İlk hak ediş tarihiniz: ${formatDate(b.next.date)} (${formatDays(b.next.days)}).` : null}
            </EmptyState>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table compact">
                  <thead>
                    <tr>
                      <th>Hizmet yılı</th>
                      <th>Hak ediş tarihi</th>
                      <th className="num">Gün</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.history.map((h) =>
                      h.counted === false ? (
                        <tr key={h.year} className="muted" title="Devreden bakiyeye dahil">
                          <td>{h.year}. yıl</td>
                          <td>{formatDate(h.date)}</td>
                          <td className="num">({formatDays(h.days)})</td>
                        </tr>
                      ) : (
                        <tr key={h.year}>
                          <td>{h.year}. yıl</td>
                          <td>{formatDate(h.date)}</td>
                          <td className="num">{formatDays(h.days)}</td>
                        </tr>
                      ),
                    )}
                    {b.next && (
                      <tr>
                        <td className="muted">{b.next.year}. yıl</td>
                        <td className="muted">
                          {formatDate(b.next.date)} <Badge>Gelecek</Badge>
                        </td>
                        <td className="num muted">{formatDays(b.next.days)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>{base ? 'Devir tarihinden sonra hak edilen' : 'Toplam hak edilen'}</td>
                      <td className="num">{formatDays(b.earned)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {hasUncounted && (
                <div className="muted small" style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
                  Parantez içindeki günler {formatDate(base)} tarihli devreden bakiyeye dahildir.
                </div>
              )}
            </>
          )}
        </Card>

        <Card title="Bakiye hesabı">
          <KeyValue
            items={[
              base && [`Devreden bakiye (${formatDate(base)})`, formatDays(b.carryover)],
              [base ? 'Devir sonrası hak edilen' : 'Hak edilen', formatDays(b.earned)],
              !base && b.carryover ? ['Düzeltme', signedDays(b.carryover)] : null,
              [base ? 'Devir sonrası kullanılan' : 'Kullanılan', b.used ? `− ${formatDays(b.used)}` : '0 gün'],
              ['Toplam bakiye', <b>{formatDays(b.balance)}</b>],
              ['Onay bekleyen', b.pending ? `− ${formatDays(b.pending)}` : '0 gün'],
              ['Kullanılabilir', <b className={b.available < 0 ? 'text-danger' : 'text-success'}>{formatDays(b.available)}</b>],
            ]}
          />
          <p className="muted small mt-2" style={{ marginBottom: 0 }}>
            4857 sayılı İş Kanunu (m.53) uyarınca yıllık izin süresi; 1–5 yıl hizmette 14 gün, 5–15 yıl arasında 20 gün, 15 yıl ve
            üzerinde 26 gündür. 18 yaş ve altı ile 50 yaş ve üzeri çalışanlara en az 20 gün verilir.
          </p>
        </Card>
      </div>
    </>
  );
}

function AssetTable({ rows, returned }) {
  const columns = [
    {
      key: 'asset_name',
      header: 'Demirbaş',
      render: (a) => (
        <div>
          <div className="strong">{a.asset_name}</div>
          <div className="muted small">{a.category}</div>
        </div>
      ),
    },
    { key: 'serial_no', header: 'Seri no', render: (a) => (a.serial_no ? <span className="mono">{a.serial_no}</span> : '—') },
    { key: 'assigned_at', header: 'Zimmet tarihi', render: (a) => formatDate(a.assigned_at) },
    returned && { key: 'returned_at', header: 'İade tarihi', render: (a) => formatDate(a.returned_at) },
    {
      key: '_receipt',
      header: '',
      align: 'right',
      render: (a) => (
        <Link className="btn btn-sm btn-ghost" to={`/yazdir/zimmet/${a.id}`}>
          <Printer size={14} /> Tutanak
        </Link>
      ),
    },
  ].filter(Boolean);
  return <DataTable columns={columns} rows={rows} compact />;
}

function AssetsTab({ employeeId }) {
  const { data, error, reload } = useApi(`/employees/${employeeId}/assets`);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const active = data.filter((a) => !a.returned_at);
  const returned = data.filter((a) => a.returned_at);
  return (
    <>
      <Card title="Üzerimdeki zimmetler" hint={`${active.length} demirbaş`} flush>
        {active.length ? (
          <AssetTable rows={active} />
        ) : (
          <EmptyState title="Üzerinize zimmetli demirbaş bulunmuyor" icon={Package} />
        )}
      </Card>
      {returned.length > 0 && (
        <Card title="İade edilenler" hint={`${returned.length} demirbaş`} flush className="mt-2">
          <AssetTable rows={returned} returned />
        </Card>
      )}
      <p className="muted small mt-2">Zimmetinizdeki demirbaşlarla ilgili arıza, kayıp veya iade işlemleri için İK birimine başvurun.</p>
    </>
  );
}

function DocumentsTab({ employeeId }) {
  const { data, error, reload } = useApi(`/employees/${employeeId}/documents`);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const today = todayStr();
  const soon = addDaysStr(today, 30);
  const required = data.filter((d) => d.required);
  const done = required.filter((d) => d.record).length;
  const missing = required.length - done;

  return (
    <Card
      title="Özlük dosyası belgeleri"
      hint={`Zorunlu belgeler: ${done} / ${required.length} teslim edildi`}
      flush
    >
      <div style={{ padding: '14px 18px' }} className="stack">
        <div
          className="progress"
          role="progressbar"
          aria-label="Teslim edilen zorunlu belgeler"
          aria-valuemin={0}
          aria-valuemax={required.length}
          aria-valuenow={done}
        >
          <span style={{ width: `${required.length ? (done / required.length) * 100 : 100}%` }} />
        </div>
        {missing > 0 ? (
          <Alert tone="warning">
            {missing} zorunlu belgeniz eksik görünüyor. Eksik belgelerinizi en kısa sürede İK birimine teslim edin.
          </Alert>
        ) : (
          <Alert tone="success">Tüm zorunlu belgeleriniz teslim edilmiş.</Alert>
        )}
      </div>
      <ul className="list" style={{ borderTop: '1px solid var(--border)' }}>
        {data.map((d) => {
          const rec = d.record;
          const expiry = rec?.expiry_date;
          const expired = expiry && expiry < today;
          const expiring = expiry && !expired && expiry <= soon;
          return (
            <li key={d.code}>
              {rec ? (
                <CheckCircle2 size={18} className="text-success" aria-hidden="true" />
              ) : (
                <CircleAlert size={18} className={d.required ? 'text-danger' : 'muted'} aria-hidden="true" />
              )}
              <div className="grow">
                <div>{d.label}</div>
                <div className="muted small">
                  {d.required ? 'Zorunlu' : 'İsteğe bağlı'}
                  {rec?.received_date ? ` · Teslim: ${formatDate(rec.received_date)}` : ''}
                  {expiry ? ` · Geçerlilik: ${formatDate(expiry)}` : ''}
                </div>
                {expired && (
                  <div style={{ marginTop: 4 }}>
                    <Badge tone="red">Süresi doldu</Badge>
                  </div>
                )}
                {expiring && (
                  <div style={{ marginTop: 4 }}>
                    <Badge tone="amber">Süresi yaklaşıyor · {relativeDays(expiry)}</Badge>
                  </div>
                )}
              </div>
              {rec ? <Badge tone="green">Teslim edildi</Badge> : <Badge tone={d.required ? 'red' : ''}>Eksik</Badge>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function PasswordCard() {
  return (
    <div style={{ maxWidth: 520 }}>
      <Card title="Şifre değiştir" hint="Güvenliğiniz için şifrenizi kimseyle paylaşmayın.">
        <ChangePasswordForm />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sayfa
// ---------------------------------------------------------------------------

export default function Profile() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const employeeId = user.employee_id;
  const emp = useApi(employeeId ? `/employees/${employeeId}` : null);

  const requested = searchParams.get('sekme');
  const tab = TABS.some((t) => t.key === requested) ? requested : 'bilgiler';
  const changeTab = (key) => setSearchParams({ sekme: key }, { replace: true });

  // Personel kaydına bağlı olmayan hesaplar (ör. sistem yöneticisi): yalnızca şifre işlemleri.
  if (!employeeId) {
    return (
      <>
        <PageHeader title="Profilim" subtitle="Hesap ayarlarınız" />
        <div className="stack" style={{ maxWidth: 520 }}>
          <Card title="Hesap">
            <KeyValue
              items={[
                ['E-posta', user.email],
                ['Rol', ROLE_LABELS[user.role] ?? user.role],
              ]}
            />
            <div className="mt-2">
              <Alert tone="info">
                Hesabınız bir personel kaydına bağlı değil; bu nedenle burada yalnızca şifre işlemleri yapılabilir.
              </Alert>
            </div>
          </Card>
          <Card title="Şifre değiştir" hint="Güvenliğiniz için şifrenizi kimseyle paylaşmayın.">
            <ChangePasswordForm />
          </Card>
        </div>
      </>
    );
  }

  const e = emp.data;
  let body;
  if (tab === 'sifre') body = <PasswordCard />;
  else if (emp.error) body = <ErrorState error={emp.error} onRetry={emp.reload} />;
  else if (!e) body = <Loading />;
  else if (tab === 'izin') body = <LeaveTab b={e.leave_balance} />;
  else if (tab === 'zimmet') body = <AssetsTab employeeId={employeeId} />;
  else if (tab === 'belgeler') body = <DocumentsTab employeeId={employeeId} />;
  else body = <InfoTab e={e} />;

  return (
    <>
      <PageHeader title="Profilim" subtitle="Kişisel bilgileriniz, izin hakkınız, zimmetleriniz ve belgeleriniz." />
      {e && <ProfileHeader e={e} role={user.role} />}
      <Tabs tabs={TABS} active={tab} onChange={changeTab} />
      {body}
    </>
  );
}
