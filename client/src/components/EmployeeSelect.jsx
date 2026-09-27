import { useMemo } from 'react';
import { useApi } from '../api.js';

/**
 * Aktif personel seçimi (şirkete göre gruplu). /api/directory verisini kullanır, herkes erişebilir.
 *   <EmployeeSelect id="f-employee_id" value={v} onChange={(id) => ...} />
 * value/onChange sayısal id ile çalışır (boş seçim: '').
 * filter: (employee) => boolean — listeyi daraltmak için (ör. yalnızca bir şirket).
 */
export default function EmployeeSelect({ value, onChange, filter, placeholder = 'Personel seçiniz…', id, invalid, disabled, required }) {
  const { data, loading } = useApi('/directory');
  const groups = useMemo(() => {
    const map = new Map();
    for (const e of (data ?? []).filter((x) => !filter || filter(x))) {
      if (!map.has(e.company_name)) map.set(e.company_name, []);
      map.get(e.company_name).push(e);
    }
    return [...map];
  }, [data, filter]);

  return (
    <select
      id={id}
      className="select"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
      aria-invalid={invalid ? 'true' : undefined}
      disabled={disabled || loading}
      required={required}
    >
      <option value="">{loading ? 'Yükleniyor…' : placeholder}</option>
      {groups.map(([company, list]) => (
        <optgroup key={company} label={company}>
          {list.map((e) => (
            <option key={e.id} value={e.id}>
              {e.first_name} {e.last_name}
              {e.position ? ` — ${e.position}` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
