import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getKknStatus } from '@/lib/kkn-utils';
import type { QrScanResult } from '@/types/database';

interface ScanParams {
  userId: string;
  token: string;
}

/**
 * Map the RPC error string returned by `process_attendance` to a
 * user-friendly Indonesian message.
 */
export function mapScanError(rpcError?: string): string {
  switch (rpcError) {
    case 'Akun Anda belum disetujui atau tidak aktif':
      return 'Akun belum disetujui admin. Hubungi admin untuk informasi lebih lanjut.';
    case 'Akun Anda tidak aktif':
      return 'Akun Anda tidak aktif. Hubungi admin untuk informasi lebih lanjut.';
    case 'Anda sudah melakukan absensi hari ini':
      return 'Anda sudah absen hari ini.';
    case 'QR tidak valid atau sudah kedaluwarsa':
      return 'QR sudah kedaluwarsa atau sudah dipakai orang lain. Silakan scan kembali QR terbaru di layar admin.';
    case 'Periode KKN tidak aktif':
      return getKknStatus() === 'SELESAI'
        ? 'Masa absensi KKN telah berakhir.'
        : 'Absensi belum dibuka.';
    default:
      return (
        rpcError ||
        'QR tidak dikenali. Pastikan Anda memindai QR dari layar admin.'
      );
  }
}

export function useScanQr() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ userId, token }: ScanParams) => {
      const { data, error } = await supabase.rpc('process_attendance', {
        p_user_id: userId,
        p_token: token,
        p_device_info: navigator.userAgent,
      });

      console.log('Attendance response:', data);
      console.log('Attendance error:', error);

      if (error) throw error;

      const result = data as QrScanResult;

      if (result?.success === false) {
        throw new Error(result.error ?? 'Gagal memproses absensi');
      }

      return result;
    },
    onSuccess: (result) => {
      if (result?.success) {
        queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
        queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      }
    },
  });

  return {
    scan: mutation.mutate,
    scanAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    result: mutation.data,
    error: mutation.error,
  };
}