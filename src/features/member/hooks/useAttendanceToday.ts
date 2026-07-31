import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { supabase } from '@/lib/supabase';
import { KKN_CONFIG } from '@/config/kkn';
import type { Attendance } from '@/types/database';

export function useAttendanceToday(userId: string) {
  const todayInWIB = format(
    toZonedTime(new Date(), KKN_CONFIG.TIMEZONE),
    'yyyy-MM-dd',
  );

  return useQuery({
    queryKey: ['attendance-today', userId, todayInWIB],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', userId)
        .eq('attendance_date', todayInWIB)
        .maybeSingle();
      if (error) throw error;
      return (data as Attendance) ?? null;
    },
    enabled: Boolean(userId),
  });
}
