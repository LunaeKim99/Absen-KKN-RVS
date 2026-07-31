import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { QrSession } from '@/types/database';

interface QrSessionWithUsedBy extends QrSession {
  profiles?: { name: string } | null;
}

export function useActiveQr() {
  return useQuery<QrSessionWithUsedBy | null>({
    queryKey: ['admin', 'qr'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qr_sessions')
        .select('*, profiles!used_by(name)')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as QrSessionWithUsedBy) ?? null;
    },
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
      return data;
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
