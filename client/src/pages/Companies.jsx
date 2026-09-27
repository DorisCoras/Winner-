import { useCallback, useMemo, useState } from 'react';
import { Building2, Layers, Mail, MapPin, Pencil, Phone, Plus, Trash2, Users } from 'lucide-react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import EmployeeSelect from '../components/EmployeeSelect.jsx';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  KeyValue,
  Loading,
  Modal,
  PageHeader,
  Tabs,
  useConfirm,
  useForm,
  useToast,
} from '../components/ui.jsx';

export default function Companies() {
  const [tab, setTab] = useState('sirketler');
  const [companyFilter, setCompanyFilter] = useState('');
  const companies = useApi('/companies');
  const departments = useApi('/departments');

  const showDepartments = (companyId) => {
    setCompanyFilter(String(companyId));
    setTab('departmanlar');
  };

  return (
    <>
      <PageHeader title="Şirketler & Departmanlar" subtitle="Grup şirketlerini, resmi bilgilerini ve departman yapısını yönetin." />
      <Tabs
        tabs={[
          { key: 'sirketler', label: 'Şirketler', icon: Building2, count: companies.data?.length },
          { key: 'departmanlar', label: 'Departmanlar', icon: Layers, count: departments.data?.length },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'sirketler' ? (
        <CompanyList state={companies} onChanged={departments.reload} onShowDepartments={showDepartments} />
      ) : (
        <DepartmentList
          state={departments}
          companies={companies.data ?? []}
          companyFilter={companyFilter}
          setCompanyFilter={setCompanyFilter}
          onChanged={companies.reload}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Şirketler
// ---------------------------------------------------------------------------

function CompanyList({ state, onChanged, onShowDepartments }) {
  const { data, loading, error, reload } = state;
  const { isAdmin, isHR } = useAuth();
  const { reloadLookups } = useLookups();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const remove = async (c) => {
    const ok = await confirm({
      title: 'Şirketi sil',
      message: `“${c.name}” kaydı ve bağlı departmanları kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmText: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/companies/${c.id}`);
      toast.success('Şirket silindi.');
      reload();
      onChanged?.();
      reloadLookups();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saved = () => {
    setEditing(null);
    reload();
    onChanged?.();
    reloadLookups();
  };

  return (
    <>
      <div className="toolbar">
        <span className="muted">{data.length} şirket</span>
        <span className="spacer" />
        {isHR && (
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={16} /> Yeni şirket
          </button>
        )}
      </div>
      {!data.length ? (
        <Card>
          <EmptyState title="Henüz şirket tanımlanmamış">Holding ve bağlı şirketleri ekleyerek başlayın.</EmptyState>
        </Card>
      ) : (
        <div className="grid grid-3">
          {data.map((c) => (
            <section key={c.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-header" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <h2>{c.name}</h2>
                  <div className="row wrap mt-1" style={{ gap: 6 }}>
                    {c.short_name && <span className="small muted">{c.short_name}</span>}
                    {!!c.is_holding && <Badge tone="blue">Holding</Badge>}
                    {!c.active && <Badge tone="red">Pasif</Badge>}
                  </div>
                </div>
                {isHR && (
                  <div className="row" style={{ gap: 2 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditing(c)} aria-label={`${c.name} kaydını düzenle`}>
                      <Pencil size={15} />
                    </button>
                    {isAdmin && (
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(c)} aria-label={`${c.name} kaydını sil`}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="card-body" style={{ flex: 1 }}>
                <KeyValue
                  items={[
                    ['Vergi dairesi / no', c.tax_office || c.tax_no ? `${c.tax_office ?? '—'} / ${c.tax_no ?? '—'}` : null],
                    ['SGK işyeri no', c.sgk_no ? <span className="mono">{c.sgk_no}</span> : null],
                    ['Telefon', c.phone ? <IconText icon={Phone}><a href={`tel:${c.phone.replace(/\s+/g, '')}`}>{c.phone}</a></IconText> : null],
                    ['E-posta', c.email ? <IconText icon={Mail}><a href={`mailto:${c.email}`}>{c.email}</a></IconText> : null],
                    ['Adres', c.address ? <IconText icon={MapPin}>{c.address}</IconText> : null],
                  ]}
                />
              </div>
              <div className="card-footer" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                <span className="row small muted" style={{ gap: 5 }}>
                  <Users size={14} /> <b className="num">{c.employee_count}</b> aktif personel
                </span>
                <span className="spacer" />
                <button className="btn btn-sm btn-ghost" onClick={() => onShowDepartments(c.id)}>
                  <Layers size={14} /> {c.department_count} departman
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
      {editing && <CompanyModal key={editing.id ?? 'yeni'} company={editing} onClose={() => setEditing(null)} onSaved={saved} />}
    </>
  );
}

function IconText({ icon: Icon, children }) {
  return (
    <span className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
      <Icon size={14} className="muted" style={{ flex: 'none', marginTop: 3 }} />
      <span style={{ minWidth: 0 }}>{children}</span>
    </span>
  );
}

function CompanyModal({ company, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!company.id;
  const f = useForm({
    name: company.name ?? '',
    short_name: company.short_name ?? '',
    is_holding: !!company.is_holding,
    tax_office: company.tax_office ?? '',
    tax_no: company.tax_no ?? '',
    sgk_no: company.sgk_no ?? '',
    address: company.address ?? '',
    phone: company.phone ?? '',
    email: company.email ?? '',
    active: isEdit ? !!company.active : true,
  });

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      if (isEdit) await api.put(`/companies/${company.id}`, v);
      else await api.post('/companies', v);
      toast.success(isEdit ? 'Şirket bilgileri güncellendi.' : 'Şirket eklendi.');
      onSaved();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Şirketi düzenle' : 'Yeni şirket'}
      size="lg"
      footer={
        <>
          <button className="btn" type="button" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn btn-primary" type="submit" form="company-form" disabled={f.submitting}>
            {f.submitting ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </>
      }
    >
      <form id="company-form" onSubmit={onSubmit} className="stack" style={{ gap: 14 }}>
        {f.formError && <Alert tone="error">{f.formError}</Alert>}
        <div className="form-grid">
          <Field label="Şirket unvanı" error={f.errors.name} htmlFor="f-name" required className="full">
            <input className="input" {...f.bind('name')} placeholder="ör. Örnek Teknoloji A.Ş." />
          </Field>
          <Field label="Kısa ad" error={f.errors.short_name} htmlFor="f-short_name" hint="Listelerde ve raporlarda kullanılır.">
            <input className="input" {...f.bind('short_name')} />
          </Field>
          <Field label="Durum">
            <div className="row wrap" style={{ gap: 16, minHeight: 36 }}>
              <label className="checkbox">
                <input type="checkbox" {...f.bind('is_holding', { type: 'checkbox' })} /> Holding (çatı şirket)
              </label>
              <label className="checkbox">
                <input type="checkbox" {...f.bind('active', { type: 'checkbox' })} /> Aktif
              </label>
            </div>
          </Field>
          <div className="form-section-title">Resmi bilgiler</div>
          <Field label="Vergi dairesi" error={f.errors.tax_office} htmlFor="f-tax_office">
            <input className="input" {...f.bind('tax_office')} />
          </Field>
          <Field label="Vergi no" error={f.errors.tax_no} htmlFor="f-tax_no">
            <input className="input" inputMode="numeric" {...f.bind('tax_no')} />
          </Field>
          <Field label="SGK işyeri sicil no" error={f.errors.sgk_no} htmlFor="f-sgk_no" className="full">
            <input className="input mono" {...f.bind('sgk_no')} />
          </Field>
          <div className="form-section-title">İletişim</div>
          <Field label="Telefon" error={f.errors.phone} htmlFor="f-phone">
            <input className="input" type="tel" {...f.bind('phone')} />
          </Field>
          <Field label="E-posta" error={f.errors.email} htmlFor="f-email">
            <input className="input" type="email" {...f.bind('email')} />
          </Field>
          <Field label="Adres" error={f.errors.address} htmlFor="f-address" className="full">
            <textarea className="textarea" rows={2} {...f.bind('address')} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Departmanlar
// ---------------------------------------------------------------------------

function DepartmentList({ state, companies, companyFilter, setCompanyFilter, onChanged }) {
  const { data, loading, error, reload } = state;
  const { isHR } = useAuth();
  const { reloadLookups } = useLookups();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);

  const groups = useMemo(() => {
    const list = (data ?? []).filter((d) => !companyFilter || d.company_id === Number(companyFilter));
    const byCompany = new Map();
    for (const d of list) {
      if (!byCompany.has(d.company_id)) byCompany.set(d.company_id, []);
      byCompany.get(d.company_id).push(d);
    }
    // Şirket sırası: /companies sırası (holding önce), departmanı olmayan şirketler de gösterilir.
    const ordered = companies
      .filter((c) => !companyFilter || c.id === Number(companyFilter))
      .map((c) => ({ company: c, departments: byCompany.get(c.id) ?? [] }));
    for (const [id, deps] of byCompany) {
      if (!ordered.some((g) => g.company.id === id)) ordered.push({ company: { id, name: deps[0].company_name }, departments: deps });
    }
    return ordered;
  }, [data, companies, companyFilter]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const remove = async (d) => {
    const ok = await confirm({
      title: 'Departmanı sil',
      message: d.employee_count
        ? `“${d.name}” departmanı silinecek. Bu departmandaki ${d.employee_count} aktif personelin departman bilgisi boşaltılır; personel kayıtları silinmez.`
        : `“${d.name}” departmanı silinecek. Bu işlem geri alınamaz.`,
      confirmText: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/departments/${d.id}`);
      toast.success('Departman silindi.');
      reload();
      onChanged?.();
      reloadLookups();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saved = () => {
    setEditing(null);
    reload();
    onChanged?.();
    reloadLookups();
  };

  const total = groups.reduce((n, g) => n + g.departments.length, 0);

  return (
    <>
      <div className="toolbar">
        <select className="select" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} aria-label="Şirket filtresi">
          <option value="">Tüm şirketler</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="muted">{total} departman</span>
        <span className="spacer" />
        {isHR && (
          <button className="btn btn-primary" onClick={() => setEditing({ company_id: companyFilter ? Number(companyFilter) : '' })}>
            <Plus size={16} /> Yeni departman
          </button>
        )}
      </div>
      {!groups.length ? (
        <Card>
          <EmptyState title="Departman bulunamadı" />
        </Card>
      ) : (
        <div className="stack">
          {groups.map(({ company, departments }) => (
            <Card
              key={company.id}
              title={company.name}
              hint={`${departments.length} departman · ${departments.reduce((n, d) => n + d.employee_count, 0)} aktif personel`}
              flush
              actions={
                isHR && (
                  <button className="btn btn-sm" onClick={() => setEditing({ company_id: company.id })}>
                    <Plus size={14} /> Departman ekle
                  </button>
                )
              }
            >
              {!departments.length ? (
                <EmptyState title="Bu şirkette departman yok" />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Departman</th>
                        <th>Yönetici</th>
                        <th className="num">Personel</th>
                        {isHR && <th className="num" style={{ width: 90 }} aria-label="İşlemler" />}
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((d) => (
                        <tr key={d.id}>
                          <td className="strong">{d.name}</td>
                          <td>{d.manager_name ?? <span className="muted">Atanmamış</span>}</td>
                          <td className="num">{d.employee_count}</td>
                          {isHR && (
                            <td className="num">
                              <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditing(d)} aria-label={`${d.name} departmanını düzenle`}>
                                  <Pencil size={15} />
                                </button>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(d)} aria-label={`${d.name} departmanını sil`}>
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <DepartmentModal key={editing.id ?? `yeni-${editing.company_id}`} department={editing} companies={companies} onClose={() => setEditing(null)} onSaved={saved} />
      )}
    </>
  );
}

function DepartmentModal({ department, companies, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!department.id;
  const f = useForm({
    company_id: department.company_id ?? '',
    name: department.name ?? '',
    manager_id: department.manager_id ?? '',
  });
  const companyId = Number(f.values.company_id) || null;
  const managerFilter = useCallback((e) => e.company_id === companyId, [companyId]);

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const body = { company_id: v.company_id, name: v.name, manager_id: v.manager_id || null };
      if (isEdit) await api.put(`/departments/${department.id}`, body);
      else await api.post('/departments', body);
      toast.success(isEdit ? 'Departman güncellendi.' : 'Departman eklendi.');
      onSaved();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Departmanı düzenle' : 'Yeni departman'}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn btn-primary" type="submit" form="department-form" disabled={f.submitting}>
            {f.submitting ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </>
      }
    >
      <form id="department-form" onSubmit={onSubmit} className="stack" style={{ gap: 14 }}>
        {f.formError && <Alert tone="error">{f.formError}</Alert>}
        <Field label="Şirket" error={f.errors.company_id} htmlFor="f-company_id" required>
          <select
            className="select"
            {...f.bind('company_id')}
            onChange={(e) => {
              f.set('company_id', e.target.value);
              f.set('manager_id', '');
            }}
          >
            <option value="">Şirket seçiniz…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.active ? ' (pasif)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Departman adı" error={f.errors.name} htmlFor="f-name" required>
          <input className="input" {...f.bind('name')} placeholder="ör. İnsan Kaynakları" />
        </Field>
        <Field
          label="Departman yöneticisi"
          error={f.errors.manager_id}
          htmlFor="f-manager_id"
          hint={companyId ? 'İsteğe bağlı. Yalnızca seçili şirketin aktif personeli listelenir.' : 'Önce şirket seçiniz.'}
        >
          <EmployeeSelect
            id="f-manager_id"
            value={f.values.manager_id}
            onChange={(id) => f.set('manager_id', id)}
            filter={managerFilter}
            placeholder="Yönetici yok"
            disabled={!companyId}
            invalid={!!f.errors.manager_id}
          />
        </Field>
      </form>
    </Modal>
  );
}
