import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Copy, Save } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import EmployeeSelect from '../components/EmployeeSelect.jsx';
import { Alert, Card, ErrorState, Field, Loading, Modal, PageHeader, useForm, useToast } from '../components/ui.jsx';
import { todayStr } from '../format.js';

const EMPTY = {
  sicil_no: '',
  first_name: '',
  last_name: '',
  tc_kimlik: '',
  birth_date: '',
  gender: '',
  marital_status: '',
  blood_type: '',
  education: '',
  email: '',
  phone: '',
  city: '',
  address: '',
  emergency_contact: '',
  emergency_phone: '',
  company_id: '',
  department_id: '',
  position: '',
  manager_id: '',
  hire_date: todayStr(),
  employment_type: 'tam_zamanli',
  gross_salary: '',
  iban: '',
  sgk_no: '',
  leave_carryover: 0,
  leave_base_date: '',
  notes: '',
  create_account: false,
  account_role: 'personel',
  account_password: '',
};

const FIELDS = Object.keys(EMPTY).filter((k) => !['create_account', 'account_role', 'account_password'].includes(k));

export default function EmployeeForm() {
  const { id } = useParams();
  const editing = !!id;
  const [params] = useSearchParams();
  const candidateId = params.get('aday');
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const lookups = useLookups();
  const f = useForm(EMPTY);
  const [loadState, setLoadState] = useState({ loading: editing || !!candidateId, error: null });
  const [created, setCreated] = useState(null);
  const { setValues } = f;

  // Düzenleme: mevcut kaydı yükle. Yeni kayıt: sıradaki sicil numarasını ve (varsa) aday bilgilerini getir.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (editing) {
          const emp = await api.get(`/employees/${id}`);
          if (cancelled) return;
          const v = { ...EMPTY };
          for (const k of FIELDS) v[k] = emp[k] ?? '';
          setValues(v);
        } else {
          const [{ sicil_no }, candidates] = await Promise.all([
            api.get('/employees/next-sicil'),
            candidateId ? api.get('/candidates') : Promise.resolve([]),
          ]);
          if (cancelled) return;
          const c = candidates.find((x) => x.id === Number(candidateId));
          setValues((v) => ({
            ...v,
            sicil_no,
            ...(c
              ? {
                  first_name: c.first_name,
                  last_name: c.last_name,
                  email: c.email ?? '',
                  phone: c.phone ?? '',
                  company_id: c.company_id ?? '',
                  department_id: c.department_id ?? '',
                  position: c.posting_title ?? '',
                  gross_salary: c.expected_salary ?? '',
                }
              : {}),
          }));
        }
        setLoadState({ loading: false, error: null });
      } catch (error) {
        if (!cancelled) setLoadState({ loading: false, error });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [editing, id, candidateId, setValues]);

  const onSubmit = (e) => {
    e.preventDefault();
    f.submit(async (v) => {
      const body = { ...v, create_account: !editing && v.create_account };
      if (editing) {
        await api.put(`/employees/${id}`, body);
        toast.success('Personel bilgileri güncellendi.');
        navigate(`/personel/${id}`);
        return;
      }
      const res = await api.post('/employees', body);
      if (candidateId) {
        await api.patch(`/candidates/${candidateId}/stage`, { stage: 'ise_alindi', employee_id: res.id }).catch(() => {});
      }
      toast.success('Personel kaydı oluşturuldu.');
      if (res.temp_password) setCreated(res);
      else navigate(`/personel/${res.id}`);
    });
  };

  if (loadState.loading) return <Loading />;
  if (loadState.error) return <ErrorState error={loadState.error} />;

  const v = f.values;
  const err = f.errors;
  const text = (name, label, props = {}) => (
    <Field label={label} error={err[name]} htmlFor={`f-${name}`} required={props.required} hint={props.hint} className={props.className}>
      <input className="input" type={props.type ?? 'text'} {...f.bind(name)} {...(props.input ?? {})} />
    </Field>
  );
  const select = (name, label, options, props = {}) => (
    <Field label={label} error={err[name]} htmlFor={`f-${name}`} required={props.required}>
      <select className="select" {...f.bind(name)}>
        <option value="">{props.placeholder ?? 'Seçiniz'}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <>
      <PageHeader
        title={editing ? `${v.first_name} ${v.last_name}` : 'Yeni personel'}
        subtitle={editing ? 'Personel bilgilerini düzenle' : candidateId ? 'Aday bilgilerinden personel kaydı oluşturuluyor' : 'Yeni personel kaydı oluştur'}
        back={editing ? { to: `/personel/${id}`, label: 'Personel kartı' } : { to: '/personel', label: 'Personel listesi' }}
      />
      <form onSubmit={onSubmit} noValidate>
        <div className="stack">
          {f.formError && <Alert tone="error">{f.formError}</Alert>}

          <Card title="Kimlik ve kişisel bilgiler">
            <div className="form-grid cols-3">
              {text('first_name', 'Ad', { required: true })}
              {text('last_name', 'Soyad', { required: true })}
              {text('tc_kimlik', 'T.C. Kimlik No', { input: { inputMode: 'numeric', maxLength: 11 } })}
              {text('birth_date', 'Doğum tarihi', { type: 'date' })}
              {select('gender', 'Cinsiyet', [
                ['K', 'Kadın'],
                ['E', 'Erkek'],
              ])}
              {select('marital_status', 'Medeni durum', (lookups.maritalStatuses ?? []).map((m) => [m, m]))}
              {select('education', 'Eğitim durumu', (lookups.educationLevels ?? []).map((m) => [m, m]))}
              {select('blood_type', 'Kan grubu', (lookups.bloodTypes ?? []).map((m) => [m, m]))}
            </div>
          </Card>

          <Card title="İletişim">
            <div className="form-grid cols-3">
              {text('email', 'E-posta', { type: 'email' })}
              {text('phone', 'Telefon', { type: 'tel', input: { placeholder: '05xx xxx xx xx' } })}
              {text('city', 'Şehir')}
              {text('address', 'Adres', { className: 'full' })}
              {text('emergency_contact', 'Acil durumda aranacak kişi')}
              {text('emergency_phone', 'Acil durum telefonu', { type: 'tel' })}
            </div>
          </Card>

          <Card title="İş bilgileri">
            <div className="form-grid cols-3">
              {text('sicil_no', 'Sicil no', { required: true })}
              <Field label="Şirket" error={err.company_id} htmlFor="f-company_id" required>
                <select
                  className="select"
                  {...f.bind('company_id')}
                  onChange={(e) => {
                    f.set('company_id', e.target.value);
                    f.set('department_id', '');
                  }}
                >
                  <option value="">Seçiniz</option>
                  {lookups.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Departman" error={err.department_id} htmlFor="f-department_id">
                <select className="select" {...f.bind('department_id')} disabled={!v.company_id}>
                  <option value="">{v.company_id ? 'Seçiniz' : 'Önce şirket seçin'}</option>
                  {lookups.departmentsOf(v.company_id).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              {text('position', 'Pozisyon / unvan')}
              <Field label="Bağlı olduğu yönetici" error={err.manager_id} htmlFor="f-manager_id">
                <EmployeeSelect
                  id="f-manager_id"
                  value={v.manager_id}
                  onChange={(val) => f.set('manager_id', val)}
                  filter={editing ? (e) => e.id !== Number(id) : undefined}
                  placeholder="Yönetici yok"
                  invalid={!!err.manager_id}
                />
              </Field>
              {text('hire_date', 'İşe giriş tarihi', { type: 'date', required: true })}
              {select(
                'employment_type',
                'Çalışma şekli',
                Object.entries(lookups.employmentTypes ?? {}),
                { required: true, placeholder: 'Seçiniz' },
              )}
            </div>
          </Card>

          <Card title="Ücret, banka ve SGK" hint="Bu bilgiler yalnızca İK yetkilileri ve çalışanın kendisi tarafından görülebilir.">
            <div className="form-grid cols-3">
              {text('gross_salary', 'Aylık brüt ücret (₺)', { type: 'number', required: true, input: { min: 0, step: '0.01' } })}
              {text('iban', 'IBAN', { input: { placeholder: 'TR00 0000 0000 0000 0000 0000 00' } })}
              {text('sgk_no', 'SGK sicil no')}
              {text('leave_base_date', 'İzin devir tarihi', {
                type: 'date',
                hint: 'Sisteme geçişte doldurun. Boş bırakılırsa işe girişten itibaren tüm hak edişler hesaplanır.',
              })}
              {text('leave_carryover', v.leave_base_date ? 'Devir tarihindeki kalan izin (gün)' : 'İzin bakiyesi düzeltmesi (gün)', {
                type: 'number',
                input: { step: '0.5' },
                hint: v.leave_base_date
                  ? 'Bu tarihten sonraki yıldönümlerinde kazanılan haklar otomatik eklenir.'
                  : 'Gerekirse artı/eksi gün olarak düzeltme girin.',
              })}
              <Field label="Notlar" error={err.notes} htmlFor="f-notes" className="full">
                <textarea className="textarea" rows={3} {...f.bind('notes')} />
              </Field>
            </div>
          </Card>

          {!editing && (
            <Card title="Kullanıcı hesabı" hint="Personelin İK portalına giriş yapabilmesi için hesap oluşturun.">
              <div className="form-grid cols-3">
                <div className="full">
                  <label className="checkbox">
                    <input type="checkbox" {...f.bind('create_account', { type: 'checkbox' })} /> Bu personel için kullanıcı hesabı oluştur
                  </label>
                </div>
                {v.create_account && (
                  <>
                    {select(
                      'account_role',
                      'Rol',
                      Object.entries(lookups.roles ?? {}).filter(([k]) => isAdmin || k !== 'admin'),
                      { required: true },
                    )}
                    {text('account_password', 'Geçici şifre', {
                      type: 'text',
                      hint: 'Boş bırakırsanız sistem güvenli bir geçici şifre üretir. Personel ilk girişte şifresini değiştirir.',
                    })}
                    <div className="field">
                      <span className="field-label">Giriş e-postası</span>
                      <div className="muted" style={{ paddingTop: 8 }}>
                        {v.email || 'Yukarıdaki e-posta adresi kullanılır'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => navigate(-1)}>
              Vazgeç
            </button>
            <button className="btn btn-primary" disabled={f.submitting}>
              <Save size={16} /> {f.submitting ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </form>

      <Modal
        open={!!created}
        onClose={() => navigate(`/personel/${created.id}`)}
        title="Kullanıcı hesabı oluşturuldu"
        size="sm"
        footer={
          <button className="btn btn-primary" onClick={() => navigate(`/personel/${created.id}`)}>
            Personel kartına git
          </button>
        }
      >
        <Alert tone="success" title="Geçici şifre">
          <div className="row mt-1">
            <code className="mono strong" style={{ fontSize: 15 }}>
              {created?.temp_password}
            </code>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => navigator.clipboard?.writeText(created.temp_password).then(() => toast.success('Kopyalandı'))}
            >
              <Copy size={14} /> Kopyala
            </button>
          </div>
        </Alert>
        <p className="small muted mt-1">Bu şifreyi personelle güvenli bir kanaldan paylaşın. Şifre bir daha gösterilmeyecek; personel ilk girişte değiştirmek zorundadır.</p>
      </Modal>
    </>
  );
}
