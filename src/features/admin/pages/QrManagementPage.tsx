import { useEffect, useRef, useState } from 'react';
import {
  RefreshCw,
  Clock,
  UserCheck,
  Shield,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';
import { useActiveQR } from '@/features/admin/hooks/useActiveQR';
import { generateQrCanvas } from '@/lib/qrGenerator';
import { isKknActiveNow } from '@/lib/kkn-utils';
import { formatInTimeZone } from 'date-fns-tz';
import { KKN_CONFIG } from '@/config/kkn';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';

export default function QrManagementPage() {
  const { toast } = useToast();
  const { qr, isLoading, isGenerating, countdown, formatCountdown, generateQr, toast: hookToast } = useActiveQR();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const isKknActive = isKknActiveNow();

  // Show toast from hook
  useEffect(() => {
    if (hookToast) {
      if (hookToast.type === 'success') {
        toast.success(hookToast.message);
      } else {
        toast.error(hookToast.message);
      }
    }
  }, [hookToast, toast]);

  useEffect(() => {
    if (canvasRef.current && qr?.token) {
      generateQrCanvas(qr.token, canvasRef.current).catch(console.error);
    }
  }, [qr?.token]);

  const handleGenerate = async () => {
    if (!isKknActive) return;
    try {
      await generateQr();
      // Toast is handled by the hook via hookToast
    } catch {
      // Error toast is handled by the hook via hookToast
    }
  };

  const handleCopyToken = async () => {
    if (!qr?.token) return;
    try {
      await navigator.clipboard.writeText(qr.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Gagal menyalin token');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Absensi"
        description="Kelola kode QR untuk absensi anggota KKN"
      />

      {/* KKN Period Warning */}
      {!isKknActive && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium">QR tidak dapat dibuat di luar periode KKN</p>
              <p className="text-sm mt-1">
                Periode KKN: {formatInTimeZone(KKN_CONFIG.START_DATE, KKN_CONFIG.TIMEZONE, 'dd-MM-yyyy')} –{' '}
                {formatInTimeZone(KKN_CONFIG.END_DATE, KKN_CONFIG.TIMEZONE, 'dd-MM-yyyy')} WIB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main QR Card - always white for scannability */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center dark:border-gray-800" style={{ backgroundColor: '#fff' }}>
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-64 w-64 mx-auto animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-48 mx-auto animate-pulse rounded bg-gray-200" />
          </div>
        ) : qr?.is_active ? (
          <div className="space-y-6">
            {/* QR Code Canvas */}
            <div className="relative inline-block p-4 bg-white rounded-lg border border-gray-200 shadow-inner">
              <canvas
                ref={canvasRef}
                width={256}
                height={256}
                className="block"
                aria-label="Kode QR absensi"
              />
            </div>

            {/* Countdown Timer */}
            <div className="flex items-center justify-center gap-3">
              <Clock className="h-6 w-6 text-green-600" aria-hidden="true" />
              <div className="text-left">
                <p className="text-xs text-gray-500 dark:text-gray-400">Berlaku hingga</p>
                <p className="text-2xl font-mono font-bold text-gray-900 tabular-nums dark:text-gray-100">
                  {formatCountdown(countdown)}
                </p>
              </div>
            </div>

            {/* Token (dev only) */}
            {import.meta.env.DEV && qr.token && (
              <div className="rounded bg-gray-100 p-3 text-left dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Token (dev only)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono text-gray-700 break-all bg-white px-2 py-1 rounded border dark:bg-gray-900 dark:text-gray-300">
                    {qr.token}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyToken}
                    aria-label={copied ? 'Disalin' : 'Salin token'}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Last used info */}
            {qr.used_by && qr.used_at && qr.profiles && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-left dark:bg-green-900/20 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <UserCheck className="h-5 w-5" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Terakhir digunakan oleh</p>
                    <p className="text-sm text-green-600 dark:text-green-300">
                      {qr.profiles.name} pada{' '}
                      {formatInTimeZone(qr.used_at, KKN_CONFIG.TIMEZONE, 'dd-MM-yyyy HH:mm')} WIB
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Generate new QR button */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <Button
                variant="primary"
                size="lg"
                onClick={handleGenerate}
                disabled={isGenerating || !isKknActive}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Membuat QR...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Generate QR Baru
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Shield className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600" aria-hidden="true" />
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300">Tidak ada QR aktif</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Klik tombol di bawah untuk membuat QR baru
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating || !isKknActive}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Membuat QR...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Buat QR Baru
                </>
              )}
            </Button>
          </div>
        )}

        {/* Expired notice */}
        {qr && !qr.is_active && !isLoading && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-sm">
            QR ini sudah kedaluwarsa. Silakan buat QR baru.
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Durasi QR</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{KKN_CONFIG.QR_TOKEN_EXPIRES_SECONDS} detik</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Auto Refresh</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">Setiap 3 detik</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Status KKN</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{isKknActive ? 'Berlangsung' : 'Tidak Aktif'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
