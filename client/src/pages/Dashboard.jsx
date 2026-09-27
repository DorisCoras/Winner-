import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Briefcase,
  Cake,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileWarning,
  Hourglass,
  Megaphone,
  Package,
  PartyPopper,
  Pin,
  Plus,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { BarList, SplitBar } from '../components/charts.jsx';
import { Badge, Card, EmptyState, ErrorState, Loading, PageHeader, PersonCell, StatCard } from '../components/ui.jsx';
import { formatDate, formatDateLong, formatDateShort, formatDays, formatMoneyCompact, formatNumber, periodLabel, relativeDays, todayStr } from '../format.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

function ListCard({ title, icon: Icon, empty, items, render, action }) {
  return (
    <Card
      title={
        <span className="row">
          {Icon && <Icon size={16} className="muted" />}
          {title}
        </span>
      }
      actions={action}
      flush
    >
      {items?.length ? (
        <ul className="list">{items.map(render)}</ul>
      ) : (
        <div className="muted small" style={{ padding: '14px 18px' }}>
          {empty}
        </div>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { user, isHR, isManager } = useAuth();
  const { data, loading, error, reload } = useApi('/dashboard');

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const firstName = user.name.split(' ')[0];
  const hr = data.hr;
  const me = data.me;
  const genderLabels = { K: 'Kadın', E: 'Erkek', '-': 'Belirtilmemiş' };

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={formatDateLong(todayStr())}
        actions={
          <>
            {me && (
              <Link className="btn" to="/izinler?yeni=1">
                <CalendarDays size={16} /> İzin talebi
              </Link>
            )}
            {isHR && (
              <Link className="btn btn-primary" to="/personel/yeni">
                <UserPlus size={16} /> Personel ekle
              </Link>
            )}
          </>
        }
      />

      <div className="stack">
        {hr && (
          <div className="grid grid-4">
            <StatCard
              icon={Users}
              label="Aktif personel"
              value={formatNumber(hr.headcount)}
              sub={`Bu ay ${hr.new_hires_month} yeni giriş`}
              to="/personel"
            />
            <StatCard
              icon={ClipboardList}
              tone="amber"
              label="Onay bekleyen izin"
              value={formatNumber(hr.pending_approvals)}
              sub="İzin talepleri"
              to="/izinler"
            />
            <StatCard icon={CalendarCheck} tone="teal" label="Bugün izinli" value={formatNumber(hr.on_leave_today)} sub="Onaylı izinler" to="/izin-takvimi" />
            <StatCard
              icon={Briefcase}
              tone="green"
              label="Açık pozisyon"
              value={formatNumber(hr.open_positions)}
              sub={`${hr.active_candidates} aktif aday`}
              to="/ise-alim"
            />
          </div>
        )}

        {(me || data.team) && (
          <div className="grid grid-4">
            {me && (
              <StatCard
                icon={CalendarDays}
                label="Kullanılabilir yıllık izin"
                value={formatDays(me.leave_balance.available)}
                sub={
                  me.leave_balance.next
                    ? `${formatDate(me.leave_balance.next.date)} tarihinde +${me.leave_balance.next.days} gün`
                    : undefined
                }
                to="/profilim"
              />
            )}
            {me && (
              <StatCard
                icon={Hourglass}
                tone="amber"
                label="Onay bekleyen taleplerim"
                value={formatNumber(me.pending_requests)}
                to="/izinler"
              />
            )}
            {data.team && (
              <StatCard
                icon={UserCheck}
                tone="teal"
                label="Ekibim"
                value={formatNumber(data.team.size)}
                sub={`Bugün ${data.team.on_leave_today} kişi izinli`}
                to="/personel"
              />
            )}
            {data.team && (
              <StatCard
                icon={ClipboardList}
                tone="red"
                label="Ekip onayı bekleyen"
                value={formatNumber(data.team.pending_approvals)}
                to="/izinler"
              />
            )}
            {me && !data.team && (
              <StatCard icon={Package} tone="green" label="Zimmetimdeki demirbaş" value={formatNumber(me.open_assets)} to="/profilim?sekme=zimmet" />
            )}
            {hr?.monthly_payroll_cost && !data.team && (
              <StatCard
                icon={Wallet}
                tone="red"
                label={`Bordro maliyeti (${periodLabel(hr.monthly_payroll_cost.year, hr.monthly_payroll_cost.month)})`}
                value={formatMoneyCompact(hr.monthly_payroll_cost.cost)}
                sub={`Net ödeme ${formatMoneyCompact(hr.monthly_payroll_cost.net)}`}
                to="/bordro"
              />
            )}
          </div>
        )}

        <div className="grid grid-3">
          <div className="stack span-2">
            {hr && (
              <div className="grid grid-2">
                <Card title="Şirketlere göre personel">
                  <BarList items={data.by_company.map((c) => ({ label: c.short_name || c.name, value: c.count }))} />
                </Card>
                <Card title="Cinsiyet dağılımı" hint={`Aktif ${formatNumber(hr.headcount)} personel`}>
                  <SplitBar items={data.by_gender.map((g) => ({ label: genderLabels[g.gender] ?? g.gender, value: g.count }))} />
                  <div className="grid grid-2 mt-2" style={{ gap: 10 }}>
                    <div>
                      <div className="stat-label">Yıl içi giriş</div>
                      <div className="strong" style={{ fontSize: 18 }}>
                        {formatNumber(hr.hires_ytd)}
                      </div>
                    </div>
                    <div>
                      <div className="stat-label">Yıl içi ayrılış</div>
                      <div className="strong" style={{ fontSize: 18 }}>
                        {formatNumber(hr.exits_ytd)}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            <Card
              title={
                <span className="row">
                  <Megaphone size={16} className="muted" /> Duyurular
                </span>
              }
              actions={
                <Link className="btn btn-ghost btn-sm" to="/duyurular">
                  Tümü
                </Link>
              }
              flush
            >
              {data.announcements.length ? (
                <ul className="list">
                  {data.announcements.map((a) => (
                    <li key={a.id} style={{ alignItems: 'flex-start' }}>
                      <div className="grow">
                        <div className="row">
                          {a.pinned ? <Pin size={14} className="text-warning" aria-label="Sabitlenmiş" /> : null}
                          <span className="strong">{a.title}</span>
                        </div>
                        <div className="muted small" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {a.body.replace(/\s+/g, ' ')}
                        </div>
                      </div>
                      <div className="right small muted nowrap">
                        <div>{formatDate(a.created_at)}</div>
                        <Badge>{a.company_name ?? 'Tüm Grup'}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Henüz duyuru yok" icon={Megaphone} />
              )}
            </Card>

            {me && (
              <ListCard
                title="Yaklaşan izinlerim"
                icon={CalendarClock}
                empty="Planlanmış izniniz bulunmuyor."
                items={me.upcoming_leaves}
                action={
                  <Link className="btn btn-sm" to="/izinler?yeni=1">
                    <Plus size={14} /> Yeni talep
                  </Link>
                }
                render={(l) => (
                  <li key={l.id}>
                    <i className="dot" style={{ background: l.color }} />
                    <div className="grow">
                      <div className="strong">{l.leave_type_name}</div>
                      <div className="muted small">
                        {formatDate(l.start_date)} – {formatDate(l.end_date)} · {formatDays(l.days)}
                      </div>
                    </div>
                    <Badge tone={l.status === 'onaylandi' ? 'green' : 'amber'}>{l.status === 'onaylandi' ? 'Onaylandı' : 'Onay bekliyor'}</Badge>
                  </li>
                )}
              />
            )}

            {hr && (
              <div className="grid grid-2">
                <ListCard
                  title="Eksik özlük belgeleri"
                  icon={FileWarning}
                  empty="Tüm zorunlu belgeler tamam."
                  items={data.missing_documents}
                  render={(m) => (
                    <li key={m.id}>
                      <div className="grow">
                        <Link to={`/personel/${m.id}?sekme=belgeler`} className="strong">
                          {m.name}
                        </Link>
                        <div className="muted small">{m.company}</div>
                      </div>
                      <Badge tone="amber">{m.missing} eksik</Badge>
                    </li>
                  )}
                />
                <ListCard
                  title="Süresi dolan / dolacak belgeler"
                  icon={AlertTriangle}
                  empty="Yakın zamanda süresi dolacak belge yok."
                  items={data.expiring_documents}
                  render={(d) => (
                    <li key={`${d.id}-${d.doc_type}`}>
                      <div className="grow">
                        <Link to={`/personel/${d.id}?sekme=belgeler`} className="strong">
                          {d.name}
                        </Link>
                        <div className="muted small">{d.doc_label}</div>
                      </div>
                      <Badge tone={d.expiry_date < todayStr() ? 'red' : 'amber'}>{formatDate(d.expiry_date)}</Badge>
                    </li>
                  )}
                />
              </div>
            )}
          </div>

          <div className="stack">
            <ListCard
              title="Bugün izinde olanlar"
              icon={CalendarCheck}
              empty="Bugün izinli personel yok."
              items={data.on_leave_today}
              render={(p) => (
                <li key={`${p.employee_id}-${p.end_date}`}>
                  <div className="grow">
                    <PersonCell name={p.employee_name} sub={p.department_name ?? p.position} size="sm" />
                  </div>
                  <div className="right small">
                    <Badge dot={p.color}>{p.leave_type_name}</Badge>
                    <div className="muted">{formatDateShort(p.end_date)} tarihine kadar</div>
                  </div>
                </li>
              )}
            />

            <ListCard
              title="Yaklaşan resmi tatiller"
              icon={PartyPopper}
              empty="Tanımlı resmi tatil yok."
              items={data.upcoming_holidays}
              render={(h) => (
                <li key={h.date}>
                  <div className="grow">
                    <div className="strong">{h.name}</div>
                    <div className="muted small">
                      {formatDateLong(h.date)}
                      {h.half_day ? ' · yarım gün' : ''}
                    </div>
                  </div>
                  <span className="muted small nowrap">{relativeDays(h.date)}</span>
                </li>
              )}
            />

            <ListCard
              title="İş yıldönümleri"
              icon={Cake}
              empty="Önümüzdeki 30 günde yıldönümü yok."
              items={data.work_anniversaries}
              render={(a) => (
                <li key={a.id}>
                  <div className="grow">
                    <PersonCell name={a.name} sub={`${a.position ?? ''} · ${a.company}`} size="sm" />
                  </div>
                  <div className="right small">
                    <Badge tone="blue">{a.years}. yıl</Badge>
                    <div className="muted">{formatDateShort(a.date)}</div>
                  </div>
                </li>
              )}
            />

            {hr && (
              <ListCard
                title="Deneme süresi bitenler"
                icon={Hourglass}
                empty="Önümüzdeki 30 günde deneme süresi biten yok."
                items={data.probation_ending}
                render={(p) => (
                  <li key={p.id}>
                    <div className="grow">
                      <Link to={`/personel/${p.id}`} className="strong">
                        {p.name}
                      </Link>
                      <div className="muted small">{p.position}</div>
                    </div>
                    <span className="small nowrap">{formatDate(p.date)}</span>
                  </li>
                )}
              />
            )}

            {hr && (
              <ListCard
                title="Yaklaşan doğum günleri"
                icon={Cake}
                empty="Önümüzdeki 14 günde doğum günü yok."
                items={data.birthdays}
                render={(b) => (
                  <li key={b.id}>
                    <div className="grow">
                      <PersonCell name={b.name} sub={b.company} size="sm" />
                    </div>
                    <span className="small nowrap">{formatDateShort(b.date)}</span>
                  </li>
                )}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
