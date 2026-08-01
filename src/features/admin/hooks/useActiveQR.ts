import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import type { QrSession, ActiveQrResponse, AdminQrResponse } from '@/types/database';

interface QrSessionWithUsedBy extends QrSession {
  profiles?: { name: string } | null;
}

/** Module-level single-flight guard: prevent concurrent get_active_qr RPC calls. */
let activeQrInFlight: Promise<ActiveQrResponse | null> | null = null;

/**
 * Fetch the active QR straight from the RPC — the single source of truth.
 * get_active_qr() invalidates silently-expired tokens and atomically creates
 * a fresh one, so calling it directly is all we need (no qr_sessions read).
 */
async function fetchActiveQrOnce(): Promise<ActiveQrResponse | null> {
  if (activeQrInFlight) return activeQrInFlight;

  activeQrInFlight = (async () => {
    const { data, error } = await supabase.rpc('get_active_qr');
    if (error) throw error;
    return data as ActiveQrResponse | null;
  })();

  try {
    return await activeQrInFlight;
  } finally {
    activeQrInFlight = null;
  }
}

/** Convert an ActiveQrResponse RPC result into a local QrSession row. */
function toQrSession(rpc: ActiveQrResponse | null): QrSessionWithUsedBy | null {
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
}

/**
 * Query: fetch the currently valid active QR from get_active_qr() RPC only.
 * qr_sessions is not queried — it's history only.
 */
export function useActiveQr() {
  return useQuery<QrSessionWithUsedBy | null>({
    queryKey: ['admin', 'qr'],
    queryFn: async () => {
      const rpc = await fetchActiveQrOnce();
      return toQrSession(rpc);
    },
    refetchInterval: 2000,
    staleTime: 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

/**
 * Mutation: manually generate a fresh QR via admin_generate_qr.
 * Guarded against concurrent calls; emits a single, deduped toast.
 */
export function useGenerateQr() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const generatingRef = useRef(false);

  return useMutation({
    mutationFn: async () => {
      if (generatingRef.current) {
        throw new Error('GENERATION_IN_PROGRESS');
      }
      generatingRef.current = true;

      try {
        const { data, error } = await supabase.rpc('admin_generate_qr', {
          p_admin_id: user?.id ?? '',
        });

        // Consistent error handling for all RPC calls
        if (error) {
          console.error('Generate QR RPC error:', error);
          throw new Error(error.message);
        }

        const result = data as AdminQrResponse | null;

        // Parse structured response: { success, qr, error }
        if (!result?.success || !result.qr) {
          const errorMessage = result?.error ?? 'Gagal membuat QR baru';
          console.error('Generate QR RPC failed:', errorMessage);
          throw new Error(errorMessage);
        }

        console.log('Generate QR response:', result);
        return result;
      } finally {
        generatingRef.current = false;
      }
    },
    onSuccess: (result) => {
      console.log('QR generated successfully:', result);
      // Update cache directly so the new QR renders instantly without refetch.
      const next = toQrSession(result);
      if (next) {
        queryClient.setQueryData(['admin', 'qr'], next);
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'qr'] });

      toast.success('QR berhasil dibuat', { id: 'qr-generated' });
    },
    onError: (error) => {
      // Do not show a toast for the concurrency guard — just bail silently.
      if ((error as Error).message === 'GENERATION_IN_PROGRESS') {
        return;
      }
      console.error('QR generation error:', error);
      toast.error(`Gagal membuat QR baru: ${(error as Error).message}`, {
        id: 'qr-generated-error',
      });
    },
  });
}

/**
 * Composite hook: full QR admin lifecycle — query, manual generate, countdown,
 * realtime subscription, and auto-regenerate-on-expiry.
 */
export function useActiveQR() {
  const queryClient = useQueryClient();

  const { data: qr, isLoading, error: queryError } = useActiveQr();
  const generateQrMutation = useGenerateQr();

  // Auto-refresh on query error
  useEffect(() => {
    if (queryError) {
      console.log('QR query error:', queryError);
      queryClient.invalidateQueries({ queryKey: ['admin', 'qr'] });
    }
  }, [queryClient, queryError]);

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

  // Auto-regenerate when countdown reaches 0: invalidate so the query refetches
  // get_active_qr() which rotates the expired token into a fresh one.
  useEffect(() => {
    if (!qr) return;

    if (countdown <= 0) {
      console.log('QR expired, invalidating query to auto-regenerate');
      queryClient.invalidateQueries({ queryKey: ['admin', 'qr'] });
    }
  }, [countdown, qr, queryClient]);

  // QR Realtime: only invalidate on actual DB row changes (INSERT/UPDATE/DELETE),
  // and skip events that describe no change to the tracked QR.
  useEffect(() => {
    const channel = supabase
      .channel('public:qr_sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'qr_sessions' },
        (payload) => {
          const current = queryClient.getQueryData<QrSessionWithUsedBy | null>(
            ['admin', 'qr'],
          );

          const row = payload.new as
            | { id?: string; is_active?: boolean; token?: string; expires_at?: string; used_by?: string | null }
            | null;

          // DELETE event or unrelated insert — still a real DB change; let query sort it out.
          if (!current || !row) {
            queryClient.invalidateQueries({ queryKey: ['admin', 'qr'] });
            return;
          }

          // Only skip identical snapshots of the tracked row.
          if (
            row.id === current.id &&
            row.is_active === current.is_active &&
            row.token === current.token &&
            row.expires_at === current.expires_at
          ) {
            return;
          }

          console.log('QR session changed, invalidating queries');
          queryClient.invalidateQueries({ queryKey: ['admin', 'qr'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
    generateQr: () => generateQrMutation.mutateAsync(),
    refetch: () => queryClient.invalidateQueries({ queryKey: ['admin', 'qr'] }),
  };
}
