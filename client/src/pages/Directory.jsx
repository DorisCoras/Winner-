import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, LayoutGrid, List, Mail, Phone, Users } from 'lucide-react';
import { useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import { downloadCsv } from '../csv.js';
import { fullName, matches } from '../format.js';
import { Avatar, Card, DataTable, EmptyState, ErrorState, Loading, PageHeader, PersonCell, SearchInput } from '../components/ui.jsx';

const VIEW_KEY = 'rehber-gorunum';

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'liste' ? 'liste' : 'kart';
  } catch {
    return 'kart';
  }
}

const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;

export default function Directory() {
  const { data, loading, error, reload } = useApi('/directory');
  const { companies, departments, companyName } = useLookups();
  const { hasRole } = useAuth();
  const canLink = hasRole('admin', 'ik', 'yonetici');

  const [q, setQ] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [view, setViewState] = useState(readView);

  const setView = (v) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* depolama kapalı */
    }
  };

  // Departman seçenekleri seçili şirkete göre daralır; şirket seçilmemişse şirkete göre gruplanır.
  const departmentGroups = useMemo(() => {
    const list = companyId ? departments.filter((d) => d.company_id === Number(companyId)) : departments;
    const map = new Map();
    for (const d of list) {
      if (!map.has(d.company_id)) map.set(d.company_id, []);
      map.get(d.company_id).push(d);
    }
    return [...map].sort(
      ([a], [b]) => companies.findIndex((c) => c.id === a) - companies.findIndex((c) => c.id === b),
    );
  }, [departments, companies, companyId]);

  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (e) =>
          (!companyId || e.company_id === Number(companyId)) &&
          (!departmentId || e.department_id === Number(departmentId)) &&
          (matches(fullName(e), q) || matches(e.position, q) || matches(e.department_name, q) || matches(e.company_name, q)),
      ),
    [data, companyId, departmentId, q],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const nameNode = (e) =>
    canLink ? (
      <Link className="person-name" to={`/personel/${e.id}`}>
        {fullName(e)}
      </Link>
    ) : (
      <span className="person-name">{fullName(e)}</span>
    );

  const exportCsv = () =>
    downloadCsv(
      'personel-rehberi.csv',
      [
        { header: 'Ad', value: (e) => e.first_name },
        { header: 'Soyad', value: (e) => e.last_name },
        { header: 'Pozisyon', value: (e) => e.position },
        { header: 'Departman', value: (e) => e.department_name },
        { header: 'Şirket', value: (e) => e.company_name },
        { header: 'E-posta', value: (e) => e.email },
        { header: 'Telefon', value: (e) => e.phone },
      ],
      rows,
    );

  const filtered = q || companyId || departmentId;

  return (
    <>
      <PageHeader
        title="Personel Rehberi"
        subtitle="Grup şirketlerindeki aktif çalışanların iş iletişim bilgileri."
        actions={
          <button className="btn" onClick={exportCsv} disabled={!rows.length}>
            <Download size={16} /> CSV indir
          </button>
        }
      />
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Ad, pozisyon, departman veya şirket ara…" />
        <select
          className="select"
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value);
            setDepartmentId('');
          }}
          aria-label="Şirket"
        >
          <option value="">Tüm şirketler</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="select" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Departman">
          <option value="">Tüm departmanlar</option>
          {companyId
            ? departmentGroups.flatMap(([, list]) =>
                list.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                )),
              )
            : departmentGroups.map(([cid, list]) => (
                <optgroup key={cid} label={companyName(cid)}>
                  {list.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </optgroup>
              ))}
        </select>
        <span className="spacer" />
        <span className="muted small nowrap" aria-live="polite">
          {rows.length} kişi{filtered && data.length !== rows.length ? ` / ${data.length}` : ''}
        </span>
        <div className="row" style={{ gap: 2 }} role="group" aria-label="Görünüm">
          <button
            className={`btn btn-icon btn-sm ${view === 'kart' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setView('kart')}
            aria-pressed={view === 'kart'}
            aria-label="Kart görünümü"
            title="Kart görünümü"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            className={`btn btn-icon btn-sm ${view === 'liste' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setView('liste')}
            aria-pressed={view === 'liste'}
            aria-label="Liste görünümü"
            title="Liste görünümü"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {!rows.length ? (
        <Card>
          <EmptyState title="Kimse bulunamadı" icon={Users}>
            {filtered ? 'Arama ölçütlerini değiştirmeyi deneyin.' : 'Rehberde henüz aktif personel yok.'}
          </EmptyState>
        </Card>
      ) : view === 'kart' ? (
        <div className="grid grid-3">
          {rows.map((e) => (
            <div key={e.id} className="card" style={{ padding: 16 }}>
              <div className="person" style={{ alignItems: 'flex-start' }}>
                <Avatar name={fullName(e)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="truncate">{nameNode(e)}</div>
                  <div className="small truncate">{e.position || <span className="muted">Pozisyon belirtilmemiş</span>}</div>
                  <div className="person-sub truncate" title={[e.department_name, e.company_name].filter(Boolean).join(' · ')}>
                    {[e.department_name, e.company_name].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <div className="stack small mt-1" style={{ gap: 4, paddingLeft: 44 }}>
                {e.email ? (
                  <a className="row" style={{ gap: 6, minWidth: 0 }} href={`mailto:${e.email}`}>
                    <Mail size={14} style={{ flex: 'none' }} />
                    <span className="truncate" style={{ minWidth: 0 }}>
                      {e.email}
                    </span>
                  </a>
                ) : (
                  <span className="row muted" style={{ gap: 6 }}>
                    <Mail size={14} /> E-posta yok
                  </span>
                )}
                {e.phone ? (
                  <a className="row" style={{ gap: 6 }} href={telHref(e.phone)}>
                    <Phone size={14} style={{ flex: 'none' }} />
                    <span className="num">{e.phone}</span>
                  </a>
                ) : (
                  <span className="row muted" style={{ gap: 6 }}>
                    <Phone size={14} /> Telefon yok
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card flush>
          <DataTable
            rows={rows}
            pageSize={50}
            columns={[
              {
                key: 'name',
                header: 'Ad Soyad',
                sortValue: (e) => fullName(e),
                render: (e) => <PersonCell name={fullName(e)} sub={e.position} to={canLink ? `/personel/${e.id}` : undefined} />,
              },
              { key: 'department_name', header: 'Departman', render: (e) => e.department_name ?? '—' },
              { key: 'company_name', header: 'Şirket' },
              {
                key: 'email',
                header: 'E-posta',
                render: (e) => (e.email ? <a href={`mailto:${e.email}`}>{e.email}</a> : '—'),
              },
              {
                key: 'phone',
                header: 'Telefon',
                className: 'nowrap',
                render: (e) => (e.phone ? <a href={telHref(e.phone)}>{e.phone}</a> : '—'),
              },
            ]}
          />
        </Card>
      )}
    </>
  );
}
