import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Star, Trash2, UserCheck, UserPlus, Users, X } from 'lucide-react';
import { api, useApi } from '../api.js';
import { useLookups } from '../lookups.jsx';
import {
  Alert,
  Badge,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  SearchInput,
  StatCard,
  Tabs,
  useConfirm,
  useForm,
  useToast,
} from '../components/ui.jsx';
import { formatDate, formatDateTime, formatMoney, formatNumber, matches, relativeDays, todayStr } from '../format.js';
import './Recruitment.css';

const JOB_STATUS_TONE = { acik: 'green', beklemede: 'amber', kapali: '' };
const JOB_STATUS_ORDER = ['acik', 'beklemede', 'kapali'];

function JobStatusBadge({ status }) {
  const { jobStatuses } = useLookups();
  return <Badge tone={JOB_STATUS_TONE[status] ?? ''}>{jobStatuses?.[status] ?? status}</Badge>;
}

/** Form hatası: uzun formlarda kaydet düğmesi alttayken de görünmesi için görünür alana kaydırılır. */
function FormError({ message }) {
  const ref = useRef(null);
  useEffect(() => {
    if (message) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [message]);
  if (!message) return null;
  return (
    <div className="mb-2" ref={ref}>
      <Alert tone="error">{message}</Alert>
    </div>
  );
}

function Stars({ value }) {
  if (!value) return <span className="small muted">Puanlanmadı</span>;
  return (
    <span className="rec-stars" role="img" aria-label={`${value} / 5 puan`} title={`${value} / 5`}>
      {'★'.repeat(value)}
      <span className="off">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

function Deadline({ job }) {
  if (!job.closes_at) return <span className="muted">—</span>;
  const expired = job.closes_at < todayStr();
  return (
    <div className="nowrap">
      {formatDate(job.closes_at)}
      {job.status === 'acik' && (
        <div className={`small ${expired ? 'text-danger' : 'muted'}`}>{expired ? 'Süresi doldu' : relativeDays(job.closes_at)}</div>
      )}
    </div>
  );
}

/** Onay penceresi açıkken Escape tuşunun alttaki modalı da kapatmasını önler. */
function useGuardedConfirm(onClose) {
  const confirm = useConfirm();
  const asking = useRef(false);
  const ask = useCallback(
    async (opts) => {
      asking.current = true;
      try {
        return await confirm(opts);
      } finally {
        asking.current = false;
      }
    },
    [confirm],
  );
  const close = useCallback(() => {
    if (!asking.current) onClose();
  }, [onClose]);
  return [ask, close];
}

export default function Recruitment() {
  const lookups = useLookups();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: jobs, loading: jobsLoading, error: jobsError, reload: reloadJobs } = useApi('/jobs');
  const {
    data: candidates,
    loading: candidatesLoading,
    error: candidatesError,
    reload: reloadCandidates,
    setData: setCandidates,
  } = useApi('/candidates');

  const [tab, setTab] = useState('ilanlar');
  const [postingFilter, setPostingFilter] = useState('');
  const [jobModal, setJobModal] = useState(null); // { job? }
  const [candidateModal, setCandidateModal] = useState(null); // { candidate?, postingId? }

  const closeJobModal = useCallback(() => setJobModal(null), []);
  const closeCandidateModal = useCallback(() => setCandidateModal(null), []);
  const reloadAll = useCallback(() => {
    reloadJobs();
    reloadCandidates();
  }, [reloadJobs, reloadCandidates]);

  const stageKeys = useMemo(() => Object.keys(lookups.candidateStages ?? {}), [lookups.candidateStages]);
  const flow = useMemo(() => stageKeys.filter((s) => s !== 'red'), [stageKeys]);

  const stats = useMemo(() => {
    const year = todayStr().slice(0, 4);
    const open = (jobs ?? []).filter((j) => j.status === 'acik');
    const list = candidates ?? [];
    return {
      openJobs: open.length,
      openPositions: open.reduce((sum, j) => sum + (Number(j.openings) || 0), 0),
      activeCandidates: list.filter((c) => c.stage !== 'ise_alindi' && c.stage !== 'red').length,
      hiredThisYear: list.filter((c) => c.stage === 'ise_alindi' && String(c.updated_at ?? '').startsWith(year)).length,
      year,
    };
  }, [jobs, candidates]);

  if ((!jobs && jobsLoading) || (!candidates && candidatesLoading)) return <Loading />;
  if (!jobs || !candidates) return <ErrorState error={jobsError ?? candidatesError} onRetry={reloadAll} />;

  const openCandidatesOf = (job) => {
    setPostingFilter(String(job.id));
    setTab('adaylar');
  };

  const deleteJob = async (job) => {
    const n = job.candidate_count;
    const ok = await confirm({
      title: 'İlanı sil',
      message: n
        ? `“${job.title}” ilanı ve bu ilana bağlı ${n} aday kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz.`
        : `“${job.title}” ilanı kalıcı olarak silinecek.`,
      confirmText: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/jobs/${job.id}`);
      toast.success('İlan silindi.');
      if (postingFilter === String(job.id)) setPostingFilter('');
      reloadAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const moveCandidate = async (c, stage) => {
    const previous = c.stage;
    const setStage = (s) => setCandidates((list) => list?.map((x) => (x.id === c.id ? { ...x, stage: s } : x)));
    setStage(stage);
    try {
      await api.patch(`/candidates/${c.id}/stage`, { stage });
      toast.success(`${c.first_name} ${c.last_name}: “${lookups.candidateStages?.[stage] ?? stage}” aşamasına taşındı.`);
      reloadAll();
    } catch (err) {
      setStage(previous);
      toast.error(err.message);
    }
  };

  const deleteCandidate = async (c, ask = confirm) => {
    const ok = await ask({
      title: 'Adayı sil',
      message: `${c.first_name} ${c.last_name} adlı adayın kaydı kalıcı olarak silinecek.`,
      confirmText: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/candidates/${c.id}`);
      toast.success('Aday kaydı silindi.');
      setCandidateModal(null);
      reloadAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="İşe Alım"
        subtitle="İş ilanlarını yönetin ve adayları işe alım sürecinin aşamalarında takip edin."
        actions={
          <>
            <button
              className="btn"
              onClick={() => setCandidateModal({ postingId: postingFilter })}
              disabled={!jobs.length}
              title={!jobs.length ? 'Önce bir iş ilanı oluşturun' : undefined}
            >
              <UserPlus size={16} /> Yeni Aday
            </button>
            <button className="btn btn-primary" onClick={() => setJobModal({})}>
              <Plus size={16} /> Yeni İlan
            </button>
          </>
        }
      />

      <div className="grid grid-4 mb-2">
        <StatCard icon={Briefcase} label="Açık ilan" value={formatNumber(stats.openJobs)} sub={`Toplam ${jobs.length} ilan`} />
        <StatCard icon={Users} tone="teal" label="Açık pozisyon" value={formatNumber(stats.openPositions)} sub="Açık ilanlardaki kadro" />
        <StatCard icon={UserPlus} tone="amber" label="Aktif aday" value={formatNumber(stats.activeCandidates)} sub="Süreci devam eden" />
        <StatCard icon={UserCheck} tone="green" label="Bu yıl işe alınan" value={formatNumber(stats.hiredThisYear)} sub={`${stats.year} yılında`} />
      </div>

      <Tabs
        tabs={[
          { key: 'ilanlar', label: 'İlanlar', count: jobs.length, icon: Briefcase },
          { key: 'adaylar', label: 'Aday Takibi', count: stats.activeCandidates, icon: Users },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'ilanlar' ? (
        <JobsTab
          jobs={jobs}
          onOpen={openCandidatesOf}
          onNew={() => setJobModal({})}
          onEdit={(job) => setJobModal({ job })}
          onDelete={deleteJob}
        />
      ) : (
        <CandidatesTab
          jobs={jobs}
          candidates={candidates}
          stageKeys={stageKeys}
          flow={flow}
          postingFilter={postingFilter}
          onPostingFilter={setPostingFilter}
          onOpen={(candidate) => setCandidateModal({ candidate })}
          onEditJob={(job) => setJobModal({ job })}
          onMove={moveCandidate}
        />
      )}

      {jobModal && (
        <JobFormModal
          key={jobModal.job?.id ?? 'new'}
          job={jobModal.job}
          onClose={closeJobModal}
          onSaved={() => {
            setJobModal(null);
            reloadAll();
          }}
        />
      )}

      {candidateModal && (
        <CandidateFormModal
          key={candidateModal.candidate?.id ?? 'new'}
          candidate={candidateModal.candidate}
          defaultPostingId={candidateModal.postingId}
          jobs={jobs}
          onClose={closeCandidateModal}
          onSaved={() => {
            setCandidateModal(null);
            reloadAll();
          }}
          onDelete={deleteCandidate}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// İlanlar sekmesi
// ---------------------------------------------------------------------------

function JobsTab({ jobs, onOpen, onNew, onEdit, onDelete }) {
  const { employmentTypes, jobStatuses } = useLookups();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const rows = useMemo(
    () =>
      jobs.filter(
        (j) =>
          (!status || j.status === status) &&
          matches(`${j.title} ${j.company_name} ${j.department_name ?? ''} ${j.location ?? ''}`, search),
      ),
    [jobs, search, status],
  );

  const columns = [
    {
      key: 'title',
      header: 'Pozisyon',
      render: (j) => (
        <div style={{ minWidth: 180 }}>
          <div className="strong">{j.title}</div>
          <div className="small muted">
            {j.company_name}
            {j.department_name ? ` / ${j.department_name}` : ''}
          </div>
        </div>
      ),
    },
    { key: 'location', header: 'Lokasyon', render: (j) => j.location || '—' },
    {
      key: 'employment_type',
      header: 'Çalışma Şekli',
      render: (j) => employmentTypes?.[j.employment_type] ?? j.employment_type,
      sortValue: (j) => employmentTypes?.[j.employment_type] ?? j.employment_type,
    },
    { key: 'openings', header: 'Kadro', align: 'right' },
    {
      key: 'status',
      header: 'Durum',
      render: (j) => <JobStatusBadge status={j.status} />,
      sortValue: (j) => JOB_STATUS_ORDER.indexOf(j.status),
    },
    {
      key: 'active_candidates',
      header: 'Adaylar',
      render: (j) => (
        <div className="nowrap">
          <span className="strong">{j.active_candidates}</span> aktif <span className="muted">/ {j.candidate_count} toplam</span>
          {j.hired_count > 0 && <div className="small text-success">{j.hired_count} işe alındı</div>}
        </div>
      ),
    },
    { key: 'closes_at', header: 'Son Başvuru', render: (j) => <Deadline job={j} /> },
    {
      key: '_actions',
      header: '',
      render: (j) => (
        <div className="rec-actions-cell">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={`${j.title} ilanını düzenle`}
            title="Düzenle"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(j);
            }}
          >
            <Pencil size={15} />
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={`${j.title} ilanını sil`}
            title="Sil"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(j);
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  if (!jobs.length) {
    return (
      <div className="card">
        <EmptyState title="Henüz iş ilanı yok" icon={Briefcase}>
          <p>İlk ilanınızı oluşturarak aday takibine başlayın.</p>
          <button className="btn btn-primary" onClick={onNew}>
            <Plus size={16} /> Yeni İlan
          </button>
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Pozisyon, şirket veya lokasyon ara…" />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="İlan durumu">
          <option value="">Tüm durumlar</option>
          {Object.entries(jobStatuses ?? {}).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="card">
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={onOpen}
          empty={<EmptyState title="Filtreyle eşleşen ilan bulunamadı" />}
        />
      </div>
      <p className="small muted mt-1">Bir ilana tıklayarak adaylarını Aday Takibi sekmesinde görüntüleyebilirsiniz.</p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Aday takibi (kanban)
// ---------------------------------------------------------------------------

function CandidatesTab({ jobs, candidates, stageKeys, flow, postingFilter, onPostingFilter, onOpen, onEditJob, onMove }) {
  const { candidateStages, employmentTypes } = useLookups();
  const [search, setSearch] = useState('');
  const selectedJob = postingFilter ? jobs.find((j) => String(j.id) === postingFilter) : null;

  const visible = useMemo(
    () =>
      candidates.filter(
        (c) =>
          (!postingFilter || String(c.posting_id) === postingFilter) &&
          matches(`${c.first_name} ${c.last_name} ${c.email ?? ''} ${c.phone ?? ''} ${c.source ?? ''} ${c.posting_title}`, search),
      ),
    [candidates, postingFilter, search],
  );

  const byStage = useMemo(() => {
    const map = Object.fromEntries(stageKeys.map((s) => [s, []]));
    for (const c of visible) (map[c.stage] ??= []).push(c);
    return map;
  }, [visible, stageKeys]);

  return (
    <>
      <div className="toolbar">
        <select className="select" value={postingFilter} onChange={(e) => onPostingFilter(e.target.value)} aria-label="İlan filtresi">
          <option value="">Tüm ilanlar</option>
          {jobs.map((j) => (
            <option key={j.id} value={String(j.id)}>
              {j.title} — {j.company_name}
              {j.status !== 'acik' ? ` (${j.status === 'kapali' ? 'Kapalı' : 'Beklemede'})` : ''}
            </option>
          ))}
        </select>
        <SearchInput value={search} onChange={setSearch} placeholder="Aday adı, e-posta veya kaynak ara…" />
      </div>

      {selectedJob && (
        <div className="card rec-posting-bar">
          <div className="rec-posting-info">
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="strong">{selectedJob.title}</span>
              <JobStatusBadge status={selectedJob.status} />
            </div>
            <div className="small muted">
              {[
                selectedJob.company_name,
                selectedJob.department_name,
                selectedJob.location,
                employmentTypes?.[selectedJob.employment_type],
                `${selectedJob.openings} kadro`,
                selectedJob.closes_at ? `Son başvuru ${formatDate(selectedJob.closes_at)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <div className="row">
            <button className="btn btn-sm" onClick={() => onEditJob(selectedJob)}>
              <Pencil size={14} /> İlanı düzenle
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => onPostingFilter('')}>
              Tüm ilanlar
            </button>
          </div>
        </div>
      )}

      <div className="kanban rec-kanban">
        {stageKeys.map((stage) => {
          const list = byStage[stage] ?? [];
          return (
            <section key={stage} className={`kanban-col stage-${stage}`} aria-label={candidateStages?.[stage]}>
              <div className="kanban-col-header">
                <span>{candidateStages?.[stage]}</span>
                <Badge>{list.length}</Badge>
              </div>
              <div className="kanban-cards">
                {list.length === 0 && <div className="rec-col-empty">Aday yok</div>}
                {list.map((c) => (
                  <CandidateCard
                    key={c.id}
                    candidate={c}
                    flow={flow}
                    showPosting={!postingFilter}
                    onOpen={onOpen}
                    onMove={onMove}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function CandidateCard({ candidate: c, flow, showPosting, onOpen, onMove }) {
  const { candidateStages } = useLookups();
  const idx = flow.indexOf(c.stage);
  const prev = idx > 0 ? flow[idx - 1] : null;
  const next = idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
  const name = `${c.first_name} ${c.last_name}`;
  const act = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className="kanban-card rec-card" onClick={() => onOpen(c)}>
      <button type="button" className="rec-card-name" onClick={act(() => onOpen(c))}>
        {name}
      </button>
      {showPosting && <div className="small muted truncate" title={c.posting_title}>{c.posting_title}</div>}
      <div className="rec-card-meta">
        {c.source ? <Badge>{c.source}</Badge> : <span />}
        <Stars value={c.rating} />
      </div>
      {c.expected_salary != null && (
        <div className="small">
          <span className="muted">Beklenti:</span> <span className="num">{formatMoney(c.expected_salary, { whole: true })}</span>
        </div>
      )}
      {c.stage === 'ise_alindi' &&
        (c.employee_id ? (
          <Link className="btn btn-sm rec-hire" to={`/personel/${c.employee_id}`} onClick={(e) => e.stopPropagation()}>
            <UserCheck size={14} /> Personel kaydını aç
          </Link>
        ) : (
          <Link className="btn btn-sm btn-success rec-hire" to={`/personel/yeni?aday=${c.id}`} onClick={(e) => e.stopPropagation()}>
            <UserPlus size={14} /> Personel kaydı oluştur
          </Link>
        ))}
      <div className="rec-card-actions">
        {prev && (
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={`${name}: ${candidateStages?.[prev]} aşamasına geri taşı`}
            title={`← ${candidateStages?.[prev]}`}
            onClick={act(() => onMove(c, prev))}
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {c.stage === 'red' ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label={`${name}: başvuru aşamasına geri al`}
            onClick={act(() => onMove(c, flow[0]))}
          >
            <RotateCcw size={14} /> Geri al
          </button>
        ) : (
          c.stage !== 'ise_alindi' && (
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={`${name}: reddet`}
              title="Reddet"
              onClick={act(() => onMove(c, 'red'))}
            >
              <X size={15} />
            </button>
          )
        )}
        <span className="spacer" />
        {next && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label={`${name}: ${candidateStages?.[next]} aşamasına taşı`}
            title={`${candidateStages?.[next]} →`}
            onClick={act(() => onMove(c, next))}
          >
            {candidateStages?.[next]} <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formlar
// ---------------------------------------------------------------------------

function JobFormModal({ job, onClose, onSaved }) {
  const { companies, departmentsOf, employmentTypes, jobStatuses } = useLookups();
  const toast = useToast();
  const isEdit = !!job?.id;
  const f = useForm({
    company_id: job?.company_id ?? '',
    department_id: job?.department_id ?? '',
    title: job?.title ?? '',
    description: job?.description ?? '',
    location: job?.location ?? '',
    employment_type: job?.employment_type ?? 'tam_zamanli',
    openings: job?.openings ?? 1,
    status: job?.status ?? 'acik',
    closes_at: job?.closes_at ?? '',
  });

  const companyOptions = companies.filter((c) => c.active || c.id === Number(f.values.company_id));
  const departments = f.values.company_id ? departmentsOf(f.values.company_id) : [];

  const save = (e) => {
    e?.preventDefault();
    return f.submit(async (v) => {
      const body = { ...v, department_id: v.department_id || null, closes_at: v.closes_at || null };
      if (isEdit) await api.put(`/jobs/${job.id}`, body);
      else await api.post('/jobs', body);
      toast.success(isEdit ? 'İlan güncellendi.' : 'İlan oluşturuldu.');
      onSaved();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'İlanı Düzenle' : 'Yeni İş İlanı'}
      size="lg"
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn btn-primary" type="submit" form="job-form" disabled={f.submitting}>
            {f.submitting ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </>
      }
    >
      <form id="job-form" onSubmit={save} noValidate>
        <FormError message={f.formError} />
        <div className="form-grid">
          <Field label="Pozisyon başlığı" required error={f.errors.title} htmlFor="f-title" className="full">
            <input className="input" {...f.bind('title')} maxLength={150} placeholder="ör. Kıdemli Muhasebe Uzmanı" />
          </Field>
          <Field label="Şirket" required error={f.errors.company_id} htmlFor="f-company_id">
            <select
              className="select"
              {...f.bind('company_id')}
              onChange={(e) => {
                f.set('company_id', e.target.value);
                f.set('department_id', '');
              }}
            >
              <option value="">Şirket seçiniz…</option>
              {companyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Departman" error={f.errors.department_id} htmlFor="f-department_id">
            <select className="select" {...f.bind('department_id')} disabled={!f.values.company_id}>
              <option value="">{f.values.company_id ? 'Belirtilmemiş' : 'Önce şirket seçiniz'}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lokasyon" error={f.errors.location} htmlFor="f-location">
            <input className="input" {...f.bind('location')} maxLength={120} placeholder="ör. İstanbul" />
          </Field>
          <Field label="Çalışma şekli" error={f.errors.employment_type} htmlFor="f-employment_type">
            <select className="select" {...f.bind('employment_type')}>
              {Object.entries(employmentTypes ?? {}).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kadro (kişi)" error={f.errors.openings} htmlFor="f-openings">
            <input className="input" type="number" min={1} max={500} step={1} {...f.bind('openings')} />
          </Field>
          <Field label="Durum" error={f.errors.status} htmlFor="f-status">
            <select className="select" {...f.bind('status')}>
              {Object.entries(jobStatuses ?? {}).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Son başvuru tarihi" error={f.errors.closes_at} htmlFor="f-closes_at">
            <input className="input" type="date" {...f.bind('closes_at')} />
          </Field>
          <Field label="Açıklama" error={f.errors.description} htmlFor="f-description" className="full">
            <textarea
              className="textarea"
              rows={6}
              {...f.bind('description')}
              maxLength={5000}
              placeholder="Görev tanımı, aranan nitelikler, yan haklar…"
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function CandidateFormModal({ candidate, defaultPostingId, jobs, onClose, onSaved, onDelete }) {
  const { candidateStages, candidateSources } = useLookups();
  const toast = useToast();
  const [ask, guardedClose] = useGuardedConfirm(onClose);
  const isEdit = !!candidate?.id;
  const f = useForm({
    posting_id: candidate?.posting_id ?? defaultPostingId ?? '',
    first_name: candidate?.first_name ?? '',
    last_name: candidate?.last_name ?? '',
    email: candidate?.email ?? '',
    phone: candidate?.phone ?? '',
    source: candidate?.source ?? '',
    stage: candidate?.stage ?? 'basvuru',
    rating: candidate?.rating ?? null,
    expected_salary: candidate?.expected_salary ?? '',
    notes: candidate?.notes ?? '',
  });

  const save = (e) => {
    e?.preventDefault();
    return f.submit(async (v) => {
      // Boş sayısal alanlar gönderilmez: sunucu null/'' değerini 0'a çeviriyor, eksik alan ise null kaydediliyor.
      const body = {
        ...v,
        rating: v.rating || undefined,
        expected_salary: v.expected_salary === '' || v.expected_salary == null ? undefined : v.expected_salary,
      };
      if (isEdit) await api.put(`/candidates/${candidate.id}`, body);
      else await api.post('/candidates', body);
      toast.success(isEdit ? 'Aday bilgileri güncellendi.' : 'Aday eklendi.');
      onSaved();
    });
  };

  const rating = Number(f.values.rating) || 0;

  return (
    <Modal
      open
      onClose={guardedClose}
      title={isEdit ? `${candidate.first_name} ${candidate.last_name}` : 'Yeni Aday'}
      size="lg"
      footer={
        <>
          {isEdit && (
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(candidate, ask)}>
              <Trash2 size={15} /> Sil
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn btn-primary" type="submit" form="candidate-form" disabled={f.submitting}>
            {f.submitting ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </>
      }
    >
      <form id="candidate-form" onSubmit={save} noValidate>
        {isEdit && candidate.stage === 'ise_alindi' && (
          <div className="mb-2">
            {candidate.employee_id ? (
              <Alert tone="success" title="Aday işe alındı">
                Personel kaydı oluşturuldu. <Link to={`/personel/${candidate.employee_id}`}>Personel kaydını görüntüle</Link>
              </Alert>
            ) : (
              <Alert tone="success" title="Aday işe alındı">
                Aday bilgileriyle önceden doldurulmuş personel kaydını oluşturabilirsiniz.
                <div className="mt-1">
                  <Link className="btn btn-sm btn-success" to={`/personel/yeni?aday=${candidate.id}`}>
                    <UserPlus size={14} /> Personel kaydı oluştur
                  </Link>
                </div>
              </Alert>
            )}
          </div>
        )}
        <FormError message={f.formError} />
        <div className="form-grid">
          <Field label="İlan" required error={f.errors.posting_id} htmlFor="f-posting_id" className="full">
            <select className="select" {...f.bind('posting_id')}>
              <option value="">İlan seçiniz…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.company_name}
                  {j.status === 'kapali' ? ' (Kapalı)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ad" required error={f.errors.first_name} htmlFor="f-first_name">
            <input className="input" {...f.bind('first_name')} maxLength={80} autoComplete="off" />
          </Field>
          <Field label="Soyad" required error={f.errors.last_name} htmlFor="f-last_name">
            <input className="input" {...f.bind('last_name')} maxLength={80} autoComplete="off" />
          </Field>
          <Field label="E-posta" error={f.errors.email} htmlFor="f-email">
            <input className="input" type="email" {...f.bind('email')} maxLength={120} autoComplete="off" />
          </Field>
          <Field label="Telefon" error={f.errors.phone} htmlFor="f-phone">
            <input className="input" type="tel" {...f.bind('phone')} maxLength={40} placeholder="05xx xxx xx xx" autoComplete="off" />
          </Field>
          <Field label="Başvuru kaynağı" error={f.errors.source} htmlFor="f-source">
            <input className="input" list="rec-candidate-sources" {...f.bind('source')} maxLength={60} placeholder="Seçin veya yazın" />
            <datalist id="rec-candidate-sources">
              {(candidateSources ?? []).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Aşama" error={f.errors.stage} htmlFor="f-stage">
            <select className="select" {...f.bind('stage')}>
              {Object.entries(candidateStages ?? {}).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Değerlendirme" error={f.errors.rating}>
            <div className="rec-rating-input" role="group" aria-label="Aday puanı (1–5)">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`rec-star-btn ${rating >= n ? 'on' : ''}`}
                  aria-label={`${n} puan`}
                  aria-pressed={rating === n}
                  title={`${n} / 5`}
                  onClick={() => f.set('rating', rating === n ? null : n)}
                >
                  <Star size={22} fill={rating >= n ? 'currentColor' : 'none'} />
                </button>
              ))}
              {rating ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => f.set('rating', null)}>
                  Temizle
                </button>
              ) : (
                <span className="small muted">Puanlanmadı</span>
              )}
            </div>
          </Field>
          <Field label="Maaş beklentisi (₺)" error={f.errors.expected_salary} htmlFor="f-expected_salary">
            <input className="input" type="number" min={0} step={500} {...f.bind('expected_salary')} placeholder="ör. 75000" />
          </Field>
          <Field label="Notlar" error={f.errors.notes} htmlFor="f-notes" className="full">
            <textarea className="textarea" rows={4} {...f.bind('notes')} maxLength={5000} placeholder="Mülakat notları, referans bilgileri…" />
          </Field>
        </div>
        {isEdit && (
          <div className="small muted mt-2">
            Kayıt: {formatDateTime(candidate.created_at)} · Son güncelleme: {formatDateTime(candidate.updated_at)}
          </div>
        )}
      </form>
    </Modal>
  );
}
