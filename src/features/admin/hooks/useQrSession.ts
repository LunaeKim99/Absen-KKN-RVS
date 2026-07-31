import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { QrSession, ActiveQrResponse } from '@/types/database';

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
 * Fetch the currently valid active QR.
 * - If a valid (non-expired, active) QR exists, return it.
 * - Otherwise call `get_active_qr`, which invalidates any silently-expired
 *   QR and atomically rotates in a fresh single-use token.
 *
 * This is what makes expiry trigger an automatic regenerate: the admin screen
 * polls (fallback) + listens to realtime, and whenever neither a valid QR is
 * found, the RPC creates one automatically.
 */
export function useActiveQr() {
  return useQuery<QrSessionWithUsedBy | null>({
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
    refetchInterval: 3000,
    staleTime: 1000,
  });
}

export function useGenerateQr() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const adminId = user?.id ?? '';

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_generate_qr', {
        p_admin_id: adminId,
      });
      if (error) throw error;
      const result = data as ActiveQrResponse | null;
      if (!result?.success) {
        throw new Error(result?.error ?? 'Gagal membuat QR baru');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'qr'] });
    },
  });
}

export function useQrRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('public:qr_sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'qr_sessions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin', 'qr'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

export function useQrCountdown(expiresAt: string | undefined) {
  const [remaining, setRemaining] = useState(() => {
    if (!expiresAt) return 0;
    const expiry = new Date(expiresAt).getTime();
    return Math.max(Math.floor((expiry - Date.now()) / 1000), 0);
  });

  useEffect(() => {
    if (!expiresAt) return;
    const expiry = new Date(expiresAt).getTime();
    const tick = () => {
      const now = Date.now();
      setRemaining(Math.max(Math.floor((expiry - now) / 1000), 0));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return remaining;
}
