import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { LookupsProvider } from './lookups.jsx';
import Layout from './components/Layout.jsx';
import ChangePasswordForm from './components/ChangePasswordForm.jsx';
import { Alert, EmptyState, Loading, PageHeader } from './components/ui.jsx';
import Login from './pages/Login.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Employees = lazy(() => import('./pages/Employees.jsx'));
const EmployeeForm = lazy(() => import('./pages/EmployeeForm.jsx'));
const EmployeeDetail = lazy(() => import('./pages/EmployeeDetail.jsx'));
const Directory = lazy(() => import('./pages/Directory.jsx'));
const OrgChart = lazy(() => import('./pages/OrgChart.jsx'));
const Companies = lazy(() => import('./pages/Companies.jsx'));
const Leaves = lazy(() => import('./pages/Leaves.jsx'));
const LeaveCalendar = lazy(() => import('./pages/LeaveCalendar.jsx'));
const PayrollRuns = lazy(() => import('./pages/PayrollRuns.jsx'));
const PayrollRunDetail = lazy(() => import('./pages/PayrollRunDetail.jsx'));
const PayrollCalculator = lazy(() => import('./pages/PayrollCalculator.jsx'));
const MyPayslips = lazy(() => import('./pages/MyPayslips.jsx'));
const Payslip = lazy(() => import('./pages/Payslip.jsx'));
const Recruitment = lazy(() => import('./pages/Recruitment.jsx'));
const Performance = lazy(() => import('./pages/Performance.jsx'));
const Assets = lazy(() => import('./pages/Assets.jsx'));
const AssetReceipt = lazy(() => import('./pages/AssetReceipt.jsx'));
const Announcements = lazy(() => import('./pages/Announcements.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const EmploymentCertificate = lazy(() => import('./pages/EmploymentCertificate.jsx'));

/** Rol kontrolü: yetkisi olmayan kullanıcıya uyarı gösterir. */
function Guard({ roles, children }) {
  const { hasRole } = useAuth();
  if (roles && !hasRole(...roles)) {
    return (
      <>
        <PageHeader title="Yetkisiz erişim" />
        <Alert tone="warning">Bu sayfayı görüntüleme yetkiniz bulunmuyor. Gerekli olduğunu düşünüyorsanız İK birimiyle iletişime geçin.</Alert>
      </>
    );
  }
  return children;
}

const HR = ['admin', 'ik'];
const MANAGERS = ['admin', 'ik', 'yonetici'];

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading text="FIMAR İK yükleniyor…" />;

  if (!user) {
    return (
      <Routes>
        <Route path="/giris" element={<Login />} />
        <Route path="*" element={<Navigate to="/giris" replace state={{ from: location.pathname + location.search }} />} />
      </Routes>
    );
  }

  if (user.must_change_password) {
    return (
      <div className="login-form-wrap" style={{ minHeight: '100vh' }}>
        <div className="login-form">
          <h1>Şifrenizi belirleyin</h1>
          <p className="muted mt-1">Güvenliğiniz için ilk girişte geçici şifrenizi değiştirmeniz gerekiyor.</p>
          <ChangePasswordForm />
        </div>
      </div>
    );
  }

  return (
    <LookupsProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/giris" element={<Navigate to="/" replace />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="profilim" element={<Profile />} />
            <Route path="personel" element={<Guard roles={MANAGERS}><Employees /></Guard>} />
            <Route path="personel/yeni" element={<Guard roles={HR}><EmployeeForm /></Guard>} />
            <Route path="personel/:id" element={<EmployeeDetail />} />
            <Route path="personel/:id/duzenle" element={<Guard roles={HR}><EmployeeForm /></Guard>} />
            <Route path="rehber" element={<Directory />} />
            <Route path="organizasyon" element={<OrgChart />} />
            <Route path="sirketler" element={<Guard roles={HR}><Companies /></Guard>} />
            <Route path="izinler" element={<Leaves />} />
            <Route path="izin-takvimi" element={<LeaveCalendar />} />
            <Route path="bordro" element={<Guard roles={HR}><PayrollRuns /></Guard>} />
            <Route path="bordro/:id" element={<Guard roles={HR}><PayrollRunDetail /></Guard>} />
            <Route path="bordro-hesaplama" element={<PayrollCalculator />} />
            <Route path="bordrolarim" element={<MyPayslips />} />
            <Route path="bordro-pusulasi/:id" element={<Payslip />} />
            <Route path="ise-alim" element={<Guard roles={HR}><Recruitment /></Guard>} />
            <Route path="performans" element={<Performance />} />
            <Route path="zimmet" element={<Guard roles={HR}><Assets /></Guard>} />
            <Route path="yazdir/zimmet/:id" element={<AssetReceipt />} />
            <Route path="yazdir/calisma-belgesi/:id" element={<Guard roles={HR}><EmploymentCertificate /></Guard>} />
            <Route path="duyurular" element={<Announcements />} />
            <Route path="raporlar" element={<Guard roles={HR}><Reports /></Guard>} />
            <Route path="ayarlar" element={<Guard roles={HR}><Settings /></Guard>} />
            <Route path="*" element={<EmptyState title="Sayfa bulunamadı">Aradığınız sayfa taşınmış veya silinmiş olabilir.</EmptyState>} />
          </Route>
        </Routes>
      </Suspense>
    </LookupsProvider>
  );
}
