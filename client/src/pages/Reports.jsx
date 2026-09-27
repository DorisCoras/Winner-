import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  Building2,
  CalendarDays,
  CalendarCheck,
  Download,
  Landmark,
  LogIn,
  LogOut,
  Percent,
  PieChart,
  Repeat,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { qs, useApi } from '../api.js';
import { useLookups } from '../lookups.jsx';
import { downloadCsv } from '../csv.js';
import {
  formatDays,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatPercent,
  matches,
  MONTHS,
  MONTHS_SHORT,
} from '../format.js';
import { BarList, ColumnChart, SplitBar } from '../components/charts.jsx';
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  PersonCell,
  SearchInput,
  StatCard,
  Tabs,
} from '../components/ui.jsx';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

const TABS = [
  { key: 'personel', label: 'Personel Dağılımı', icon: Users, filters: ['company'] },
  { key: 'giris-cikis', label: 'Giriş-Çıkış', icon: Repeat, filters: ['year', 'company'] },
  { key: 'izin', label: 'İzin Kullanımı', icon: CalendarDays, filters: ['year', 'company'] },
  { key: 'bordro', label: 'Bordro Maliyeti', icon: Wallet, filters: ['year'] },
];

const toItems = (list) => (list ?? []).map((x) => ({ label: x.label, value: x.count }));

export default function Reports() {
  const { companies } = useLookups();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get('tab')) ?? TABS[0];
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [companyId, setCompanyId] = useState('');

  const setTab = (key) => {
    const next = new URLSearchParams(params);
    next.set('tab', key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader title="Raporlar" subtitle="Personel, giriş-çıkış, izin ve bordro maliyeti analizleri." />
      <Tabs tabs={TABS} active={tab.key} onChange={setTab} />

      <div className="toolbar">
        {tab.filters.includes('year') && (
          <select className="select" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Yıl">
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
        {tab.filters.includes('company') && (
          <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Şirket">
            <option value="">Tüm şirketler</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {tab.key === 'giris-cikis' || tab.key === 'bordro' ? (
          <span className="small muted">Tüm şirketler dahildir.</span>
        ) : null}
      </div>

      {tab.key === 'personel' && <HeadcountReport companyId={companyId} />}
      {tab.key === 'giris-cikis' && <TurnoverReport year={year} companyId={companyId} />}
      {tab.key === 'izin' && <LeaveUsageReport year={year} companyId={companyId} />}
      {tab.key === 'bordro' && <PayrollCostReport year={year} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Personel dağılımı
// ---------------------------------------------------------------------------

const GENDER_ORDER = ['Kadın', 'Erkek', 'Belirtilmemiş'];

function HeadcountReport({ companyId }) {
  const { data, loading, error, reload } = useApi(`/reports/headcount${qs({ company_id: companyId })}`);
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  if (!data) return null;
  if (!data.total) {
    return (
      <Card>
        <EmptyState title="Aktif personel bulunamadı">Seçilen şirkette aktif personel kaydı yok.</EmptyState>
      </Card>
    );
  }

  const departments = toItems(data.by_department);
  const topDepartments = departments.slice(0, 12);
  const gender = [...data.by_gender]
    .sort((a, b) => GENDER_ORDER.indexOf(a.label) - GENDER_ORDER.indexOf(b.label))
    .map((x) => ({ label: x.label, value: x.count }));
  const women = data.by_gender.find((x) => x.label === 'Kadın')?.count ?? 0;
  const salaryTotal = data.by_company.reduce((s, c) => s + (c.avg_salary ?? 0) * c.count, 0);
  const avgSalary = data.total ? salaryTotal / data.total : 0;

  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatCard icon={Users} label="Aktif personel" value={formatNumber(data.total)} sub={`${data.by_company.length} şirket`} />
        <StatCard icon={Building2} tone="teal" label="Departman" value={formatNumber(departments.length)} />
        <StatCard icon={PieChart} tone="green" label="Kadın çalışan oranı" value={formatPercent((women / data.total) * 100)} sub={`${women} kişi`} />
        <StatCard icon={Banknote} tone="amber" label="Ortalama brüt maaş" value={formatMoney(avgSalary, { whole: true })} />
      </div>

      <div className="grid grid-2">
        <Card title="Şirketlere göre">
          <BarList items={toItems(data.by_company)} />
        </Card>
        <Card title="Cinsiyet dağılımı">
          <SplitBar items={gender} />
        </Card>
        <Card
          title="Departmanlara göre"
          hint={departments.length > 12 ? `En kalabalık 12 departman gösteriliyor.` : undefined}
          className="span-2"
        >
          <BarList items={topDepartments} />
          {departments.length > 12 && <div className="small muted mt-2">ve {departments.length - 12} departman daha</div>}
        </Card>
        <Card title="Yaş grupları">
          <BarList items={toItems(data.by_age)} />
        </Card>
        <Card title="Kıdem (şirkette çalışma süresi)">
          <BarList items={toItems(data.by_tenure)} />
        </Card>
        <Card title="Çalışma şekli">
          <BarList items={toItems(data.by_employment_type)} />
        </Card>
        <Card title="Eğitim durumu">
          <BarList items={toItems(data.by_education)} />
        </Card>
      </div>

      <Card title="Şirket bazında ortalama brüt maaş" flush>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Şirket</th>
                <th className="num">Aktif personel</th>
                <th className="num">Ortalama brüt maaş</th>
                <th className="num">Aylık brüt maaş toplamı</th>
              </tr>
            </thead>
            <tbody>
              {data.by_company.map((c) => (
                <tr key={c.label}>
                  <td>{c.label}</td>
                  <td className="num">{formatNumber(c.count)}</td>
                  <td className="num">{formatMoney(c.avg_salary)}</td>
                  <td className="num">{formatMoney((c.avg_salary ?? 0) * c.count, { whole: true })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Toplam</td>
                <td className="num">{formatNumber(data.total)}</td>
                <td className="num">{formatMoney(avgSalary)}</td>
                <td className="num">{formatMoney(salaryTotal, { whole: true })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Giriş-çıkış
// ---------------------------------------------------------------------------

function TurnoverReport({ year, companyId }) {
  const { exitCode } = useLookups();
  const { data, loading, error, reload } = useApi(`/reports/turnover${qs({ year, company_id: companyId })}`);
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  if (!data) return null;

  const chartData = data.months.map((m) => ({
    label: MONTHS_SHORT[m.month - 1],
    title: `${MONTHS[m.month - 1]} ${data.year}`,
    hires: m.hires,
    exits: m.exits,
  }));
  const isFuture = (m) => !!data.months[m - 1]?.future;
  const totalReasons = data.exit_reasons.reduce((s, r) => s + r.count, 0);

  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatCard icon={LogIn} tone="green" label="İşe giriş" value={formatNumber(data.total_hires)} sub={`${data.year} yılı`} />
        <StatCard icon={LogOut} tone="red" label="Ayrılış" value={formatNumber(data.total_exits)} sub={`${data.year} yılı`} />
        <StatCard icon={Users} label="Ortalama personel" value={formatNumber(data.average_headcount, 1)} sub="Geçen ayların ay sonu ortalaması" />
        <StatCard icon={Percent} tone="amber" label="Personel devir oranı" value={formatPercent(data.turnover_rate)} sub="Ayrılış / ortalama personel" />
      </div>

      <Card title="Aylık işe giriş ve ayrılışlar">
        <ColumnChart
          data={chartData}
          series={[
            { key: 'hires', label: 'İşe giriş' },
            { key: 'exits', label: 'Ayrılış' },
          ]}
          axisFormat={(v) => (Number.isInteger(v) ? formatNumber(v) : '')}
        />
      </Card>

      <div className="grid grid-2">
        <Card title="Aylık özet" flush>
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Ay</th>
                  <th className="num">İşe giriş</th>
                  <th className="num">Ayrılış</th>
                  <th className="num">Net değişim</th>
                  <th className="num">Ay sonu personel</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => {
                  const diff = m.hires - m.exits;
                  const future = isFuture(m.month);
                  return (
                    <tr key={m.month} className={future ? 'muted' : undefined}>
                      <td>{MONTHS[m.month - 1]}</td>
                      <td className="num">{formatNumber(m.hires)}</td>
                      <td className="num">{formatNumber(m.exits)}</td>
                      <td className={`num ${diff > 0 ? 'text-success' : diff < 0 ? 'text-danger' : ''}`}>
                        {diff > 0 ? `+${diff}` : formatNumber(diff)}
                      </td>
                      <td className="num">{future ? '—' : formatNumber(m.headcount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Toplam</td>
                  <td className="num">{formatNumber(data.total_hires)}</td>
                  <td className="num">{formatNumber(data.total_exits)}</td>
                  <td className="num">
                    {data.total_hires - data.total_exits > 0 ? '+' : ''}
                    {formatNumber(data.total_hires - data.total_exits)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <Card title="Ayrılış nedenleri" hint="SGK işten çıkış kodlarına göre" flush>
          {data.exit_reasons.length ? (
            <ul className="list">
              {data.exit_reasons.map((r) => (
                <li key={r.code ?? 'none'}>
                  {r.code ? <Badge>{r.code}</Badge> : <Badge>—</Badge>}
                  <div className="grow">
                    <div>{r.code ? (exitCode(r.code)?.label ?? `Kod ${r.code}`) : 'Belirtilmemiş'}</div>
                    <div className="small muted">%{Math.round((r.count / totalReasons) * 100)}</div>
                  </div>
                  <span className="strong num">{formatNumber(r.count)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Ayrılış kaydı yok">{data.year} yılında ayrılan personel bulunmuyor.</EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// İzin kullanımı
// ---------------------------------------------------------------------------

function LeaveUsageReport({ year, companyId }) {
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useApi(`/reports/leave-usage${qs({ year, company_id: companyId })}`);

  const usedTypes = useMemo(() => {
    if (!data) return [];
    const used = new Set();
    for (const e of data.employees) for (const [code, days] of Object.entries(e.used_by_type)) if (days > 0) used.add(code);
    return data.types.filter((t) => used.has(t.code));
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.employees
      .map((e) => ({ ...e, used_total: Object.values(e.used_by_type).reduce((s, d) => s + d, 0) }))
      .filter((e) => matches(`${e.name} ${e.sicil_no ?? ''} ${e.department ?? ''} ${e.company}`, search));
  }, [data, search]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  if (!data) return null;

  // Sunucunun `totals` alanı şirket filtresini dikkate almadığından, şirket seçiliyken türe göre toplamlar
  // personel satırlarından (seçili şirketin aktif personeli) hesaplanır.
  const typeTotals = companyId
    ? data.types.map((t) => ({ ...t, days: data.employees.reduce((s, e) => s + (e.used_by_type[t.code] ?? 0), 0) }))
    : data.totals;
  const totalDays = typeTotals.reduce((s, t) => s + t.days, 0);
  const annualDays = typeTotals.find((t) => t.code === 'yillik')?.days ?? 0;
  const usersOfLeave = data.employees.filter((e) => Object.values(e.used_by_type).some((d) => d > 0)).length;
  const avgBalance = data.employees.length ? data.employees.reduce((s, e) => s + e.balance, 0) / data.employees.length : 0;
  const typeItems = typeTotals.filter((t) => t.days > 0).map((t) => ({ label: t.name, value: t.days }));

  const exportCsv = () => {
    downloadCsv(
      `izin-kullanim-${data.year}.csv`,
      [
        { header: 'Sicil No', value: (r) => r.sicil_no },
        { header: 'Ad Soyad', value: (r) => r.name },
        { header: 'Şirket', value: (r) => r.company },
        { header: 'Departman', value: (r) => r.department },
        { header: 'Kıdem (yıl)', value: (r) => r.service_years },
        { header: 'Toplam hak edilen yıllık izin', value: (r) => r.earned_total },
        { header: 'Kalan yıllık izin', value: (r) => r.balance },
        ...data.types.map((t) => ({ header: `${t.name} (${data.year})`, value: (r) => r.used_by_type[t.code] ?? 0 })),
        { header: `Toplam kullanılan (${data.year})`, value: (r) => r.used_total },
      ],
      rows,
    );
  };

  const columns = [
    { key: 'sicil_no', header: 'Sicil', className: 'nowrap' },
    {
      key: 'name',
      header: 'Personel',
      render: (r) => <PersonCell size="sm" name={r.name} to={`/personel/${r.id}`} sub={[r.company, r.department].filter(Boolean).join(' · ')} />,
    },
    {
      key: 'balance',
      header: 'Kalan yıllık izin',
      align: 'right',
      render: (r) => <span className={`strong ${r.balance < 0 ? 'text-danger' : ''}`}>{formatDays(r.balance)}</span>,
    },
    ...usedTypes.map((t) => ({
      key: `type_${t.code}`,
      header: t.name,
      align: 'right',
      sortValue: (r) => r.used_by_type[t.code] ?? 0,
      render: (r) => (r.used_by_type[t.code] ? formatNumber(r.used_by_type[t.code]) : <span className="muted">—</span>),
    })),
    { key: 'used_total', header: 'Toplam kullanılan', align: 'right', render: (r) => formatDays(r.used_total) },
  ];

  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatCard icon={CalendarDays} label="Kullanılan izin" value={formatDays(totalDays)} sub={`${data.year} · onaylı talepler`} />
        <StatCard icon={CalendarCheck} tone="green" label="Kullanılan yıllık izin" value={formatDays(annualDays)} />
        <StatCard
          icon={UserCheck}
          tone="teal"
          label="İzin kullanan personel"
          value={formatNumber(usersOfLeave)}
          sub={`${formatNumber(data.employees.length)} aktif personelden`}
        />
        <StatCard icon={Users} tone="amber" label="Ortalama kalan yıllık izin" value={formatDays(avgBalance)} sub="Aktif personel başına" />
      </div>

      <Card
        title="İzin türüne göre kullanılan gün"
        hint={companyId ? 'Seçili şirketin aktif personeli; onaylanmış talepler' : 'Tüm şirketler; onaylanmış talepler'}
      >
        <BarList items={typeItems} format={formatDays} />
      </Card>

      <Card
        title="Personel bazında izin durumu"
        hint={`Kalan bakiye güncel; kullanılan günler ${data.year} yılına aittir.`}
        actions={
          <button className="btn btn-sm" onClick={exportCsv} disabled={!rows.length}>
            <Download size={15} /> CSV
          </button>
        }
        flush
      >
        <div style={{ padding: '12px 14px 0' }}>
          <div className="toolbar">
            <SearchInput value={search} onChange={setSearch} placeholder="Personel, sicil veya departman ara…" />
            <span className="small muted">{formatNumber(rows.length)} personel</span>
          </div>
        </div>
        <DataTable columns={columns} rows={rows} compact pageSize={50} initialSort={{ key: 'name', dir: 'asc' }} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bordro maliyeti
// ---------------------------------------------------------------------------

const COST_KEYS = ['employees', 'gross', 'net', 'income_tax', 'stamp_tax', 'sgk_employee', 'sgk_employer', 'employer_cost'];

function sumBy(rows, keys = COST_KEYS) {
  const t = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const r of rows) for (const k of keys) t[k] += r[k] ?? 0;
  return t;
}

function PayrollCostReport({ year }) {
  const { data, loading, error, reload } = useApi(`/reports/payroll-cost${qs({ year })}`);

  const rows = useMemo(() => (data?.rows ?? []).map((r, i) => ({ ...r, _id: `${r.company_id}-${r.month}-${i}` })), [data]);
  const totals = useMemo(() => sumBy(rows), [rows]);
  const byCompany = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.company_id)) map.set(r.company_id, { company_id: r.company_id, company_name: r.company_name, periods: 0, rows: [] });
      const g = map.get(r.company_id);
      g.periods += 1;
      g.rows.push(r);
    }
    return [...map.values()].map((g) => ({ ...g, ...sumBy(g.rows) }));
  }, [rows]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  if (!data) return null;

  if (!rows.length) {
    return (
      <Card>
        <EmptyState title={`${data.year} yılına ait bordro bulunamadı`} icon={Wallet}>
          Bordro Dönemleri sayfasından oluşturulan bordrolar bu raporda şirket ve ay bazında listelenir.
        </EmptyState>
      </Card>
    );
  }

  const chartData = MONTHS_SHORT.map((label, i) => ({
    label,
    title: `${MONTHS[i]} ${data.year}`,
    cost: rows.filter((r) => r.month === i + 1).reduce((s, r) => s + r.employer_cost, 0),
  }));
  const monthsWithData = new Set(rows.map((r) => r.month)).size;
  const drafts = rows.filter((r) => r.status === 'taslak').length;

  const exportCsv = () => {
    downloadCsv(
      `bordro-maliyeti-${data.year}.csv`,
      [
        { header: 'Şirket', value: (r) => r.company_name },
        { header: 'Ay', value: (r) => MONTHS[r.month - 1] },
        { header: 'Durum', value: (r) => (r.status === 'onaylandi' ? 'Onaylandı' : 'Taslak') },
        { header: 'Personel', value: (r) => r.employees },
        { header: 'Toplam Brüt', value: (r) => r.gross },
        { header: 'Toplam Net', value: (r) => r.net },
        { header: 'Gelir Vergisi', value: (r) => r.income_tax },
        { header: 'Damga Vergisi', value: (r) => r.stamp_tax },
        { header: 'SGK + İşsizlik (İşçi)', value: (r) => r.sgk_employee },
        { header: 'SGK + İşsizlik (İşveren)', value: (r) => r.sgk_employer },
        { header: 'İşveren Maliyeti', value: (r) => r.employer_cost },
      ],
      rows,
    );
  };

  const money = (key) => ({ key, align: 'right', render: (r) => formatMoney(r[key], { whole: true }) });
  const detailColumns = [
    { key: 'company_name', header: 'Şirket' },
    { key: 'month', header: 'Ay', render: (r) => MONTHS[r.month - 1] },
    {
      key: 'status',
      header: 'Durum',
      render: (r) => (r.status === 'onaylandi' ? <Badge tone="green">Onaylandı</Badge> : <Badge tone="amber">Taslak</Badge>),
    },
    { key: 'employees', header: 'Personel', align: 'right' },
    { ...money('gross'), header: 'Brüt' },
    { ...money('net'), header: 'Net' },
    { ...money('income_tax'), header: 'Gelir V.' },
    { ...money('stamp_tax'), header: 'Damga V.' },
    { ...money('sgk_employee'), header: 'SGK İşçi' },
    { ...money('sgk_employer'), header: 'SGK İşveren' },
    { ...money('employer_cost'), header: 'İşveren Maliyeti' },
  ];
  const totalCells = (t) => (
    <>
      <td className="num">{formatMoney(t.gross, { whole: true })}</td>
      <td className="num">{formatMoney(t.net, { whole: true })}</td>
      <td className="num">{formatMoney(t.income_tax, { whole: true })}</td>
      <td className="num">{formatMoney(t.stamp_tax, { whole: true })}</td>
      <td className="num">{formatMoney(t.sgk_employee, { whole: true })}</td>
      <td className="num">{formatMoney(t.sgk_employer, { whole: true })}</td>
      <td className="num">{formatMoney(t.employer_cost, { whole: true })}</td>
    </>
  );

  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatCard icon={Landmark} label="Toplam işveren maliyeti" value={formatMoneyCompact(totals.employer_cost)} sub={`${data.year} · ${monthsWithData} ay`} />
        <StatCard icon={Banknote} tone="teal" label="Toplam brüt" value={formatMoneyCompact(totals.gross)} />
        <StatCard icon={Wallet} tone="green" label="Toplam net ödeme" value={formatMoneyCompact(totals.net)} />
        <StatCard
          icon={BarChart3}
          tone="amber"
          label="Aylık ortalama maliyet"
          value={formatMoneyCompact(monthsWithData ? totals.employer_cost / monthsWithData : 0)}
          sub={drafts ? `${drafts} taslak bordro dahil` : 'Tümü onaylı bordrolar'}
        />
      </div>

      <Card title="Aylık toplam işveren maliyeti" hint="Tüm şirketlerin bordroları toplamı">
        <ColumnChart
          data={chartData}
          series={[{ key: 'cost', label: 'İşveren maliyeti' }]}
          format={(v) => formatMoney(v, { whole: true })}
          axisFormat={formatMoneyCompact}
        />
      </Card>

      <Card title="Şirket bazında yıllık toplam" flush>
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>Şirket</th>
                <th className="num">Dönem</th>
                <th className="num">Brüt</th>
                <th className="num">Net</th>
                <th className="num">Gelir V.</th>
                <th className="num">Damga V.</th>
                <th className="num">SGK İşçi</th>
                <th className="num">SGK İşveren</th>
                <th className="num">İşveren Maliyeti</th>
              </tr>
            </thead>
            <tbody>
              {byCompany.map((c) => (
                <tr key={c.company_id}>
                  <td>{c.company_name}</td>
                  <td className="num">{c.periods}</td>
                  {totalCells(c)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Toplam</td>
                <td className="num">{rows.length}</td>
                {totalCells(totals)}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card
        title="Şirket ve ay bazında detay"
        hint="SGK sütunları işsizlik sigortası payını da içerir."
        actions={
          <button className="btn btn-sm" onClick={exportCsv}>
            <Download size={15} /> CSV
          </button>
        }
        flush
      >
        <DataTable
          compact
          columns={detailColumns}
          rows={rows}
          rowKey="_id"
          pageSize={100}
          footer={
            <tr>
              <td colSpan={4}>Toplam ({rows.length} dönem)</td>
              {totalCells(totals)}
            </tr>
          }
        />
      </Card>
    </div>
  );
}
