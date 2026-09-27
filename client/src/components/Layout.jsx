import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  BarChart3,
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Contact,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Network,
  Package,
  Settings,
  Sun,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { useApi } from '../api.js';
import { ROLE_LABELS, useAuth } from '../auth.jsx';
import { Avatar } from './ui.jsx';

/** Menü tanımı: roles verilmezse herkes görür; needsEmployee: hesabın bir personel kaydına bağlı olması gerekir. */
export const NAV = [
  {
    section: 'Genel',
    items: [
      { to: '/', label: 'Gösterge Paneli', icon: LayoutDashboard, end: true },
      { to: '/profilim', label: 'Profilim', icon: User, needsEmployee: true },
    ],
  },
  {
    section: 'Personel',
    items: [
      { to: '/personel', label: 'Personel', icon: Users, roles: ['admin', 'ik', 'yonetici'] },
      { to: '/rehber', label: 'Rehber', icon: Contact },
      { to: '/organizasyon', label: 'Organizasyon Şeması', icon: Network },
      { to: '/sirketler', label: 'Şirketler & Departmanlar', icon: Building2, roles: ['admin', 'ik'] },
    ],
  },
  {
    section: 'İzin',
    items: [
      { to: '/izinler', label: 'İzin Talepleri', icon: CalendarDays, badge: 'approvals' },
      { to: '/izin-takvimi', label: 'İzin Takvimi', icon: CalendarRange },
    ],
  },
  {
    section: 'Bordro',
    items: [
      { to: '/bordro', label: 'Bordro Dönemleri', icon: Wallet, roles: ['admin', 'ik'] },
      { to: '/bordrolarim', label: 'Bordrolarım', icon: FileText, needsEmployee: true },
      { to: '/bordro-hesaplama', label: 'Maaş Hesaplama', icon: Calculator },
    ],
  },
  {
    section: 'Yetenek Yönetimi',
    items: [
      { to: '/ise-alim', label: 'İşe Alım', icon: Briefcase, roles: ['admin', 'ik'] },
      { to: '/performans', label: 'Performans', icon: Award },
    ],
  },
  {
    section: 'Kurumsal',
    items: [
      { to: '/zimmet', label: 'Zimmet', icon: Package, roles: ['admin', 'ik'] },
      { to: '/duyurular', label: 'Duyurular', icon: Megaphone },
      { to: '/raporlar', label: 'Raporlar', icon: BarChart3, roles: ['admin', 'ik'] },
      { to: '/ayarlar', label: 'Ayarlar', icon: Settings, roles: ['admin', 'ik'] },
    ],
  },
];

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
    try {
      if (theme) localStorage.setItem('theme', theme);
      else localStorage.removeItem('theme');
    } catch {
      /* tarayıcı depolaması kapalı olabilir */
    }
  }, [theme]);
  const isDark = theme ? theme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return [isDark, () => setTheme(isDark ? 'light' : 'dark')];
}

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [isDark, toggleTheme] = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef(null);
  const canApprove = hasRole('admin', 'ik', 'yonetici');
  const approvals = useApi(canApprove ? '/leaves?scope=approvals' : null);
  const reloadApprovals = approvals.reload;

  useEffect(() => {
    setMenuOpen(false);
    setUserMenu(false);
  }, [location.pathname]);

  // İzin sayfaları talep oluşturma/onay sonrası 'leaves:changed' olayı yayar; menü rozeti güncellenir.
  useEffect(() => {
    window.addEventListener('leaves:changed', reloadApprovals);
    return () => window.removeEventListener('leaves:changed', reloadApprovals);
  }, [reloadApprovals]);

  useEffect(() => {
    if (!userMenu) return undefined;
    const close = (e) => !userMenuRef.current?.contains(e.target) && setUserMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [userMenu]);

  const visible = (item) => (!item.roles || hasRole(...item.roles)) && (!item.needsEmployee || user.employee_id);
  const current = NAV.flatMap((s) => s.items).find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)));
  const pendingCount = approvals.data?.length ?? 0;

  return (
    <div className="app-shell">
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <Link to="/" className="brand">
          <span className="brand-mark">F</span>
          <span>
            <div className="brand-name">FIMAR HOLDİNG</div>
            <div className="brand-sub">İnsan Kaynakları</div>
          </span>
        </Link>
        <nav className="nav" aria-label="Ana menü">
          {NAV.map((section) => {
            const items = section.items.filter(visible);
            if (!items.length) return null;
            return (
              <div key={section.section}>
                <div className="nav-section">{section.section}</div>
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <item.icon size={17} />
                    {item.label}
                    {item.badge === 'approvals' && pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">© {new Date().getFullYear()} FIMAR Holding</div>
      </aside>

      <div className="main">
        <header className="topbar no-print">
          <button className="btn btn-ghost btn-icon menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Menüyü aç">
            <Menu size={20} />
          </button>
          <div className="topbar-title">{current?.label ?? ''}</div>
          <button className="btn btn-ghost btn-icon" onClick={toggleTheme} aria-label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'} title="Tema">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="user-menu" ref={userMenuRef}>
            <button className="user-button" onClick={() => setUserMenu((v) => !v)} aria-expanded={userMenu}>
              <Avatar name={user.name} size="sm" />
              <span className="user-meta">
                <div className="name">{user.name}</div>
                <div className="role">{ROLE_LABELS[user.role]}</div>
              </span>
              <ChevronDown size={15} />
            </button>
            {userMenu && (
              <div className="dropdown" role="menu">
                <div style={{ padding: '6px 10px 8px' }}>
                  <div className="strong">{user.name}</div>
                  <div className="muted small">{user.email}</div>
                </div>
                <div className="dropdown-sep" />
                {user.employee_id && (
                  <Link className="dropdown-item" to="/profilim" role="menuitem">
                    <User size={16} /> Profilim
                  </Link>
                )}
                <Link className="dropdown-item" to="/profilim?sekme=sifre" role="menuitem">
                  <Settings size={16} /> Şifre Değiştir
                </Link>
                <div className="dropdown-sep" />
                <button
                  className="dropdown-item"
                  role="menuitem"
                  onClick={async () => {
                    await logout();
                    navigate('/giris');
                  }}
                >
                  <LogOut size={16} /> Çıkış Yap
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
