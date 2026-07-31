import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Attendance, AttendanceStatus } from '@/types/database';

const EMPTY_SUMMARY: Record<AttendanceStatus, number> = {
  HADIR: 0,
  TERLAMBAT: 0,
  IZIN: 0,
  SAKIT: 0,
  ALPA: 0,
};

export function useAttendanceHistory(userId: string) {
  const query = useQuery({
    queryKey: ['attendance-history', userId],
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

  const summary = useMemo(() => {
    const counts = { ...EMPTY_SUMMARY };
    for (const attendance of query.data ?? []) {
      counts[attendance.status]++;
    }
    return counts;
  }, [query.data]);

  return {
    attendances: query.data ?? [],
    summary,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
