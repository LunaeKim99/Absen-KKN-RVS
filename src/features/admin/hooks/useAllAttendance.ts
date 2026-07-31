import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AttendanceWithProfile, AttendanceStatus } from '@/types/database';

interface AllAttendanceFilters {
  date?: string;
  search?: string;
}

function allAttendanceKey(filters: AllAttendanceFilters) {
  return ['admin', 'absensi', filters.date ?? 'all', filters.search ?? 'all'] as const;
}

export function useAllAttendance(filters: AllAttendanceFilters = {}) {
  return useQuery<AttendanceWithProfile[]>({
    queryKey: allAttendanceKey(filters),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendances')
        .select('*, profiles!user_id(name, nim)')
        .order('attendance_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as AttendanceWithProfile[]) ?? [];
    },
  });
}

export function useUpdateAttendanceStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { attendanceId: string; status: AttendanceStatus; notes?: string }
  >({
    mutationFn: async ({ attendanceId, status, notes }) => {
      const { error } = await supabase
        .from('attendances')
        .update({ status, notes: notes ?? null })
        .eq('id', attendanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'absensi'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useFilteredAttendance(filters: AllAttendanceFilters) {
  const query = useAllAttendance(filters);

  const filtered = useMemo(() => {
    let result = query.data ?? [];
    if (filters.date) {
      result = result.filter((a) => a.attendance_date === filters.date);
    }
    if (filters.search) {
      const term = filters.search.toLowerCase();
      result = result.filter(
        (a) =>
          a.profiles?.name?.toLowerCase().includes(term) ||
          a.profiles?.nim?.toLowerCase().includes(term),
      );
    }
    return result;
  }, [query.data, filters.date, filters.search]);

  return { ...query, data: filtered };
}