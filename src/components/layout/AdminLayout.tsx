import { type ReactNode, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  QrCode,
  ClipboardCheck,
  FileText,
  Calendar,
  Menu,
  LogOut,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/pendaftaran', label: 'Pendaftaran', icon: UserPlus },
  { to: '/admin/anggota', label: 'Anggota', icon: Users },
  { to: '/admin/qr', label: 'QR Absensi', icon: QrCode },
  { to: '/admin/absensi', label: 'Absensi', icon: ClipboardCheck },
  { to: '/admin/laporan', label: 'Laporan', icon: FileText },
  { to: '/admin/kalender-kkn', label: 'Kalender KKN', icon: Calendar },
];

export function AdminLayout({ children }: { children?: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const adminName = profile?.name ?? 'Admin';

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col sm:flex">
        <div className="flex min-h-full flex-col bg-gray-900">
          <div className="flex h-16 items-center gap-2 px-4">
            <ShieldCheck className="h-6 w-6 text-green-400" />
            <span className="font-semibold text-white">Admin</span>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-green-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-gray-800 px-4 py-3">
            <p className="mb-2 truncate text-xs text-gray-400">{adminName}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative h-full w-64">
            <div className="flex min-h-full flex-col bg-gray-900">
              <div className="flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-green-400" />
                  <span className="font-semibold text-white">Admin</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
                  aria-label="Tutup menu sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 px-3 py-4">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-green-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="border-t border-gray-800 px-4 py-3">
                <p className="mb-2 truncate text-xs text-gray-400">{adminName}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSidebarOpen(false);
                    void handleSignOut();
                  }}
                  className="w-full text-gray-300 hover:bg-gray-800 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 sm:hidden"
              aria-label="Buka menu sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">
              Admin Panel
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden truncate text-sm text-gray-600 sm:inline">
              {adminName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="hidden sm:flex"
              aria-label={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="hidden sm:flex"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
