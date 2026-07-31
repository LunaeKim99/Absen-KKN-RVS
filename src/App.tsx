import { Suspense, lazy } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast';
import { LoadingScreen } from '@/components/ui/Spinner';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { MemberLayout } from '@/components/layout/MemberLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'));
const RegisterSuccessPage = lazy(
  () => import('@/features/auth/pages/RegisterSuccessPage'),
);
const DashboardPage = lazy(
  () => import('@/features/member/pages/DashboardPage'),
);
const ScanPage = lazy(() => import('@/features/member/pages/ScanPage'));
const RiwayatPage = lazy(() => import('@/features/member/pages/RiwayatPage'));
const ProfilPage = lazy(() => import('@/features/member/pages/ProfilPage'));
const AdminDashboardPage = lazy(
  () => import('@/features/admin/pages/AdminDashboardPage'),
);
const PendaftaranPage = lazy(
  () => import('@/features/admin/pages/PendaftaranPage'),
);
const AnggotaPage = lazy(
  () => import('@/features/admin/pages/AnggotaPage'),
);
const QrManagementPage = lazy(
  () => import('@/features/admin/pages/QrManagementPage'),
);
const AbsensiPage = lazy(() => import('@/features/admin/pages/AbsensiPage'));
const LaporanPage = lazy(
  () => import('@/features/admin/pages/LaporanPage'),
);
const KalenderPage = lazy(
  () => import('@/features/admin/pages/KalenderPage'),
);

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/register/success',
    element: <RegisterSuccessPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute allowedRoles={['ANGGOTA']} />,
    children: [
      {
        element: <MemberLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'dashboard', element: <Navigate to="/" replace /> },
          { path: 'scan', element: <ScanPage /> },
          { path: 'riwayat', element: <RiwayatPage /> },
          { path: 'profil', element: <ProfilPage /> },
        ],
      },
    ],
  },
  {
    path: '/admin',
    element: <ProtectedRoute allowedRoles={['ADMIN']} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          { path: 'dashboard', element: <AdminDashboardPage /> },
          { path: 'pendaftaran', element: <PendaftaranPage /> },
          { path: 'anggota', element: <AnggotaPage /> },
          { path: 'qr', element: <QrManagementPage /> },
          { path: 'absensi', element: <AbsensiPage /> },
          { path: 'laporan', element: <LaporanPage /> },
          { path: 'kalender-kkn', element: <KalenderPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Suspense fallback={<LoadingScreen />}>
          <RouterProvider router={router} />
        </Suspense>
      </ToastProvider>
    </QueryClientProvider>
  );
}
