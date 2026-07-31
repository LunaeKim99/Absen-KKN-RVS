import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AdminTodayStats } from '@/types/database';

export function useAdminStats() {
  return useQuery<AdminTodayStats>({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_today_stats');
      if (error) throw error;
      return data as AdminTodayStats;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}
