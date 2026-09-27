import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Network, Users } from 'lucide-react';
import { useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import { fullName, matches } from '../format.js';
import { Avatar, Badge, Card, EmptyState, ErrorState, Loading, PageHeader, SearchInput, Tabs } from '../components/ui.jsx';
import './OrgChart.css';

const byName = (a, b) => fullName(a).localeCompare(fullName(b), 'tr');

/**
 * manager_id ilişkisinden ağaç kurar. Yöneticisi olmayan veya yöneticisi aktif listede bulunmayanlar köktür.
 * Hatalı veride oluşabilecek döngüler ziyaret kümesiyle kırılır (döngüdeki ilk kişi kök olur).
 */
function buildTree(list) {
  const byId = new Map(list.map((e) => [e.id, e]));
  const rawKids = new Map();
  for (const e of list) {
    if (e.manager_id && e.manager_id !== e.id && byId.has(e.manager_id)) {
      if (!rawKids.has(e.manager_id)) rawKids.set(e.manager_id, []);
      rawKids.get(e.manager_id).push(e);
    }
  }
  const kids = new Map();
  const parent = new Map();
  const depth = new Map();
  const total = new Map();
  const visited = new Set();

  const walk = (e, d) => {
    visited.add(e.id);
    depth.set(e.id, d);
    const children = [];
    for (const c of rawKids.get(e.id) ?? []) {
      if (visited.has(c.id)) continue;
      parent.set(c.id, e.id);
      children.push(c);
      walk(c, d + 1);
    }
    kids.set(e.id, children);
    total.set(e.id, children.reduce((n, c) => n + 1 + total.get(c.id), 0));
  };

  const roots = list.filter((e) => !e.manager_id || e.manager_id === e.id || !byId.has(e.manager_id));
  for (const r of roots) walk(r, 0);
  for (const e of list) {
    if (!visited.has(e.id)) {
      roots.push(e);
      walk(e, 0);
    }
  }

  // Ekibi olanlar önce (büyük ekip önce), ardından ada göre.
  const order = (a, b) => (total.get(b.id) > 0) - (total.get(a.id) > 0) || byName(a, b);
  roots.sort((a, b) => total.get(b.id) - total.get(a.id) || byName(a, b));
  for (const children of kids.values()) children.sort(order);

  return { roots, kids, parent, depth, total };
}

/** ids içindeki kişilerin tüm üst yöneticilerini `set`e ekler ve kümeyi döndürür. */
function withAncestors(set, tree, ids) {
  for (const id of ids) {
    let p = tree.parent.get(id);
    while (p != null) {
      set.add(p);
      p = tree.parent.get(p);
    }
  }
  return set;
}

function personText(e) {
  return [fullName(e), e.position, e.department_name, e.company_name].filter(Boolean).join(' | ');
}

export default function OrgChart() {
  const { data, loading, error, reload } = useApi('/directory');
  const { hasRole } = useAuth();
  const canLink = hasRole('admin', 'ik', 'yonetici');
  const [view, setView] = useState('hiyerarsi');
  const [q, setQ] = useState('');

  const list = useMemo(() => data ?? [], [data]);
  const tree = useMemo(() => buildTree(list), [list]);

  const matchIds = useMemo(() => {
    if (!q.trim()) return null;
    return new Set(list.filter((e) => matches(personText(e), q)).map((e) => e.id));
  }, [list, q]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const managers = list.filter((e) => tree.kids.get(e.id)?.length).length;

  return (
    <>
      <PageHeader
        title="Organizasyon Şeması"
        subtitle={`${list.length} aktif personel · ${managers} kişinin doğrudan bağlı ekibi var`}
      />
      <Tabs
        tabs={[
          { key: 'hiyerarsi', label: 'Yönetim Hiyerarşisi', icon: Network },
          { key: 'sirket', label: 'Şirket / Departman', icon: Building2 },
        ]}
        active={view}
        onChange={setView}
      />
      {!list.length ? (
        <Card>
          <EmptyState title="Aktif personel bulunmuyor" icon={Users} />
        </Card>
      ) : view === 'hiyerarsi' ? (
        <HierarchyView tree={tree} list={list} q={q} setQ={setQ} matchIds={matchIds} canLink={canLink} />
      ) : (
        <CompanyView list={list} q={q} setQ={setQ} matchIds={matchIds} canLink={canLink} />
      )}
    </>
  );
}

function PersonName({ e, canLink }) {
  const name = fullName(e);
  return canLink ? (
    <Link className="person-name" to={`/personel/${e.id}`}>
      {name}
    </Link>
  ) : (
    <span className="person-name">{name}</span>
  );
}

// ---------------------------------------------------------------------------
// Yönetim hiyerarşisi
// ---------------------------------------------------------------------------

function HierarchyView({ tree, list, q, setQ, matchIds, canLink }) {
  const { companies } = useLookups();
  // Varsayılan: ilk iki seviye (kökler ve doğrudan bağlıları) açık; süren bir aramanın sonuçları da görünür.
  const [expanded, setExpanded] = useState(() =>
    withAncestors(
      new Set(list.filter((e) => tree.depth.get(e.id) < 2 && tree.kids.get(e.id)?.length).map((e) => e.id)),
      tree,
      matchIds ?? [],
    ),
  );

  const shortCompany = useMemo(() => {
    const m = new Map(companies.map((c) => [c.id, c.short_name || c.name]));
    return (e) => m.get(e.company_id) ?? e.company_name;
  }, [companies]);

  const onSearch = (value) => {
    setQ(value);
    if (!value.trim()) return;
    // Eşleşen kişilerin tüm üst yöneticilerini aç.
    const hits = list.filter((e) => matches(personText(e), value)).map((e) => e.id);
    if (hits.length) setExpanded((prev) => withAncestors(new Set(prev), tree, hits));
  };

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandAll = () => setExpanded(new Set(list.filter((e) => tree.kids.get(e.id)?.length).map((e) => e.id)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <>
      <div className="toolbar">
        <SearchInput value={q} onChange={onSearch} placeholder="Kişi, pozisyon veya departman ara…" />
        {matchIds && (
          <span className={`small nowrap ${matchIds.size ? 'muted' : 'text-danger'}`} aria-live="polite">
            {matchIds.size} sonuç
          </span>
        )}
        <span className="spacer" />
        <button className="btn btn-sm" onClick={expandAll}>
          <ChevronsUpDown size={15} /> Tümünü aç
        </button>
        <button className="btn btn-sm" onClick={collapseAll}>
          <ChevronsDownUp size={15} /> Tümünü kapat
        </button>
      </div>
      <Card flush>
        <div className="orgc-scroll">
          <ul className="org-tree orgc-tree">
            {tree.roots.map((e) => (
              <OrgNode
                key={e.id}
                e={e}
                tree={tree}
                expanded={expanded}
                toggle={toggle}
                matchIds={matchIds}
                canLink={canLink}
                shortCompany={shortCompany}
              />
            ))}
          </ul>
        </div>
      </Card>
    </>
  );
}

function OrgNode({ e, tree, expanded, toggle, matchIds, canLink, shortCompany }) {
  const children = tree.kids.get(e.id) ?? [];
  const open = expanded.has(e.id);
  const name = fullName(e);
  const team = tree.total.get(e.id);
  const isMatch = matchIds?.has(e.id);

  return (
    <li>
      <div className={`org-node ${isMatch ? 'orgc-match' : ''} ${matchIds && !isMatch ? 'orgc-dim' : ''}`}>
        <Avatar name={name} />
        <div className="orgc-node-text">
          <PersonName e={e} canLink={canLink} />
          <div className="small">{e.position || <span className="muted">Pozisyon belirtilmemiş</span>}</div>
          <div className="person-sub">{[shortCompany(e), e.department_name].filter(Boolean).join(' · ')}</div>
        </div>
        {children.length > 0 && (
          <button
            type="button"
            className="btn btn-sm btn-ghost orgc-toggle"
            onClick={() => toggle(e.id)}
            aria-expanded={open}
            aria-label={`${children.length} kişi — ${name} ekibini ${open ? 'gizle' : 'göster'}`}
            title={`${children.length} doğrudan bağlı${team > children.length ? `, toplam ${team} kişilik ekip` : ''}`}
          >
            {children.length} kişi
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>
      {open && children.length > 0 && (
        <ul>
          {children.map((c) => (
            <OrgNode
              key={c.id}
              e={c}
              tree={tree}
              expanded={expanded}
              toggle={toggle}
              matchIds={matchIds}
              canLink={canLink}
              shortCompany={shortCompany}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Şirket / departman görünümü
// ---------------------------------------------------------------------------

function CompanyView({ list, q, setQ, matchIds, canLink }) {
  const { companies, departments } = useLookups();

  const groups = useMemo(() => {
    const deptManager = new Map(departments.map((d) => [d.id, d.manager_id]));
    const companyOrder = new Map(companies.map((c, i) => [c.id, i]));
    const byCompany = new Map();
    for (const e of list) {
      if (matchIds && !matchIds.has(e.id)) continue;
      if (!byCompany.has(e.company_id)) byCompany.set(e.company_id, { id: e.company_id, name: e.company_name, count: 0, depts: new Map() });
      const g = byCompany.get(e.company_id);
      g.count += 1;
      const key = e.department_id ?? 0;
      if (!g.depts.has(key)) g.depts.set(key, { id: key, name: e.department_name ?? 'Departmanı belirtilmemiş', managerId: deptManager.get(key), people: [] });
      g.depts.get(key).people.push(e);
    }
    return [...byCompany.values()]
      .sort((a, b) => (companyOrder.get(a.id) ?? 999) - (companyOrder.get(b.id) ?? 999) || a.name.localeCompare(b.name, 'tr'))
      .map((g) => ({
        ...g,
        depts: [...g.depts.values()]
          .sort((a, b) => (a.id === 0) - (b.id === 0) || a.name.localeCompare(b.name, 'tr'))
          .map((d) => ({ ...d, people: d.people.sort((a, b) => (b.id === d.managerId) - (a.id === d.managerId) || byName(a, b)) })),
      }));
  }, [list, companies, departments, matchIds]);

  return (
    <>
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Kişi, pozisyon veya departman ara…" />
        {matchIds && (
          <span className={`small nowrap ${matchIds.size ? 'muted' : 'text-danger'}`} aria-live="polite">
            {matchIds.size} sonuç
          </span>
        )}
      </div>
      {!groups.length ? (
        <Card>
          <EmptyState title="Aramanızla eşleşen kişi yok" icon={Users} />
        </Card>
      ) : (
        <div className="stack">
          {groups.map((g) => (
            <Card key={g.id} title={g.name} hint={`${g.count} personel · ${g.depts.length} departman`}>
              <div className="grid grid-3">
                {g.depts.map((d) => (
                  <section key={d.id} className="orgc-dept">
                    <div className="orgc-dept-header">
                      <span className="truncate">{d.name}</span>
                      <Badge>{d.people.length}</Badge>
                    </div>
                    <ul className="list">
                      {d.people.map((e) => (
                        <li key={e.id}>
                          <Avatar name={fullName(e)} size="sm" />
                          <div className="grow">
                            <div className="truncate">
                              <PersonName e={e} canLink={canLink} />
                            </div>
                            <div className="person-sub truncate">{e.position || '—'}</div>
                          </div>
                          {e.id === d.managerId && <Badge tone="blue">Yönetici</Badge>}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
