import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Profile } from '@/types/database';
import type { ApprovalStatus } from '@/types/database';

function pendaftaranKey(status: ApprovalStatus | 'ALL') {
  return ['admin', 'pendaftaran', status] as const;
}

export function usePendaftaran(status?: ApprovalStatus) {
  const queryKey = pendaftaranKey(status ?? 'ALL');

  return useQuery<Profile[]>({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'ANGGOTA')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('approval_status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as Profile[]) ?? [];
    },
  });
}

export function useApproveUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const adminId = user?.id ?? '';

  return useMutation<void, Error, { userId: string; notes?: string }>({
    mutationFn: async ({ userId, notes }) => {
      const { data, error } = await supabase.rpc('admin_approve_user', {
        p_admin_id: adminId,
        p_user_id: userId,
        p_notes: notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendaftaranKey('ALL') });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'anggota'] });
    },
  });
}

export function useRejectUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const adminId = user?.id ?? '';

  return useMutation<void, Error, { userId: string; notes: string }>({
    mutationFn: async ({ userId, notes }) => {
      const { data, error } = await supabase.rpc('admin_reject_user', {
        p_admin_id: adminId,
        p_user_id: userId,
        p_notes: notes,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendaftaranKey('ALL') });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const adminId = user?.id ?? '';

  return useMutation<void, Error, { userId: string; notes?: string }>({
    mutationFn: async ({ userId, notes }) => {
      const { data, error } = await supabase.rpc('admin_suspend_user', {
        p_admin_id: adminId,
        p_user_id: userId,
        p_notes: notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendaftaranKey('ALL') });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'anggota'] });
    },
  });
}

export function useUpdateProfileMember() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { userId: string; name: string; faculty: string; major: string }
  >({
    mutationFn: async ({ userId, name, faculty, major }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ name, faculty, major })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'anggota'] });
    },
  });
}
