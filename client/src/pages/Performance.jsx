import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Award, CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import EmployeeSelect from '../components/EmployeeSelect.jsx';
import {
  Alert,
  Badge,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  KeyValue,
  Loading,
  Modal,
  PageHeader,
  PersonCell,
  SearchInput,
  useConfirm,
  useForm,
  useToast,
} from '../components/ui.jsx';
import { formatDate, formatDateTime, formatNumber, matches, todayStr } from '../format.js';
import './Performance.css';

const SCORE_LABELS = { 1: 'Yetersiz', 2: 'Gelişmeli', 3: 'Beklenen', 4: 'İyi', 5: 'Mükemmel' };
const SCORES = [1, 2, 3, 4, 5];
const STATUS = { taslak: ['amber', 'Taslak'], tamamlandi: ['green', 'Tamamlandı'] };

function ReviewStatusBadge({ status }) {
  const [tone, label] = STATUS[status] ?? ['', status];
  return <Badge tone={tone}>{label}</Badge>;
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

const formatScore = (v) => (v == null ? '—' : formatNumber(v, 2));

function OverallCell({ value }) {
  if (value == null) return <span className="muted">—</span>;
  return (
    <div className="perf-score-cell">
      <span>
        <span className="strong num">{formatScore(value)}</span> <span className="small muted">/ 5</span>
      </span>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${(value / 5) * 100}%` }} />
      </div>
    </div>
  );
}

function AckCell({ review }) {
  if (review.status !== 'tamamlandi') return <span className="muted">—</span>;
  return review.acknowledged_at ? <Badge tone="green">Okundu {formatDate(review.acknowledged_at)}</Badge> : <Badge>Bekliyor</Badge>;
}

function ScoreScale({ value }) {
  return (
    <span
      className={`perf-scale ${value ? `s${value}` : ''}`}
      role="img"
      aria-label={value ? `${value} / 5 – ${SCORE_LABELS[value]}` : 'Puanlanmadı'}
    >
      {SCORES.map((n) => (
        <i key={n} className={value >= n ? 'on' : ''} />
      ))}
    </span>
  );
}

/** Onay penceresi açıkken Escape tuşunun alttaki formu da kapatmasını önler. */
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

export default function Performance() {
  const { user, isHR, hasRole } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useApi('/reviews');
  const [period, setPeriod] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null); // { review? }
  const [acking, setAcking] = useState(false);

  const isPersonnel = user.role === 'personel';
  const canCreate = hasRole('admin', 'ik', 'yonetici');
  const closeDetail = useCallback(() => setSelectedId(null), []);
  const closeForm = useCallback(() => setForm(null), []);

  const periods = useMemo(() => [...new Set((data ?? []).map((r) => r.period))].sort((a, b) => b.localeCompare(a, 'tr')), [data]);
  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (r) =>
          (!period || r.period === period) &&
          (!status || r.status === status) &&
          matches(`${r.employee_name} ${r.position ?? ''} ${r.department_name ?? ''} ${r.reviewer_name ?? ''}`, search),
      ),
    [data, period, status, search],
  );

  if (!data && loading) return <Loading />;
  if (!data) return <ErrorState error={error} onRetry={reload} />;

  const selected = selectedId ? data.find((r) => r.id === selectedId) : null;
  const pendingAck = data.filter((r) => r.employee_id === user.employee_id && r.status === 'tamamlandi' && !r.acknowledged_at);
  const canDelete = (r) => isHR || (r.status === 'taslak' && r.reviewer_id === user.id);

  const remove = async (r) => {
    const ok = await confirm({
      title: 'Değerlendirmeyi sil',
      message: `${r.employee_name} için “${r.period}” değerlendirmesi kalıcı olarak silinecek.`,
      confirmText: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/reviews/${r.id}`);
      toast.success('Değerlendirme silindi.');
      setSelectedId(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const acknowledge = async (r) => {
    setAcking(true);
    try {
      await api.post(`/reviews/${r.id}/acknowledge`);
      toast.success('Değerlendirmeyi okuduğunuz kaydedildi.');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAcking(false);
    }
  };

  const columns = [
    !isPersonnel && {
      key: 'employee_name',
      header: 'Personel',
      render: (r) => (
        <PersonCell
          name={r.employee_name}
          sub={[r.position, r.department_name].filter(Boolean).join(' · ')}
          to={r.employee_id !== user.employee_id ? `/personel/${r.employee_id}` : undefined}
        />
      ),
    },
    { key: 'period', header: 'Dönem', render: (r) => <span className="nowrap">{r.period}</span> },
    { key: 'overall', header: 'Genel Puan', render: (r) => <OverallCell value={r.overall} /> },
    !isPersonnel && {
      key: 'status',
      header: 'Durum',
      render: (r) => <ReviewStatusBadge status={r.status} />,
    },
    { key: 'reviewer_name', header: 'Değerlendiren', render: (r) => r.reviewer_name ?? '—' },
    {
      key: 'acknowledged_at',
      header: 'Çalışan Onayı',
      render: (r) => <AckCell review={r} />,
      sortValue: (r) => (r.status === 'tamamlandi' ? (r.acknowledged_at ?? '') : null),
    },
  ].filter(Boolean);

  const subtitle = isPersonnel
    ? 'Tamamlanan performans değerlendirmelerinizi görüntüleyin ve okuduğunuzu onaylayın. Taslak değerlendirmeler tamamlandığında burada görünür.'
    : isHR
      ? 'Grup şirketlerindeki tüm performans değerlendirmelerini oluşturun ve takip edin.'
      : 'Ekibinizdeki çalışanların performans değerlendirmelerini oluşturun ve takip edin.';

  const hasFilters = !!(period || status || search);

  return (
    <>
      <PageHeader
        title={isPersonnel ? 'Performans Değerlendirmelerim' : 'Performans Değerlendirme'}
        subtitle={subtitle}
        actions={
          canCreate && (
            <button className="btn btn-primary" onClick={() => setForm({})}>
              <Plus size={16} /> Yeni Değerlendirme
            </button>
          )
        }
      />

      {pendingAck.length > 0 && (
        <div className="mb-2">
          <Alert tone="info" title="Onayınızı bekleyen değerlendirme var">
            {pendingAck.length === 1
              ? `“${pendingAck[0].period}” değerlendirmeniz tamamlandı.`
              : `${pendingAck.length} değerlendirmeniz tamamlandı.`}{' '}
            İnceledikten sonra “Okudum, bilgi edindim” ile onaylayabilirsiniz.
            <div className="mt-1">
              <button className="btn btn-sm" onClick={() => setSelectedId(pendingAck[0].id)}>
                Değerlendirmeyi aç
              </button>
            </div>
          </Alert>
        </div>
      )}

      {data.length > 0 && (
        <div className="toolbar">
          {!isPersonnel && <SearchInput value={search} onChange={setSearch} placeholder="Personel veya değerlendiren ara…" />}
          {periods.length > 1 && (
            <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Dönem">
              <option value="">Tüm dönemler</option>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          {!isPersonnel && (
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Durum">
              <option value="">Tüm durumlar</option>
              <option value="taslak">Taslak</option>
              <option value="tamamlandi">Tamamlandı</option>
            </select>
          )}
          {hasFilters && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setPeriod('');
                setStatus('');
                setSearch('');
              }}
            >
              Filtreleri temizle
            </button>
          )}
        </div>
      )}

      <div className="card">
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(r) => setSelectedId(r.id)}
          empty={
            data.length === 0 ? (
              <EmptyState title={isPersonnel ? 'Henüz tamamlanmış bir değerlendirmeniz yok' : 'Henüz değerlendirme yapılmadı'} icon={Award}>
                {isPersonnel
                  ? 'Yöneticiniz değerlendirmenizi tamamladığında burada görüntüleyebilirsiniz.'
                  : canCreate && '“Yeni Değerlendirme” ile ilk değerlendirmeyi oluşturun.'}
              </EmptyState>
            ) : (
              <EmptyState title="Filtreyle eşleşen değerlendirme bulunamadı" />
            )
          }
        />
      </div>

      {selected && (
        <ReviewDetailModal
          key={selected.id}
          review={selected}
          isOwn={selected.employee_id === user.employee_id}
          canDelete={canDelete(selected)}
          acking={acking}
          onClose={closeDetail}
          onEdit={() => {
            setSelectedId(null);
            setForm({ review: selected });
          }}
          onDelete={() => remove(selected)}
          onAcknowledge={() => acknowledge(selected)}
        />
      )}

      {form && (
        <ReviewFormModal
          key={form.review?.id ?? 'new'}
          review={form.review}
          existing={data}
          periods={periods}
          onClose={closeForm}
          onSaved={() => {
            setForm(null);
            reload();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Detay
// ---------------------------------------------------------------------------

function TextSection({ title, text }) {
  return (
    <>
      <div className="perf-section-title">{title}</div>
      {text ? <div className="perf-text">{text}</div> : <div className="muted small">Belirtilmemiş.</div>}
    </>
  );
}

function ReviewDetailModal({ review: r, isOwn, canDelete, acking, onClose, onEdit, onDelete, onAcknowledge }) {
  const { reviewCriteria = [] } = useLookups();

  return (
    <Modal
      open
      onClose={onClose}
      title="Performans Değerlendirmesi"
      size="lg"
      footer={
        <>
          {canDelete && (
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={onDelete}>
              <Trash2 size={15} /> Sil
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Kapat
          </button>
          {r.can_edit && (
            <button className="btn btn-primary" onClick={onEdit}>
              <Pencil size={15} /> Düzenle
            </button>
          )}
        </>
      }
    >
      <div className="perf-head">
        <PersonCell name={r.employee_name} sub={[r.position, r.department_name, r.company_name].filter(Boolean).join(' · ')} size="lg" />
        <div className="perf-overall">
          <div className="perf-overall-value">
            {formatScore(r.overall)} <small>/ 5</small>
          </div>
          <div className="small muted">Genel puan</div>
        </div>
      </div>

      <KeyValue
        items={[
          ['Dönem', r.period],
          ['Durum', <ReviewStatusBadge key="s" status={r.status} />],
          ['Değerlendiren', r.reviewer_name],
          ['Son güncelleme', formatDateTime(r.updated_at)],
          r.status === 'tamamlandi' && [
            'Çalışan onayı',
            r.acknowledged_at ? `Okundu – ${formatDateTime(r.acknowledged_at)}` : 'Henüz okunmadı',
          ],
        ]}
      />

      <div className="perf-section-title">Kriter Puanları</div>
      <ul className="perf-criteria">
        {reviewCriteria.map((c) => {
          const s = r.scores?.[c.code];
          return (
            <li key={c.code}>
              <span>{c.label}</span>
              <ScoreScale value={s} />
              <span className="perf-score-label">{s ? `${s} – ${SCORE_LABELS[s]}` : 'Puanlanmadı'}</span>
            </li>
          );
        })}
      </ul>

      <TextSection title="Güçlü Yönler" text={r.strengths} />
      <TextSection title="Gelişim Alanları" text={r.improvements} />
      <TextSection title="Hedefler" text={r.goals} />

      {isOwn && r.status === 'tamamlandi' && (
        <div className="mt-3">
          {r.acknowledged_at ? (
            <Alert tone="success">Bu değerlendirmeyi {formatDateTime(r.acknowledged_at)} tarihinde okuduğunuzu onayladınız.</Alert>
          ) : (
            <Alert tone="info" title="Onayınız bekleniyor">
              Değerlendirmenizi inceledikten sonra okuduğunuzu onaylayın. Onay, içeriğe katıldığınız anlamına gelmez; yalnızca bilgi
              edindiğinizi gösterir.
              <div className="mt-1">
                <button className="btn btn-success btn-sm" onClick={onAcknowledge} disabled={acking}>
                  <CheckCircle2 size={15} /> {acking ? 'Kaydediliyor…' : 'Okudum, bilgi edindim'}
                </button>
              </div>
            </Alert>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

function ReviewFormModal({ review, existing, periods, onClose, onSaved }) {
  const { user, isHR } = useAuth();
  const { reviewCriteria = [] } = useLookups();
  const toast = useToast();
  const [ask, guardedClose] = useGuardedConfirm(onClose);
  const isEdit = !!review?.id;
  const wasCompleted = review?.status === 'tamamlandi';
  const [showMissing, setShowMissing] = useState(false);
  const team = useApi(!isHR && !isEdit ? '/employees' : null);

  const f = useForm({
    employee_id: review?.employee_id ?? '',
    period: review?.period ?? '',
    scores: { ...(review?.scores ?? {}) },
    strengths: review?.strengths ?? '',
    improvements: review?.improvements ?? '',
    goals: review?.goals ?? '',
  });

  const year = Number(todayStr().slice(0, 4));
  const suggestions = [...new Set([`${year} Yıl Sonu`, `${year} Ara Dönem`, `${year + 1} Ara Dönem`, `${year - 1} Yıl Sonu`, ...periods])];
  const teamOptions = (team.data ?? []).filter((e) => e.id !== user.employee_id);

  const scores = f.values.scores;
  const scored = reviewCriteria.filter((c) => scores[c.code]);
  const average = scored.length ? scored.reduce((sum, c) => sum + scores[c.code], 0) / scored.length : null;

  const duplicate =
    !isEdit &&
    f.values.employee_id &&
    f.values.period.trim() &&
    existing.some((r) => r.employee_id === Number(f.values.employee_id) && r.period === f.values.period.trim());

  const setScore = (code, n) => {
    const next = { ...scores };
    if (next[code] === n) delete next[code];
    else next[code] = n;
    f.set('scores', next);
  };

  const save = async (status) => {
    if (status === 'tamamlandi') {
      const missing = reviewCriteria.filter((c) => !scores[c.code]);
      if (missing.length) {
        setShowMissing(true);
        f.setFormError(`Değerlendirmeyi tamamlamak için tüm kriterleri puanlayın. Eksik: ${missing.map((c) => c.label).join(', ')}.`);
        return;
      }
      if (!wasCompleted) {
        const ok = await ask({
          title: 'Değerlendirmeyi tamamla',
          message:
            'Tamamlanan değerlendirmeyi çalışan kendi hesabından görüntüleyebilecek ve okuduğunu onaylayabilecek. ' +
            'Tamamlandıktan sonra değerlendirmeyi yalnızca İK düzenleyebilir. Devam etmek istiyor musunuz?',
          confirmText: 'Tamamla',
        });
        if (!ok) return;
      }
    }
    await f.submit(async (v) => {
      const body = { ...v, period: v.period.trim(), status };
      if (isEdit) await api.put(`/reviews/${review.id}`, body);
      else await api.post('/reviews', body);
      toast.success(status === 'tamamlandi' ? 'Değerlendirme tamamlandı.' : 'Değerlendirme taslak olarak kaydedildi.');
      onSaved();
    });
  };

  return (
    <Modal
      open
      onClose={guardedClose}
      title={isEdit ? 'Değerlendirmeyi Düzenle' : 'Yeni Değerlendirme'}
      size="lg"
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn" onClick={() => save('taslak')} disabled={f.submitting}>
            {wasCompleted ? 'Taslağa Al' : 'Taslak Kaydet'}
          </button>
          <button className="btn btn-primary" onClick={() => save('tamamlandi')} disabled={f.submitting}>
            {wasCompleted ? 'Kaydet' : 'Tamamla'}
          </button>
        </>
      }
    >
      <form id="review-form" onSubmit={(e) => e.preventDefault()} noValidate>
        <FormError message={f.formError} />
        <div className="form-grid">
          <Field label="Personel" required error={f.errors.employee_id} htmlFor="f-employee_id">
            {isEdit ? (
              <input id="f-employee_id" className="input" value={review.employee_name} disabled />
            ) : isHR ? (
              <EmployeeSelect
                id="f-employee_id"
                value={f.values.employee_id}
                onChange={(id) => f.set('employee_id', id)}
                invalid={!!f.errors.employee_id}
              />
            ) : (
              <select className="select" {...f.bind('employee_id')} disabled={team.loading}>
                <option value="">{team.loading ? 'Yükleniyor…' : 'Personel seçiniz…'}</option>
                {teamOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                    {e.position ? ` — ${e.position}` : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Dönem" required error={f.errors.period} htmlFor="f-period">
            <input className="input" list="perf-period-list" {...f.bind('period')} maxLength={60} placeholder={`ör. ${year} Yıl Sonu`} />
            <datalist id="perf-period-list">
              {suggestions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
        </div>
        {!isHR && !isEdit && team.data && teamOptions.length === 0 && (
          <div className="mt-1">
            <Alert tone="warning">Size bağlı çalışan bulunamadı.</Alert>
          </div>
        )}
        {duplicate && (
          <div className="mt-1">
            <Alert tone="warning">Bu personel için aynı döneme ait bir değerlendirme zaten var.</Alert>
          </div>
        )}

        <div className="perf-section-title">Yetkinlik Puanları</div>
        <div className="perf-legend">
          {SCORES.map((n) => (
            <span key={n}>
              <b>{n}</b> {SCORE_LABELS[n]}
            </span>
          ))}
        </div>
        {reviewCriteria.map((c) => {
          const value = scores[c.code];
          return (
            <div key={c.code} className="perf-score-row" role="group" aria-labelledby={`perf-c-${c.code}`}>
              <span className="perf-score-name" id={`perf-c-${c.code}`}>
                {c.label}
              </span>
              <div className="perf-seg">
                {SCORES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={value === n ? 'active' : ''}
                    aria-pressed={value === n}
                    aria-label={`${n} – ${SCORE_LABELS[n]}`}
                    title={SCORE_LABELS[n]}
                    onClick={() => setScore(c.code, n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className={`perf-score-label ${value ? '' : showMissing ? 'text-danger' : 'muted'}`}>
                {value ? SCORE_LABELS[value] : 'Puanlanmadı'}
              </span>
            </div>
          );
        })}
        <div className="perf-avg" aria-live="polite">
          <span>
            Genel ortalama{' '}
            <span className="small">
              ({scored.length}/{reviewCriteria.length} kriter puanlandı)
            </span>
          </span>
          <span className="perf-avg-value">
            {average == null ? '—' : formatScore(average)} <span className="small">/ 5</span>
          </span>
        </div>

        <div className="form-grid mt-2">
          <Field label="Güçlü yönler" error={f.errors.strengths} htmlFor="f-strengths" className="full">
            <textarea className="textarea" rows={3} {...f.bind('strengths')} maxLength={3000} />
          </Field>
          <Field label="Gelişim alanları" error={f.errors.improvements} htmlFor="f-improvements" className="full">
            <textarea className="textarea" rows={3} {...f.bind('improvements')} maxLength={3000} />
          </Field>
          <Field label="Hedefler (sonraki dönem)" error={f.errors.goals} htmlFor="f-goals" className="full">
            <textarea className="textarea" rows={3} {...f.bind('goals')} maxLength={3000} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
