import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { QrSession, ActiveQrResponse, AdminQrResponse } from '@/types/database';

interface QrSessionWithUsedBy extends QrSession {
  profiles?: { name: string } | null;
}

/** Module-level guard: prevent concurrent auto-rotate RPC calls from client side. */
let rotateInFlight: Promise<ActiveQrResponse | null> | null = null;

async function rotateQrOnce(): Promise<ActiveQrResponse | null> {
  if (rotateInFlight) return rotateInFlight;
  rotateInFlight = (async () => {
    const { data, error } = await supabase.rpc('get_active_qr');
    if (error) throw error;
    return data as ActiveQrResponse | null;
  })();
  try {
    return await rotateInFlight;
  } finally {
    rotateInFlight = null;
  }
}

/**
 * Fetch and manage the currently valid active QR session.
 * Includes countdown, auto-refresh, and toast notifications.
 */
export function useActiveQR() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const adminId = user?.id ?? '';
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Active QR query with polling and realtime fallback
  const {
    data: qr,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<QrSessionWithUsedBy | null>({
    queryKey: ['admin', 'qr'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qr_sessions')
        .select('*, profiles!used_by(name)')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        // Defensive profiles handling — may be object, array, or null depending on response
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profilesRaw = (data as any).profiles;
        let profileName: string | null = null;
        if (Array.isArray(profilesRaw)) {
          profileName = profilesRaw[0]?.name;
        } else if (profilesRaw && typeof profilesRaw === 'object' && 'name' in profilesRaw) {
          profileName = (profilesRaw as { name?: string }).name ?? null;
        }
        return {
          ...data,
          profiles: profileName ? { name: profileName } : null,
        } as QrSessionWithUsedBy;
      }

      // No valid active QR (expired or none): auto-rotate via RPC (guarded).
      const rpc = await rotateQrOnce();
      if (!rpc?.success || !rpc.qr) return null;

      return {
        id: rpc.qr.id,
        token: rpc.qr.token,
        is_active: true,
        expires_at: rpc.qr.expires_at,
        created_by: null,
        used_by: null,
        used_at: null,
        created_at: new Date().toISOString(),
        profiles: null,
      } as QrSessionWithUsedBy;
    },
    // Polling acts as a fallback when realtime is flaky/dropped.
    refetchInterval: 2000,
    staleTime: 1000,
  });

  // Auto-refresh on query error
  useEffect(() => {
    if (queryError) {
      console.log('QR query error, attempting refetch:', queryError);
      refetch();
    }
  }, [queryError, refetch]);

  // Generate new QR mutation with proper error handling
  const generateQrMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_generate_qr', {
        p_admin_id: adminId,
      });

      // Consistent error handling for all RPC calls
      if (error) {
        console.error('Generate QR RPC error:', error);
        throw new Error(error.message);
      }

      const result = data as AdminQrResponse | null;

      // Parse structured response from RPC
      if (!result?.success || !result.qr) {
        const errorMessage = result?.error ?? 'Gagal membuat QR baru';
        console.error('Generate QR RPC failed:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log('Generate QR response:', result);
      return result;
    },
    onSuccess: (result) => {
      console.log('QR generated successfully:', result);
      setToast({ message: 'QR baru berhasil dibuat', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'qr'] });
    },
    onError: (error) => {
      console.error('QR generation error:', error);
      setToast({ message: `Gagal membuat QR baru: ${error.message}`, type: 'error' });
    },
  });

  // Countdown management
  const [countdown, setCountdown] = useState(() => {
    if (!qr?.expires_at) return 0;
    const expiry = new Date(qr.expires_at).getTime();
    return Math.max(Math.floor((expiry - Date.now()) / 1000), 0);
  });

  useEffect(() => {
    if (!qr?.expires_at) return;
    const expiry = new Date(qr.expires_at).getTime();
    const tick = () => {
      const now = Date.now();
      setCountdown(Math.max(Math.floor((expiry - now) / 1000), 0));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [qr?.expires_at]);

  // Auto-regenerate: when countdown reaches 0, invalidate so useActiveQr
  // calls get_active_qr which will rotate expired tokens automatically.
  useEffect(() => {
    if (!isLoading && qr && countdown <= 0) {
      console.log('QR expired, triggering refetch');
      refetch();
    }
  }, [countdown, isLoading, qr, refetch]);

  // QR Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('public:qr_sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'qr_sessions' },
        () => {
          console.log('QR session changed, invalidating queries');
          queryClient.invalidateQueries({ queryKey: ['admin', 'qr'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const generateQr = async () => {
    await generateQrMutation.mutateAsync();
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return {
    qr,
    isLoading,
    isGenerating: generateQrMutation.isPending,
    countdown,
    formatCountdown,
    generateQr,
    toast,
    refetch,
  };
}