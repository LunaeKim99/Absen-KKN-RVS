import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle2, XCircle, CameraOff, ArrowLeft, RefreshCw } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuth } from '@/hooks/useAuth';
import { useScanQr, mapScanError } from '@/features/member/hooks/useScanQr';
import { isKknActiveNow, getKknStatus } from '@/lib/kkn-utils';
import { KKN_CONFIG } from '@/config/kkn';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingScreen } from '@/components/ui/Spinner';
import type { QrScanResult } from '@/types/database';

type ScanPhase =
  | 'idle'
  | 'scanning'
  | 'processing'
  | 'success'
  | 'error'
  | 'camera-error';

export default function ScanPage() {
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { scan, isPending } = useScanQr();

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [scanResult, setScanResult] = useState<QrScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      await s.stop();
      s.clear();
    } catch {
      /* already stopped or element removed */
    }
    scannerRef.current = null;
  }, []);

  const startScanner = useCallback(() => {
    const el = document.getElementById('qr-reader');
    if (!el) return;
    el.replaceChildren();
    const scanner = new Html5Qrcode('qr-reader', false);
    scannerRef.current = scanner;
    setPhase('scanning');
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => onScanSuccessRef.current(text),
        () => {
          /* per-frame decode errors intentionally ignored */
        },
      )
      .catch(() => {
        if (scannerRef.current !== scanner) return;
        setScanError(
          'Tidak dapat mengakses kamera. Pastikan izin kamera diizinkan di pengaturan browser Anda, lalu coba lagi.',
        );
        setPhase('camera-error');
      });
  }, []);

  const handleScanSuccess = useCallback(
    (text: string) => {
      if (busyRef.current || !user) return;
      busyRef.current = true;
      setPhase('processing');
      scan(
        { userId: user.id, token: text.trim() },
        {
          onSuccess: (result) => {
            if (result?.success) {
              setScanResult(result);
              setPhase('success');
              void stopScanner();
            } else {
              setScanError(mapScanError(result?.error));
              setPhase('error');
              busyRef.current = false;
            }
          },
          onError: () => {
            setScanError('Terjadi kesalahan saat memproses absensi. Silakan coba lagi.');
            setPhase('error');
            busyRef.current = false;
          },
        },
      );
    },
    [scan, stopScanner, user],
  );

  const onScanSuccessRef = useRef<(text: string) => void>(() => {});
  useEffect(() => {
    // Required: keeps the html5-qrcode callback up-to-date with latest handler
    // eslint-disable-next-line react-hooks/immutability
    onScanSuccessRef.current = handleScanSuccess;
  }, [handleScanSuccess]);

  const handleRetry = useCallback(() => {
    busyRef.current = false;
    setScanError(null);
    setScanResult(null);
    void stopScanner().then(() => startScanner());
  }, [startScanner, stopScanner]);

  // --- mount scanner on active user ---
  useEffect(() => {
    if (authLoading || !user || !profile) return;
    if (profile.is_active && isKknActiveNow()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startScanner();
    }
    return () => {
      void stopScanner();
    };
  }, [authLoading, user, profile, startScanner, stopScanner]);

  if (authLoading) return <LoadingScreen />;

  const scanInProgress = phase === 'processing' && isPending;

  return (
    <div className="w-full max-w-md space-y-4 pb-24 md:max-w-lg">
      <PageHeader title="Scan QR Absensi" />

      {!profile ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CameraOff className="mx-auto h-10 w-10 text-amber-500" />
            <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Akun Anda tidak ditemukan.
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Hubungi admin untuk verifikasi akun Anda.
            </p>
          </CardContent>
        </Card>
      ) : !profile.is_active ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CameraOff className="mx-auto h-10 w-10 text-red-500" />
            <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Akun Anda telah ditangguhkan.
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Hubungi admin untuk informasi lebih lanjut.
            </p>
          </CardContent>
        </Card>
      ) : !isKknActiveNow() ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {getKknStatus() === 'SELESAI'
                ? 'Masa absensi KKN telah berakhir.'
                : 'Absensi KKN belum dibuka.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Instructions */}
          <Card>
            <CardContent className="space-y-3 pt-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Cara Menggunakan
              </h3>
              <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-100 text-[10px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    1
                  </span>
                  Izinkan akses kamera di browser jika diminta.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-100 text-[10px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    2
                  </span>
                  Arahkan kamera ke QR code di layar admin.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-100 text-[10px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    3
                  </span>
                  Pastikan QR masih berlaku (masa berlaku terbatas).
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Scanner viewport */}
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-black dark:border-gray-800">
            <div id="qr-reader" className="min-h-[300px] w-full" />
            {scanInProgress && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60">
                <LoadingScreen />
                <p className="mt-2 text-sm font-medium text-white">
                  Memproses absensi...
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Error card for camera-error / scan-error */}
      {(phase === 'camera-error' || phase === 'error') && scanError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-300">{scanError}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4" />
                Coba Scan Lagi
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success modal */}
      <Modal
        open={phase === 'success'}
        onClose={() => navigate('/dashboard')}
        title="Absensi Berhasil"
      >
        {scanResult?.success && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Selamat datang,</p>
              <p className="font-semibold text-gray-900">{profile?.name ?? 'Anggota'}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Jam Masuk</p>
              <p className="font-semibold text-gray-900">
                {scanResult.attendance?.check_in_at
                  ? `${formatInTimeZone(
                      scanResult.attendance.check_in_at,
                      KKN_CONFIG.TIMEZONE,
                      'HH:mm',
                    )} WIB`
                  : '-'}
              </p>
              <div className="mt-2">
                <StatusBadge.AttendanceStatusBadge
                  status={scanResult.attendance?.status ?? 'HADIR'}
                />
              </div>
            </div>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => navigate('/dashboard')}
            >
              Kembali ke Dashboard
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
