import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '@/lib/supabase';
import { mapScanError } from '@/features/member/hooks/useScanQr';
import type { QrScanResult } from '@/types/database';

type ScanPhase = 'idle' | 'scanning' | 'processing' | 'success' | 'error' | 'camera-error';

interface UseQRScannerOptions {
  userId: string;
  onSuccess?: (result: QrScanResult) => void;
  onError?: (error: string) => void;
}

interface UseQRScannerReturn {
  phase: ScanPhase;
  scanResult: QrScanResult | null;
  scanError: string | null;
  startScanner: () => void;
  stopScanner: () => Promise<void>;
  handleRetry: () => void;
}

const SCAN_DEBOUNCE_MS = 1500;

export function useQRScanner({
  userId,
  onSuccess,
  onError,
}: UseQRScannerOptions): UseQRScannerReturn {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);
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
    } finally {
      if (scannerRef.current === s) {
        scannerRef.current = null;
      }
    }
  }, []);

  const extractToken = useCallback((decodedText: string): string => {
    if (decodedText.includes('/scan/')) {
      return decodedText.split('/scan/')[1];
    }
    return decodedText;
  }, []);

  const processAttendance = useCallback(
    async (token: string): Promise<QrScanResult> => {
      const { data, error } = await supabase.rpc('process_attendance', {
        p_user_id: userId,
        p_token: token,
        p_device_info: navigator.userAgent,
      });

      console.log('Attendance response:', data);
      console.log('Attendance error:', error);

      if (error) {
        throw new Error(error.message);
      }

      const result = data as QrScanResult;

      if (!result) {
        throw new Error('Respons server kosong');
      }

      if (result.success !== true) {
        throw new Error(result.error ?? 'Gagal memproses absensi');
      }

      return result;
    },
    [userId],
  );

  const startScanner = useCallback(() => {
    const el = document.getElementById('qr-reader');
    if (!el) {
      setScanError('Gagal memuat area pemindai. Silakan refresh halaman.');
      setPhase('camera-error');
      return;
    }
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
    async (decodedText: string) => {
      if (scanningRef.current || !userId) return;

      scanningRef.current = true;
      setPhase('processing');

      await stopScanner();

      console.log('Scanned URL:', decodedText);

      const token = extractToken(decodedText.trim());
      console.log('Extracted token:', token);

      try {
        const result = await processAttendance(token);

        setScanResult(result);
        setPhase('success');
        onSuccess?.(result);
      } catch (err) {
        const message = mapScanError((err as Error).message);

        setScanError(message);
        setPhase('error');
        onError?.(message);

        scanningRef.current = false;

        setTimeout(() => {
          startScanner();
        }, SCAN_DEBOUNCE_MS);
      }
    },
    [
      userId,
      extractToken,
      processAttendance,
      stopScanner,
      startScanner,
      onSuccess,
      onError,
    ],
  );

  const onScanSuccessRef = useRef<(text: string) => void>(() => {});
  useEffect(() => {
    // Required: keeps the html5-qrcode callback up-to-date with latest handler
    // eslint-disable-next-line react-hooks/immutability
    onScanSuccessRef.current = handleScanSuccess;
  }, [handleScanSuccess]);

  const handleRetry = useCallback(() => {
    scanningRef.current = false;
    setScanError(null);
    setScanResult(null);
    void stopScanner().then(() => startScanner());
  }, [startScanner, stopScanner]);

  return {
    phase,
    scanResult,
    scanError,
    startScanner,
    stopScanner,
    handleRetry,
  };
}