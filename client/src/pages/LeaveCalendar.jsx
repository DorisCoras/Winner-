import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react';
import { qs, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import { Badge, Card, EmptyState, ErrorState, Loading, PageHeader } from '../components/ui.jsx';
import { formatDateLong, formatDateRange, formatDays, periodLabel, todayStr, WEEKDAYS_SHORT } from '../format.js';
import './LeaveCalendar.css';

const STATUS_LABELS = { beklemede: 'Onay bekliyor', onaylandi: 'Onaylandı' };
const pad = (n) => String(n).padStart(2, '0');

function currentPeriod() {
  const t = todayStr();
  return { year: Number(t.slice(0, 4)), month: Number(t.slice(5, 7)) };
}

function holidayLabel(h) {
  return `${h.name}${h.half_day ? ' (yarım gün)' : ''}`;
}

function leaveTooltip(l, day) {
  const lines = [
    l.employee_name,
    l.leave_type_name,
    `${formatDateRange(l.start_date, l.end_date)} · ${formatDays(l.days)}${l.half_day ? ' (yarım gün)' : ''}`,
    STATUS_LABELS[l.status] ?? l.status,
  ];
  if (day.holiday) lines.push(`Resmi tatil: ${holidayLabel(day.holiday)}`);
  else if (day.weekend) lines.push('Hafta sonu (izne sayılmaz)');
  return lines.join('\n');
}

/** Takvim verisinden gün sütunlarını, personel satırlarını ve lejantı hazırlar. */
function buildGrid(data, today) {
  const { year, month } = data;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const holidays = new Map(data.holidays.map((h) => [h.date, h]));
  const days = Array.from({ length: count }, (_, i) => {
    const d = i + 1;
    const date = `${year}-${pad(month)}-${pad(d)}`;
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    return { d, date, dow, weekend: dow === 0 || dow === 6, holiday: holidays.get(date) ?? null, today: date === today };
  });

  const people = new Map();
  const types = new Map();
  for (const l of data.leaves) {
    if (!people.has(l.employee_id)) {
      people.set(l.employee_id, {
        id: l.employee_id,
        name: l.employee_name,
        sub: [l.department_name, l.company_short_name ?? l.company_name].filter(Boolean).join(' · '),
        leaves: [],
      });
    }
    people.get(l.employee_id).leaves.push(l);
    const key = `${l.leave_type_name}|${l.color}`;
    if (!types.has(key)) types.set(key, { key, name: l.leave_type_name, color: l.color });
  }

  return {
    days,
    rows: [...people.values()],
    types: [...types.values()],
    pendingCount: data.leaves.filter((l) => l.status === 'beklemede').length,
    holidays: [...data.holidays].sort((a, b) => a.date.localeCompare(b.date)),
    hasToday: days.some((d) => d.today),
  };
}

function dayClasses(day) {
  return [day.weekend && 'weekend', day.holiday && 'holiday', day.today && 'today'].filter(Boolean);
}

function CalendarTable({ grid }) {
  return (
    <div className="table-wrap">
      <table className="calendar-table">
        <thead>
          <tr>
            <th className="name-col lc-name-col" scope="col">
              Personel
            </th>
            {grid.days.map((day) => (
              <th
                key={day.date}
                scope="col"
                className={['lc-day', ...dayClasses(day)].join(' ')}
                title={day.holiday ? holidayLabel(day.holiday) : undefined}
              >
                <div>{day.d}</div>
                <div className="lc-day-name">{WEEKDAYS_SHORT[day.dow]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((person) => (
            <tr key={person.id}>
              <td className="name-col lc-name-col">
                <div className="lc-name truncate" title={person.name}>
                  {person.name}
                </div>
                {person.sub && (
                  <div className="lc-sub truncate" title={person.sub}>
                    {person.sub}
                  </div>
                )}
              </td>
              {grid.days.map((day) => {
                const leave = person.leaves.find((l) => l.start_date <= day.date && l.end_date >= day.date);
                const classes = dayClasses(day);
                if (leave) {
                  classes.push('lc-leave');
                  if (leave.status === 'beklemede') classes.push('pending');
                  if (day.weekend || (day.holiday && !day.holiday.half_day)) classes.push('off');
                  if (leave.half_day) classes.push('half');
                }
                return (
                  <td
                    key={day.date}
                    className={classes.join(' ')}
                    style={leave ? { '--lc-color': leave.color } : undefined}
                    title={leave ? leaveTooltip(leave, day) : day.holiday ? holidayLabel(day.holiday) : undefined}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarLegend({ grid }) {
  return (
    <div className="chart-legend lc-legend">
      {grid.types.map((t) => (
        <span key={t.key}>
          <i style={{ background: t.color }} />
          {t.name}
        </span>
      ))}
      <span>
        <i className="lc-sw-pending" />
        Onay bekliyor
      </span>
      <span>
        <i className="lc-sw-off" />
        İzne sayılmayan gün
      </span>
      <span>
        <i className="lc-sw-weekend" />
        Hafta sonu
      </span>
      <span>
        <i className="lc-sw-holiday" />
        Resmi tatil
      </span>
      {grid.hasToday && (
        <span>
          <i className="lc-sw-today" />
          Bugün
        </span>
      )}
    </div>
  );
}

export default function LeaveCalendar() {
  const { isHR } = useAuth();
  const { companies, departments, departmentsOf, companyName } = useLookups();
  const [period, setPeriod] = useState(currentPeriod);
  const [companyId, setCompanyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const { data, error, reload } = useApi(
    `/leaves/calendar${qs({ year: period.year, month: period.month, company_id: companyId, department_id: departmentId })}`,
  );
  const today = todayStr();
  const grid = useMemo(() => (data ? buildGrid(data, today) : null), [data, today]);

  const shift = (delta) =>
    setPeriod(({ year, month }) => {
      const m = month - 1 + delta;
      return { year: year + Math.floor(m / 12), month: (((m % 12) + 12) % 12) + 1 };
    });

  // Şirket seçiliyse yalnız o şirketin departmanları; değilse şirkete göre gruplu tüm departmanlar.
  const departmentOptions = companyId ? (
    departmentsOf(companyId).map((d) => (
      <option key={d.id} value={d.id}>
        {d.name}
      </option>
    ))
  ) : (
    companies.map((c) => {
      const list = departments.filter((d) => d.company_id === c.id);
      if (!list.length) return null;
      return (
        <optgroup key={c.id} label={c.name}>
          {list.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </optgroup>
      );
    })
  );

  const filterNote = [companyId && companyName(companyId), departmentId && departments.find((d) => d.id === Number(departmentId))?.name]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <PageHeader
        title="İzin Takvimi"
        subtitle="Aylık izin planı: onaylanmış ve onay bekleyen izinler."
        actions={
          <Link className="btn" to="/izinler">
            <CalendarDays size={16} /> İzin Talepleri
          </Link>
        }
      />

      <div className="toolbar">
        <div className="row">
          <button className="btn btn-icon" onClick={() => shift(-1)} aria-label="Önceki ay" title="Önceki ay">
            <ChevronLeft size={18} />
          </button>
          <button className="btn" onClick={() => setPeriod(currentPeriod())}>
            Bugün
          </button>
          <button className="btn btn-icon" onClick={() => shift(1)} aria-label="Sonraki ay" title="Sonraki ay">
            <ChevronRight size={18} />
          </button>
          <h2 className="lc-title" aria-live="polite">
            {periodLabel(period.year, period.month)}
          </h2>
        </div>
        <div className="spacer" />
        <select
          className="select"
          aria-label="Şirket"
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value);
            setDepartmentId('');
          }}
        >
          <option value="">Tüm şirketler</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="select" aria-label="Departman" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">Tüm departmanlar</option>
          {departmentOptions}
        </select>
      </div>

      <Card
        flush
        title="İzinli personel"
        hint={
          grid
            ? [
                `${grid.rows.length} personel`,
                `${data.leaves.length} izin kaydı`,
                grid.pendingCount ? `${grid.pendingCount} onay bekliyor` : null,
                filterNote || null,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
      >
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : !grid ? (
          <Loading />
        ) : grid.rows.length === 0 ? (
          <EmptyState title="Bu ay izinli personel yok" icon={CalendarX2}>
            {filterNote ? 'Seçili filtrelere uyan izin kaydı bulunmuyor.' : 'Seçilen ayda onaylı veya onay bekleyen izin bulunmuyor.'}
          </EmptyState>
        ) : (
          <>
            <div style={{ padding: '12px 18px' }}>
              <CalendarLegend grid={grid} />
            </div>
            <CalendarTable grid={grid} />
            {!isHR && (
              <div className="muted small" style={{ padding: '10px 18px' }}>
                Gizlilik gereği yetki alanınız dışındaki personelin izin türü “İzinli” olarak gösterilir.
              </div>
            )}
          </>
        )}
      </Card>

      {grid && (
        <Card title="Bu ayın resmi tatilleri" className="mt-2" flush>
          {grid.holidays.length === 0 ? (
            <div className="muted small" style={{ padding: 18 }}>
              {periodLabel(period.year, period.month)} döneminde resmi tatil bulunmuyor.
            </div>
          ) : (
            <ul className="list">
              {grid.holidays.map((h) => {
                const dow = new Date(`${h.date}T00:00:00Z`).getUTCDay();
                return (
                  <li key={h.date}>
                    <span className="lc-holiday-date strong">
                      {formatDateLong(h.date)} <span className="muted small">{WEEKDAYS_SHORT[dow]}</span>
                    </span>
                    <span className="grow">{h.name}</span>
                    {h.half_day ? <Badge tone="amber">Yarım gün</Badge> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
