import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Attendance, AttendanceStatus, Profile } from '@/types/database';

export interface AnggotaWithAttendance extends Profile {
  attendance_count: number;
  attendance_percentage: number;
}

const EMPTY_SUMMARY: Record<AttendanceStatus, number> = {
  HADIR: 0,
  TERLAMBAT: 0,
  IZIN: 0,
  SAKIT: 0,
  ALPA: 0,
};

export function useAnggota() {
  return useQuery<AnggotaWithAttendance[]>({
    queryKey: ['admin', 'anggota'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'ANGGOTA')
        .eq('approval_status', 'APPROVED')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const profiles = (data as Profile[]) ?? [];

      const { data: attendance, error: attendanceError } = await supabase
        .from('attendances')
        .select('user_id, status');
      if (attendanceError) throw attendanceError;

      const counts = new Map<string, Record<AttendanceStatus, number>>();
      for (const row of attendance ?? []) {
        const entry = counts.get(row.user_id) ?? { ...EMPTY_SUMMARY };
        entry[row.status as AttendanceStatus]++;
        counts.set(row.user_id, entry);
      }

      return profiles.map((profile) => {
        const summary = counts.get(profile.id) ?? { ...EMPTY_SUMMARY };
        const total =
          summary.HADIR +
          summary.TERLAMBAT +
          summary.IZIN +
          summary.SAKIT +
          summary.ALPA;
        return {
          ...profile,
          attendance_count: total,
          attendance_percentage: Math.round((summary.HADIR / 40) * 100),
        };
      });
    },
  });
}

export function useToggleActive() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const adminId = user?.id ?? '';

  return useMutation<void, Error, { userId: string; isActive: boolean }>({
    mutationFn: async ({ userId, isActive }) => {
      const { data, error } = await supabase.rpc('admin_toggle_user_active', {
        p_admin_id: adminId,
        p_user_id: userId,
        p_is_active: isActive,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'anggota'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pendaftaran'] });
    },
  });
}

export function useAnggotaAttendance(userId: string) {
  return useQuery<Attendance[]>({
    queryKey: ['admin', 'anggota-attendance', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', userId)
        .order('attendance_date', { ascending: false });
      if (error) throw error;
      return (data as Attendance[]) ?? [];
    },
    enabled: Boolean(userId),
  });
}
