import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarCheck, Calculator, ShieldCheck, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Field } from '../components/ui.jsx';

const DEMO_ACCOUNTS = [
  ['admin@fimar.com.tr', 'Sistem Yöneticisi'],
  ['ik@fimar.com.tr', 'İK Uzmanı'],
  ['yonetici@fimar.com.tr', 'Departman Yöneticisi'],
  ['personel@fimar.com.tr', 'Personel'],
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    api.get('/meta').then(setMeta).catch(() => setMeta(null));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from && location.state.from !== '/giris' ? location.state.from : '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark">F</span>
          <span>
            <div className="brand-name">FIMAR HOLDİNG</div>
            <div className="brand-sub">İnsan Kaynakları Yönetim Sistemi</div>
          </span>
        </div>
        <div>
          <h1>Grup şirketlerinin tüm İK süreçleri tek platformda.</h1>
          <p>Personel özlük bilgileri, izin ve onay akışları, bordro, işe alım, zimmet ve performans yönetimi — yetkiye göre güvenli erişimle.</p>
          <div className="login-features">
            <div className="login-feature">
              <Users size={18} /> Personel ve organizasyon yönetimi
            </div>
            <div className="login-feature">
              <CalendarCheck size={18} /> İş Kanunu'na uygun izin hakedişi
            </div>
            <div className="login-feature">
              <Calculator size={18} /> Brüt–net bordro ve maliyet hesabı
            </div>
            <div className="login-feature">
              <ShieldCheck size={18} /> KVKK uyumlu rol bazlı erişim
            </div>
          </div>
        </div>
        <div className="small" style={{ color: '#8ea2c4' }}>
          © {new Date().getFullYear()} FIMAR Holding A.Ş.
        </div>
      </section>

      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <h1>Giriş yap</h1>
          <p className="muted mt-1">Kurumsal e-posta adresiniz ve şifrenizle oturum açın.</p>
          <div className="stack mt-2" style={{ gap: 14 }}>
            {error && <Alert tone="error">{error}</Alert>}
            <Field label="E-posta" htmlFor="email">
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ad.soyad@fimar.com.tr"
                required
                autoFocus
              />
            </Field>
            <Field label="Şifre" htmlFor="password">
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <button className="btn btn-primary" style={{ height: 40 }} disabled={busy}>
              {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
            </button>
            <div className="small muted">Şifrenizi unuttuysanız İK birimi veya sistem yöneticisinden sıfırlama talep edin.</div>
          </div>

          {meta?.demo && (
            <div className="demo-accounts">
              <div className="strong" style={{ marginBottom: 4 }}>
                Demo hesapları <span className="muted">(şifre: Demo1234)</span>
              </div>
              {DEMO_ACCOUNTS.map(([mail, label]) => (
                <button
                  type="button"
                  key={mail}
                  onClick={() => {
                    setEmail(mail);
                    setPassword('Demo1234');
                  }}
                >
                  <span>{mail}</span>
                  <span className="muted">{label}</span>
                </button>
              ))}
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
