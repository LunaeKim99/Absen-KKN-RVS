import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '@/lib/supabase';
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
    console.log('Scanned:', decodedText);
    if (decodedText.includes('/scan/')) {
      const token = decodedText.split('/scan/')[1];
      console.log('Extracted token from URL:', token);
      return token;
    }
    console.log('Using raw token:', decodedText);
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

      if (result?.success === false) {
        throw new Error(result.error ?? 'Gagal memproses absensi');
      }

      return result;
    },
    [userId],
  );

  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      if (scanningRef.current || !userId) {
        console.log('Scan ignored - already scanning or no user');
        return;
      }
      scanningRef.current = true;
      setPhase('processing');

      const token = extractToken(decodedText.trim());

      processAttendance(token)
        .then((result) => {
          console.log('Scan success:', result);
          setScanResult(result);
          setPhase('success');
          stopScanner();
          onSuccess?.(result);
        })
        .catch((err) => {
          console.error('Scan error:', err);
          const message = err.message ?? 'Terjadi kesalahan saat memproses absensi';
          setScanError(message);
          setPhase('error');
          onError?.(message);
          setTimeout(() => {
            scanningRef.current = false;
          }, SCAN_DEBOUNCE_MS);
        });
    },
    [userId, extractToken, processAttendance, stopScanner, onSuccess, onError],
  );

  const onScanSuccessRef = useRef<(text: string) => void>(() => {});
  useEffect(() => {
    onScanSuccessRef.current = handleScanSuccess;
  }, [handleScanSuccess]);

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