import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, UserPlus, Users } from 'lucide-react';
import { qs, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { downloadCsv } from '../csv.js';
import { useLookups } from '../lookups.jsx';
import { Card, DataTable, EmployeeStatusBadge, EmptyState, ErrorState, Loading, PageHeader, PersonCell, SearchInput } from '../components/ui.jsx';
import { formatDate, formatMoney, formatTenure, matches } from '../format.js';

export default function Employees() {
  const { isHR } = useAuth();
  const lookups = useLookups();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const company = params.get('sirket') ?? '';
  const department = params.get('departman') ?? '';
  const status = params.get('durum') ?? 'aktif';

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'sirket') next.delete('departman');
    setParams(next, { replace: true });
  };

  const { data, loading, error, reload } = useApi(
    `/employees${qs({ company_id: company, department_id: department, status })}`,
  );

  const rows = useMemo(
    () =>
      (data ?? []).filter((e) =>
        matches(`${e.first_name} ${e.last_name} ${e.sicil_no} ${e.position ?? ''} ${e.email ?? ''} ${e.department_name ?? ''}`, search),
      ),
    [data, search],
  );

  const columns = [
    {
      key: 'name',
      header: 'Personel',
      sortValue: (e) => `${e.first_name} ${e.last_name}`,
      render: (e) => <PersonCell name={`${e.first_name} ${e.last_name}`} sub={e.position} to={`/personel/${e.id}`} />,
    },
    { key: 'sicil_no', header: 'Sicil No', render: (e) => <span className="mono">{e.sicil_no}</span> },
    {
      key: 'company_name',
      header: 'Şirket / Departman',
      render: (e) => (
        <div>
          <div>{e.department_name ?? '—'}</div>
          <div className="muted small">{e.company_name}</div>
        </div>
      ),
    },
    { key: 'manager_name', header: 'Yönetici', render: (e) => e.manager_name ?? '—' },
    {
      key: 'hire_date',
      header: 'İşe Giriş',
      render: (e) => (
        <div className="nowrap">
          <div>{formatDate(e.hire_date)}</div>
          <div className="muted small">{formatTenure(e.hire_date, e.exit_date ?? undefined)}</div>
        </div>
      ),
    },
    ...(isHR
      ? [{ key: 'gross_salary', header: 'Brüt Maaş', align: 'right', render: (e) => formatMoney(e.gross_salary) }]
      : []),
    { key: 'status', header: 'Durum', render: (e) => <EmployeeStatusBadge status={e.status} /> },
  ];

  const exportCsv = () =>
    downloadCsv('personel-listesi.csv', [
      { header: 'Sicil No', value: (e) => e.sicil_no },
      { header: 'Ad', value: (e) => e.first_name },
      { header: 'Soyad', value: (e) => e.last_name },
      { header: 'Pozisyon', value: (e) => e.position },
      { header: 'Şirket', value: (e) => e.company_name },
      { header: 'Departman', value: (e) => e.department_name },
      { header: 'Yönetici', value: (e) => e.manager_name },
      { header: 'E-posta', value: (e) => e.email },
      { header: 'Telefon', value: (e) => e.phone },
      { header: 'İşe Giriş', value: (e) => formatDate(e.hire_date) },
      { header: 'Çalışma Şekli', value: (e) => lookups.employmentTypes?.[e.employment_type] ?? e.employment_type },
      ...(isHR ? [{ header: 'Brüt Maaş', value: (e) => e.gross_salary }] : []),
      { header: 'Durum', value: (e) => (e.status === 'aktif' ? 'Aktif' : `Ayrıldı (${formatDate(e.exit_date)})`) },
    ], rows);

  return (
    <>
      <PageHeader
        title="Personel"
        subtitle={isHR ? 'Grup şirketlerindeki tüm çalışanlar' : 'Ekibinizdeki çalışanlar'}
        actions={
          <>
            <button className="btn" onClick={exportCsv} disabled={!rows.length}>
              <Download size={16} /> Excel'e aktar
            </button>
            {isHR && (
              <Link className="btn btn-primary" to="/personel/yeni">
                <UserPlus size={16} /> Yeni personel
              </Link>
            )}
          </>
        }
      />

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Ad, sicil no, pozisyon, e-posta…" />
        {isHR && (
          <select className="select" value={company} onChange={(e) => setFilter('sirket', e.target.value)} aria-label="Şirket">
            <option value="">Tüm şirketler</option>
            {lookups.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {isHR && (
          <select className="select" value={department} onChange={(e) => setFilter('departman', e.target.value)} aria-label="Departman" disabled={!company}>
            <option value="">{company ? 'Tüm departmanlar' : 'Önce şirket seçin'}</option>
            {lookups.departmentsOf(company).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        <select className="select" value={status} onChange={(e) => setFilter('durum', e.target.value === 'aktif' ? '' : e.target.value)} aria-label="Durum">
          <option value="aktif">Aktif çalışanlar</option>
          <option value="ayrildi">Ayrılanlar</option>
          <option value="all">Tümü</option>
        </select>
        <span className="muted small">{rows.length} kişi</span>
      </div>

      <Card flush>
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            onRowClick={(e) => navigate(`/personel/${e.id}`)}
            initialSort={{ key: 'name', dir: 'asc' }}
            empty={
              <EmptyState title="Personel bulunamadı" icon={Users}>
                Filtreleri değiştirerek tekrar deneyin.
              </EmptyState>
            }
          />
        )}
      </Card>
    </>
  );
}
