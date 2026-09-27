import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Megaphone, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import {
  Alert,
  Badge,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  SearchInput,
  useConfirm,
  useForm,
  useToast,
} from '../components/ui.jsx';
import { formatDateTime, matches } from '../format.js';
import './Announcements.css';

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

export default function Announcements() {
  const { isHR } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useApi('/announcements');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // {} yeni, { announcement } düzenleme
  const closeModal = useCallback(() => setEditing(null), []);

  const list = useMemo(
    () =>
      (data ?? []).filter((a) =>
        matches(`${a.title} ${a.body} ${a.company_name ?? 'Tüm Grup'} ${a.author_name ?? ''}`, search),
      ),
    [data, search],
  );

  if (!data && loading) return <Loading />;
  if (!data) return <ErrorState error={error} onRetry={reload} />;

  const remove = async (a) => {
    const ok = await confirm({
      title: 'Duyuruyu sil',
      message: `“${a.title}” başlıklı duyuru kalıcı olarak silinecek.`,
      confirmText: 'Sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/announcements/${a.id}`);
      toast.success('Duyuru silindi.');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Duyurular"
        subtitle={
          isHR
            ? 'Tüm grup şirketlerine veya tek bir şirkete duyuru yayınlayın.'
            : 'FIMAR Holding ve şirketinizle ilgili güncel duyurular.'
        }
        actions={
          isHR && (
            <button className="btn btn-primary" onClick={() => setEditing({})}>
              <Plus size={16} /> Yeni Duyuru
            </button>
          )
        }
      />

      {data.length > 0 && (
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Duyurularda ara…" />
          {search && (
            <span className="small muted">
              {list.length} / {data.length} duyuru
            </span>
          )}
        </div>
      )}

      {data.length === 0 ? (
        <div className="card">
          <EmptyState title="Henüz duyuru yayınlanmadı" icon={Megaphone}>
            {isHR ? '“Yeni Duyuru” ile ilk duyurunuzu yayınlayabilirsiniz.' : 'Yeni duyurular burada görünecek.'}
          </EmptyState>
        </div>
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState title="Aramanızla eşleşen duyuru bulunamadı" />
        </div>
      ) : (
        <div className="ann-list">
          {list.map((a) => (
            <article key={a.id} className={`card ann-card ${a.pinned ? 'pinned' : ''}`}>
              <div className="ann-head">
                <div style={{ minWidth: 0 }}>
                  <h2 className="ann-title">
                    {a.pinned ? <Pin size={16} aria-label="Sabitlenmiş duyuru" /> : null}
                    {a.title}
                  </h2>
                  <div className="ann-meta">
                    {a.company_id ? <Badge>{a.company_name}</Badge> : <Badge tone="teal">Tüm Grup</Badge>}
                    <span className="nowrap">
                      {a.author_name ?? 'İnsan Kaynakları'} · <time dateTime={a.created_at}>{formatDateTime(a.created_at)}</time>
                    </span>
                  </div>
                </div>
                {isHR && (
                  <div className="ann-actions">
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => setEditing({ announcement: a })}
                      aria-label={`“${a.title}” duyurusunu düzenle`}
                      title="Düzenle"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => remove(a)}
                      aria-label={`“${a.title}” duyurusunu sil`}
                      title="Sil"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              <div className="ann-body">{a.body}</div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <AnnouncementModal
          key={editing.announcement?.id ?? 'new'}
          announcement={editing.announcement}
          onClose={closeModal}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function AnnouncementModal({ announcement, onClose, onSaved }) {
  const { companies } = useLookups();
  const toast = useToast();
  const isEdit = !!announcement?.id;
  const f = useForm({
    title: announcement?.title ?? '',
    body: announcement?.body ?? '',
    company_id: announcement?.company_id ?? '',
    pinned: !!announcement?.pinned,
  });

  const companyOptions = companies.filter((c) => c.active || c.id === Number(f.values.company_id));

  const save = (e) => {
    e?.preventDefault();
    return f.submit(async (v) => {
      const body = { title: v.title, body: v.body, company_id: v.company_id ? Number(v.company_id) : null, pinned: !!v.pinned };
      if (isEdit) await api.put(`/announcements/${announcement.id}`, body);
      else await api.post('/announcements', body);
      toast.success(isEdit ? 'Duyuru güncellendi.' : 'Duyuru yayınlandı.');
      onSaved();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Duyuruyu Düzenle' : 'Yeni Duyuru'}
      size="lg"
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn btn-primary" type="submit" form="announcement-form" disabled={f.submitting}>
            {f.submitting ? 'Kaydediliyor…' : isEdit ? 'Kaydet' : 'Yayınla'}
          </button>
        </>
      }
    >
      <form id="announcement-form" onSubmit={save} noValidate>
        <FormError message={f.formError} />
        <div className="form-grid">
          <Field label="Başlık" required error={f.errors.title} htmlFor="f-title" className="full">
            <input className="input" {...f.bind('title')} maxLength={200} />
          </Field>
          <Field label="Duyuru metni" required error={f.errors.body} htmlFor="f-body" className="full">
            <textarea className="textarea" rows={12} style={{ minHeight: 240 }} {...f.bind('body')} maxLength={10000} />
          </Field>
          <Field
            label="Kapsam"
            error={f.errors.company_id}
            htmlFor="f-company_id"
            hint="Şirket seçilirse duyuruyu yalnızca o şirketin çalışanları görür."
          >
            <select className="select" {...f.bind('company_id')}>
              <option value="">Tüm grup şirketleri</option>
              {companyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Öne çıkarma" hint="Sabitlenen duyurular listenin en üstünde gösterilir.">
            <label className="checkbox" style={{ minHeight: 36 }}>
              <input type="checkbox" {...f.bind('pinned', { type: 'checkbox' })} />
              Sabitle
            </label>
          </Field>
        </div>
      </form>
    </Modal>
  );
}
