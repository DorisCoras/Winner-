import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banknote, CalendarCheck, FileText, Wallet } from 'lucide-react';
import { useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { formatMoney, periodLabel } from '../format.js';
import { Card, DataTable, EmptyState, ErrorState, Loading, PageHeader, StatCard } from '../components/ui.jsx';
import './Payroll.css';

export default function MyPayslips() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasEmployee = !!user?.employee_id;
  const { data, loading, error, reload } = useApi(hasEmployee ? '/payroll/my-payslips' : null);

  const rows = useMemo(() => data ?? [], [data]);
  const latest = rows[0];
  const yearRows = latest ? rows.filter((r) => r.year === latest.year) : [];
  const yearNet = yearRows.reduce((s, r) => s + r.net, 0);
  const yearGross = yearRows.reduce((s, r) => s + r.gross, 0);

  const header = (
    <PageHeader
      title="Bordrolarım"
      subtitle="Onaylanmış aylık ücret hesap pusulalarınızı görüntüleyin ve yazdırın."
      actions={
        <Link className="btn" to="/bordro-hesaplama">
          Maaş Hesaplama
        </Link>
      }
    />
  );

  if (!hasEmployee) {
    return (
      <>
        {header}
        <Card>
          <EmptyState title="Personel kaydı bulunamadı" icon={FileText}>
            Hesabınız bir personel kaydına bağlı olmadığı için bordro pusulası görüntülenemiyor.
          </EmptyState>
        </Card>
      </>
    );
  }
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;

  const columns = [
    {
      key: 'period',
      header: 'Dönem',
      sortValue: (r) => r.year * 100 + r.month,
      render: (r) => <span className="strong">{periodLabel(r.year, r.month)}</span>,
    },
    { key: 'company_name', header: 'Şirket' },
    { key: 'days', header: 'Gün', align: 'right' },
    {
      key: 'gross',
      header: 'Brüt',
      align: 'right',
      render: (r) => (
        <>
          {formatMoney(r.gross)}
          {r.extra_gross > 0 && <span className="cell-sub">Ek ödeme: {formatMoney(r.extra_gross)}</span>}
        </>
      ),
    },
    { key: 'net', header: 'Net', align: 'right', render: (r) => <span className="strong">{formatMoney(r.net)}</span> },
    {
      key: '_open',
      header: '',
      align: 'right',
      render: (r) => (
        <Link
          className="btn btn-ghost btn-icon btn-sm"
          to={`/bordro-pusulasi/${r.id}`}
          onClick={(e) => e.stopPropagation()}
          aria-label={`${periodLabel(r.year, r.month)} bordro pusulası`}
        >
          <FileText size={15} />
        </Link>
      ),
    },
  ];

  return (
    <>
      {header}
      <div className="stack">
        {latest && (
          <div className="grid grid-3">
            <StatCard
              icon={Wallet}
              tone="green"
              label="Son net ödeme"
              value={formatMoney(latest.net)}
              sub={periodLabel(latest.year, latest.month)}
              to={`/bordro-pusulasi/${latest.id}`}
            />
            <StatCard icon={Banknote} label={`${latest.year} toplam net`} value={formatMoney(yearNet)} sub={`${yearRows.length} aylık bordro`} />
            <StatCard icon={CalendarCheck} tone="teal" label={`${latest.year} toplam brüt`} value={formatMoney(yearGross)} />
          </div>
        )}
        <Card flush>
          <DataTable
            columns={columns}
            rows={rows}
            initialSort={{ key: 'period', dir: 'desc' }}
            onRowClick={(r) => navigate(`/bordro-pusulasi/${r.id}`)}
            empty={
              <EmptyState title="Henüz bordro pusulanız yok" icon={FileText}>
                Bordro pusulalarınız, İK birimi ilgili ayın bordrosunu onayladıktan sonra burada listelenir.
              </EmptyState>
            }
          />
        </Card>
      </div>
    </>
  );
}
