import { useCallback, useEffect, useRef, useState } from 'react';

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || 'İstek başarısız oldu.');
    this.status = status;
    this.data = data;
    this.fields = data?.fields ?? null;
  }
}

/**
 * Sunucu API çağrısı. Tüm yollar /api altındadır: api('/employees').
 * Hata durumunda ApiError fırlatır (message: sunucudan gelen Türkçe mesaj).
 */
export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, { error: 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.' });
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401 && !path.startsWith('/auth/')) {
    window.dispatchEvent(new Event('auth:expired'));
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

api.get = (path, opts) => api(path, opts);
api.post = (path, body = {}) => api(path, { method: 'POST', body });
api.put = (path, body = {}) => api(path, { method: 'PUT', body });
api.patch = (path, body = {}) => api(path, { method: 'PATCH', body });
api.del = (path) => api(path, { method: 'DELETE' });

/** Builds a query string from an object, skipping empty values. */
export function qs(params) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') s.set(k, v);
  }
  const str = s.toString();
  return str ? `?${str}` : '';
}

/**
 * GET isteği için React hook'u. path null ise istek yapılmaz.
 * Yeniden yüklemede eski veri korunur (titreme olmaz).
 * @returns {{ data, loading, error, reload, setData }}
 */
export function useApi(path) {
  const [state, setState] = useState({ data: null, loading: !!path, error: null });
  const [nonce, setNonce] = useState(0);
  const pathRef = useRef(path);

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    const ctrl = new AbortController();
    const pathChanged = pathRef.current !== path;
    pathRef.current = path;
    // Farklı bir kayda geçildiyse eski veriyi gösterme; aynı yolun yeniden yüklenmesinde koru.
    setState((s) => ({ data: pathChanged ? null : s.data, loading: true, error: null }));
    api(path, { signal: ctrl.signal })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState((s) => ({ data: s.data, loading: false, error }));
      });
    return () => ctrl.abort();
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback(
    (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })),
    [],
  );
  return { ...state, reload, setData };
}
