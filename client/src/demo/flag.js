/** Uygulama tarayıcı içi demo sürümü olarak mı çalışıyor? (demo/main.jsx ayarlar) */
export const isDemo = () => !!globalThis.__FIMAR_DEMO__;

/** Uygulama genelinde bilgi bildirimi gösterir (FeedbackProvider dinler). */
export const notify = (message) => window.dispatchEvent(new CustomEvent('app:notice', { detail: message }));
