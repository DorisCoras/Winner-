import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const LookupsContext = createContext(null);

/**
 * /api/lookups verisini (şirketler, departmanlar, izin türleri ve sabit listeler) bir kez yükler.
 * Şirket/departman/izin türü değiştiren sayfalar işlem sonrası reloadLookups() çağırmalıdır.
 */
export function LookupsProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const reloadLookups = useCallback(async () => {
    try {
      setData(await api.get('/lookups'));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    reloadLookups();
  }, [reloadLookups]);

  const value = useMemo(() => {
    const companies = data?.companies ?? [];
    const departments = data?.departments ?? [];
    return {
      ready: !!data,
      error,
      reloadLookups,
      ...(data ?? {}),
      companies,
      departments,
      companyName: (id) => companies.find((c) => c.id === Number(id))?.name ?? '—',
      departmentName: (id) => departments.find((d) => d.id === Number(id))?.name ?? '—',
      departmentsOf: (companyId) => departments.filter((d) => d.company_id === Number(companyId)),
      exitCode: (code) => data?.exitCodes?.find((c) => c.code === code),
    };
  }, [data, error, reloadLookups]);

  return <LookupsContext.Provider value={value}>{children}</LookupsContext.Provider>;
}

export function useLookups() {
  const ctx = useContext(LookupsContext);
  if (!ctx) throw new Error('useLookups, LookupsProvider içinde kullanılmalı');
  return ctx;
}
