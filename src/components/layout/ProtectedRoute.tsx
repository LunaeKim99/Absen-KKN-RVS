import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

interface ProtectedRouteProps {
  allowedRoles?: ('ADMIN' | 'ANGGOTA')[];
  children?: ReactNode;
}

const ROLE_HOME: Record<string, string> = {
  ADMIN: '/admin/dashboard',
  ANGGOTA: '/dashboard',
};

const BLOCKED_CONTENT: Record<string, { title: string; description: string }> = {
  PENDING: {
    title: 'Akun Menunggu Persetujuan',
    description: 'Akun Anda sudah terdaftar dan sedang menunggu persetujuan admin.',
  },
  REJECTED: {
    title: 'Pendaftaran Ditolak',
    description: 'Pendaftaran Anda ditolak admin.',
  },
  SUSPENDED: {
    title: 'Akun Ditangguhkan',
    description: 'Akun Anda ditangguhkan.',
  },
  INACTIVE: {
    title: 'Akun Dinonaktifkan',
    description: 'Akun Anda dinonaktifkan.',
  },
};

function StatusScreen({
  title,
  description,
  onSignOut,
}: {
  title: string;
  description: string;
  onSignOut: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">{description}</p>
        <Button variant="ghost" size="sm" onClick={onSignOut} className="mx-auto">
          <LogOut className="h-4 w-4" />
          Keluar
        </Button>
      </div>
    </div>
  );
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { user, profile, isLoading, signOut } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!profile) {
    return <LoadingScreen />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={ROLE_HOME[profile.role] ?? '/'} replace />;
  }

  if (profile.role === 'ANGGOTA' && !profile.is_active) {
    const content = BLOCKED_CONTENT.INACTIVE;
    return (
      <StatusScreen
        title={content.title}
        description={content.description}
        onSignOut={() => void signOut()}
      />
    );
  }

  return children ?? <Outlet />;
}
