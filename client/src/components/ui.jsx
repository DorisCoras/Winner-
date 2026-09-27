import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Info, Inbox, Search, X } from 'lucide-react';
import { avatarColor, initials } from '../format.js';

// ---------------------------------------------------------------------------
// Sayfa düzeni
// ---------------------------------------------------------------------------

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="page-header">
      <div>
        {back && (
          <Link className="back-link" to={back.to}>
            <ArrowLeft size={14} /> {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, hint, actions, children, flush, footer, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            {title && <h2>{title}</h2>}
            {hint && <div className="hint">{hint}</div>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={`card-body ${flush ? 'flush' : ''}`}>{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </section>
  );
}

export function StatCard({ icon: Icon, label, value, sub, tone = '', to }) {
  const inner = (
    <>
      {Icon && (
        <div className={`stat-icon ${tone}`}>
          <Icon size={19} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </>
  );
  return to ? (
    <Link to={to} className="card stat">
      {inner}
    </Link>
  ) : (
    <div className="card stat">{inner}</div>
  );
}

// ---------------------------------------------------------------------------
// Rozetler
// ---------------------------------------------------------------------------

export function Badge({ tone = '', children, dot }) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <i className="dot" style={{ background: dot }} />}
      {children}
    </span>
  );
}

const LEAVE_STATUS = {
  beklemede: ['amber', 'Onay Bekliyor'],
  onaylandi: ['green', 'Onaylandı'],
  reddedildi: ['red', 'Reddedildi'],
  iptal: ['', 'İptal Edildi'],
};
export function LeaveStatusBadge({ status }) {
  const [tone, label] = LEAVE_STATUS[status] ?? ['', status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function EmployeeStatusBadge({ status }) {
  return status === 'aktif' ? <Badge tone="green">Aktif</Badge> : <Badge tone="red">Ayrıldı</Badge>;
}

// ---------------------------------------------------------------------------
// Kişi / avatar
// ---------------------------------------------------------------------------

export function Avatar({ name, size = '' }) {
  return (
    <span className={`avatar ${size}`} style={{ background: avatarColor(name) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** Avatar + ad + alt satır. `to` verilirse ad bağlantı olur. */
export function PersonCell({ name, sub, to, size = '' }) {
  return (
    <div className="person">
      <Avatar name={name} size={size} />
      <div style={{ minWidth: 0 }}>
        {to ? (
          <Link className="person-name" to={to} onClick={(e) => e.stopPropagation()}>
            {name}
          </Link>
        ) : (
          <div className="person-name">{name}</div>
        )}
        {sub && <div className="person-sub truncate">{sub}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Durum ekranları
// ---------------------------------------------------------------------------

export function Loading({ text = 'Yükleniyor…' }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" /> {text}
    </div>
  );
}

export function EmptyState({ title = 'Kayıt bulunamadı', children, icon: Icon = Inbox }) {
  return (
    <div className="empty">
      <Icon size={36} />
      <div className="empty-title">{title}</div>
      {children && <div className="small">{children}</div>}
    </div>
  );
}

export function Alert({ tone = 'info', children, title }) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'warning' ? AlertTriangle : tone === 'success' ? CheckCircle2 : Info;
  return (
    <div className={`alert ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={17} />
      <div>
        {title && <div className="strong">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  if (!error) return null;
  return (
    <div style={{ padding: 16 }}>
      <Alert tone="error" title={error.status === 403 ? 'Yetkisiz erişim' : 'Bir hata oluştu'}>
        {error.message}
        {onRetry && (
          <div className="mt-1">
            <button className="btn btn-sm" onClick={onRetry}>
              Tekrar dene
            </button>
          </div>
        )}
      </Alert>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sekmeler
// ---------------------------------------------------------------------------

/** tabs: [{ key, label, count?, icon? }] */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          className={`tab ${active === t.key ? 'active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.icon && <t.icon size={15} />}
          {t.label}
          {t.count !== undefined && t.count !== null && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal, onay kutusu, bildirimler
// ---------------------------------------------------------------------------

export function Modal({ open, onClose, title, children, footer, size = '' }) {
  const ref = useRef(null);
  // onClose ref'te tutulur: ebeveyn her render'da yeni fonksiyon verse de odak/scroll sıfırlanmaz.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // İlk form alanına odaklan
    const t = setTimeout(() => {
      const el = ref.current?.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
      (el ?? ref.current)?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Kapat">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

const ConfirmContext = createContext(null);
const ToastContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null);
  const [toasts, setToasts] = useState([]);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setConfirmState({ ...opts, resolve });
      }),
    [],
  );
  const closeConfirm = (result) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  const push = useCallback((type, message) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 6000 : 3500);
  }, []);
  const toast = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      <ToastContext.Provider value={toast}>
        {children}
        <Modal
          open={!!confirmState}
          onClose={() => closeConfirm(false)}
          title={confirmState?.title ?? 'Emin misiniz?'}
          size="sm"
          footer={
            <>
              <button className="btn" onClick={() => closeConfirm(false)}>
                Vazgeç
              </button>
              <button className={`btn ${confirmState?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => closeConfirm(true)}>
                {confirmState?.confirmText ?? 'Onayla'}
              </button>
            </>
          }
        >
          <div>{confirmState?.message}</div>
        </Modal>
        <div className="toast-stack" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.type === 'success' ? (
                <CheckCircle2 size={18} className="text-success" />
              ) : t.type === 'error' ? (
                <AlertCircle size={18} className="text-danger" />
              ) : (
                <Info size={18} />
              )}
              <div className="toast-msg">{t.message}</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))} aria-label="Kapat">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </ConfirmContext.Provider>
  );
}

/** const confirm = useConfirm(); if (await confirm({ title, message, confirmText, danger })) ... */
export const useConfirm = () => useContext(ConfirmContext);
/** const toast = useToast(); toast.success('Kaydedildi'); toast.error(err.message) */
export const useToast = () => useContext(ToastContext);

// ---------------------------------------------------------------------------
// Form yardımcıları
// ---------------------------------------------------------------------------

export function Field({ label, error, hint, required, children, className = '', htmlFor }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label htmlFor={htmlFor}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error ? <div className="field-error">{error}</div> : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}

/**
 * Basit form durumu.
 *   const f = useForm({ name: '' });
 *   <input className="input" {...f.bind('name')} />
 *   <Field error={f.errors.name}>…</Field>
 *   try { await api.post(...) } catch (err) { f.handleError(err) }
 */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const set = useCallback((name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  }, []);

  const bind = (name, { type } = {}) => ({
    id: `f-${name}`,
    name,
    value: type === 'checkbox' ? undefined : (values[name] ?? ''),
    checked: type === 'checkbox' ? !!values[name] : undefined,
    'aria-invalid': errors[name] ? 'true' : undefined,
    onChange: (e) => set(name, type === 'checkbox' ? e.target.checked : e.target.value),
  });

  const handleError = (err) => {
    setErrors(err?.fields ?? {});
    setFormError(err?.message ?? 'Beklenmeyen bir hata oluştu.');
  };

  /** submit(async () => {...}) — hata yönetimi ve submitting durumunu üstlenir. */
  const submit = async (fn) => {
    setSubmitting(true);
    setFormError(null);
    try {
      return await fn(values);
    } catch (err) {
      handleError(err);
      return undefined;
    } finally {
      setSubmitting(false);
    }
  };

  return { values, setValues, set, bind, errors, setErrors, handleError, submitting, submit, formError, setFormError };
}

export function SearchInput({ value, onChange, placeholder = 'Ara…' }) {
  return (
    <div className="search-input">
      <Search size={16} />
      <input className="input" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tablo
// ---------------------------------------------------------------------------

/**
 * columns: [{ key, header, render?: (row) => node, sortValue?: (row) => any, align?: 'right', width?, className? }]
 * Sütun başlığına tıklayınca sıralanır (sortValue veya row[key]).
 */
export function DataTable({ columns, rows, rowKey = 'id', onRowClick, empty, pageSize = 25, footer, compact, initialSort }) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const get = col.sortValue ?? ((r) => r[col.key]);
    const list = [...rows];
    list.sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'tr');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rows, sort, columns]);

  useEffect(() => setPage(0), [rows.length]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const visible = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (key) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  if (!rows.length) return empty ?? <EmptyState />;

  return (
    <>
      <div className="table-wrap">
        <table className={`table ${compact ? 'compact' : ''}`}>
          <thead>
            <tr>
              {columns.map((c) => {
                const sortable = c.sortable !== false && c.key && !c.key.startsWith('_');
                return (
                  <th
                    key={c.key}
                    className={`${c.align === 'right' ? 'num' : ''} ${sortable ? 'sortable' : ''}`}
                    style={c.width ? { width: c.width } : undefined}
                    onClick={sortable ? () => toggleSort(c.key) : undefined}
                    aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <span className="row" style={{ gap: 4, display: 'inline-flex', justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start' }}>
                      {c.header}
                      {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={row[rowKey] ?? i}
                className={onRowClick ? 'clickable' : ''}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`${c.align === 'right' ? 'num' : ''} ${c.className ?? ''}`}>
                    {c.render ? c.render(row) : (row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      {pages > 1 && (
        <div className="pagination">
          <span>
            {sorted.length} kayıttan {page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} arası
          </span>
          <div className="row">
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Önceki
            </button>
            <span>
              {page + 1} / {pages}
            </span>
            <button className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
              Sonraki
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Anahtar-değer listesi
// ---------------------------------------------------------------------------

/** items: [[etiket, değer], ...] — değer boşsa '—' gösterilir. */
export function KeyValue({ items }) {
  return (
    <dl className="kv">
      {items
        .filter(Boolean)
        .map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{v === null || v === undefined || v === '' ? '—' : v}</dd>
          </div>
        ))}
    </dl>
  );
}
