import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, CalendarRange, Landmark, Plus, Wallet } from 'lucide-react';
import { api, qs, useApi } from '../api.js';
import { useLookups } from '../lookups.jsx';
import { formatMoney, formatNumber, MONTHS, periodLabel } from '../format.js';
import {
  Alert,
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatCard,
  useForm,
  useToast,
} from '../components/ui.jsx';
import './Payroll.css';

function RunStatusBadge({ status }) {
  return status === 'onaylandi' ? <Badge tone="green">Onaylandı</Badge> : <Badge tone="amber">Taslak</Badge>;
}

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

/** Yıl seçenekleri: parametresi tanımlı yıllar + içinde bulunulan yıl ve bir önceki yıl. */
function useYearOptions() {
  const { data } = useApi('/payroll/params');
  return useMemo(() => {
    const set = new Set([CURRENT_YEAR, CURRENT_YEAR - 1, ...(data?.years ?? [])]);
    return [...set].sort((a, b) => b - a);
  }, [data]);
}

export default function PayrollRuns() {
  const navigate = useNavigate();
  const { companies, companyName } = useLookups();
  const years = useYearOptions();
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [companyId, setCompanyId] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, loading, error, reload } = useApi(`/payroll/runs${qs({ year, company_id: companyId })}`);

  const runs = data ?? [];
  const totals = useMemo(
    () =>
      runs.reduce(
        (s, r) => ({ gross: s.gross + r.total_gross, net: s.net + r.total_net, cost: s.cost + r.total_cost }),
        { gross: 0, net: 0, cost: 0 },
      ),
    [runs],
  );
  const drafts = runs.filter((r) => r.status === 'taslak').length;

  const columns = [
    {
      key: 'period',
      header: 'Dönem',
      sortValue: (r) => r.year * 100 + r.month,
      render: (r) => <span className="strong">{periodLabel(r.year, r.month)}</span>,
    },
    { key: 'company_name', header: 'Şirket' },
    { key: 'employee_count', header: 'Personel', align: 'right', render: (r) => formatNumber(r.employee_count) },
    { key: 'total_gross', header: 'Toplam Brüt', align: 'right', render: (r) => formatMoney(r.total_gross) },
    { key: 'total_net', header: 'Toplam Net', align: 'right', render: (r) => formatMoney(r.total_net) },
    { key: 'total_cost', header: 'İşveren Maliyeti', align: 'right', render: (r) => formatMoney(r.total_cost) },
    { key: 'status', header: 'Durum', render: (r) => <RunStatusBadge status={r.status} /> },
  ];

  const scope = companyId ? companyName(companyId) : 'Tüm şirketler';

  return (
    <>
      <PageHeader
        title="Bordro Dönemleri"
        subtitle="Şirket bazında aylık bordroları oluşturun, kontrol edin ve onaylayın."
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Yeni Bordro Dönemi
          </button>
        }
      />

      <div className="toolbar">
        <select className="select" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Yıl">
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Şirket">
          <option value="">Tüm şirketler</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : (
        <div className="stack">
          <div className="grid grid-4">
            <StatCard icon={Banknote} label="Toplam brüt" value={formatMoney(totals.gross, { whole: true })} sub={`${year} · ${scope}`} />
            <StatCard icon={Wallet} tone="green" label="Toplam net" value={formatMoney(totals.net, { whole: true })} sub="Çalışanlara ödenen" />
            <StatCard
              icon={Landmark}
              tone="teal"
              label="Toplam işveren maliyeti"
              value={formatMoney(totals.cost, { whole: true })}
              sub="Brüt + işveren SGK ve işsizlik payı"
            />
            <StatCard
              icon={CalendarRange}
              tone={drafts ? 'amber' : ''}
              label="Dönem sayısı"
              value={formatNumber(runs.length)}
              sub={drafts ? `${drafts} taslak bordro onay bekliyor` : 'Tümü onaylı'}
            />
          </div>

          <Card flush>
            <DataTable
              columns={columns}
              rows={runs}
              onRowClick={(r) => navigate(`/bordro/${r.id}`)}
              initialSort={{ key: 'period', dir: 'desc' }}
              pageSize={50}
              empty={
                <EmptyState title={`${year} yılı için bordro dönemi bulunamadı`}>
                  Yeni bir bordro dönemi oluşturmak için “Yeni Bordro Dönemi” düğmesini kullanın.
                </EmptyState>
              }
            />
          </Card>
        </div>
      )}

      {creating && (
        <NewRunModal
          years={years}
          defaultCompanyId={companyId}
          onClose={() => setCreating(false)}
          onCreated={(run) => navigate(`/bordro/${run.id}`)}
        />
      )}
    </>
  );
}

function NewRunModal({ years, defaultCompanyId, onClose, onCreated }) {
  const { companies } = useLookups();
  const toast = useToast();
  const f = useForm({ company_id: defaultCompanyId ?? '', year: String(CURRENT_YEAR), month: String(CURRENT_MONTH) });
  const activeCompanies = companies.filter((c) => c.active);

  const save = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const run = await api.post('/payroll/runs', { company_id: v.company_id, year: Number(v.year), month: Number(v.month) });
      toast.success(`${periodLabel(run.year, run.month)} bordrosu oluşturuldu (${run.employee_count} personel).`);
      onCreated(run);
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Yeni Bordro Dönemi"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" form="new-run-form" className="btn btn-primary" disabled={f.submitting}>
            {f.submitting ? 'Oluşturuluyor…' : 'Bordroyu Oluştur'}
          </button>
        </>
      }
    >
      <form id="new-run-form" onSubmit={save} className="stack">
        {f.formError && <Alert tone="error">{f.formError}</Alert>}
        <div className="form-grid">
          <Field label="Şirket" required error={f.errors.company_id} htmlFor="f-company_id" className="full">
            <select className="select" {...f.bind('company_id')}>
              <option value="">Şirket seçiniz…</option>
              {activeCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Yıl" required error={f.errors.year} htmlFor="f-year">
            <select className="select" {...f.bind('year')}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ay" required error={f.errors.month} htmlFor="f-month">
            <select className="select" {...f.bind('month')}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Alert tone="info">
          Seçilen şirkette o ay çalışan tüm personel bordroya otomatik olarak eklenir. Onaylı ücretsiz izinler ile ay içindeki işe
          giriş ve çıkışlar prim gününü azaltır. Ek ödeme ve kesintileri taslak bordroda satır bazında girebilirsiniz.
        </Alert>
      </form>
    </Modal>
  );
}
