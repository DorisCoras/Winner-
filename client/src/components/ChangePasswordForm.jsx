import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Field, useForm, useToast } from './ui.jsx';

/** Şifre değiştirme formu (ilk giriş ekranı ve Profilim sayfasında kullanılır). */
export default function ChangePasswordForm({ onDone }) {
  const { refresh } = useAuth();
  const toast = useToast();
  const f = useForm({ current_password: '', new_password: '', confirm: '' });

  const onSubmit = (e) => {
    e.preventDefault();
    if (f.values.new_password !== f.values.confirm) {
      f.setErrors({ confirm: 'Şifreler eşleşmiyor.' });
      return;
    }
    f.submit(async (v) => {
      await api.post('/auth/change-password', { current_password: v.current_password, new_password: v.new_password });
      toast.success('Şifreniz güncellendi.');
      f.setValues({ current_password: '', new_password: '', confirm: '' });
      await refresh();
      onDone?.();
    });
  };

  return (
    <form onSubmit={onSubmit} className="stack mt-2" style={{ gap: 14 }}>
      {f.formError && <Alert tone="error">{f.formError}</Alert>}
      <Field label="Mevcut şifre" error={f.errors.current_password} htmlFor="f-current_password" required>
        <input className="input" type="password" autoComplete="current-password" {...f.bind('current_password')} />
      </Field>
      <Field label="Yeni şifre" error={f.errors.new_password} hint="En az 8 karakter; harf ve rakam içermeli." htmlFor="f-new_password" required>
        <input className="input" type="password" autoComplete="new-password" {...f.bind('new_password')} />
      </Field>
      <Field label="Yeni şifre (tekrar)" error={f.errors.confirm} htmlFor="f-confirm" required>
        <input className="input" type="password" autoComplete="new-password" {...f.bind('confirm')} />
      </Field>
      <div>
        <button className="btn btn-primary" disabled={f.submitting}>
          {f.submitting ? 'Kaydediliyor…' : 'Şifreyi değiştir'}
        </button>
      </div>
    </form>
  );
}
