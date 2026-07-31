import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { profileUpdateSchema, type ProfileUpdateInput } from '@/validations';
import type { Profile } from '@/types/database';

const profileKey = (userId: string) => ['profile', userId] as const;

export function useProfile(userId: string) {
  return useQuery({
    queryKey: profileKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile) ?? null;
    },
    enabled: Boolean(userId),
  });
}

export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileUpdateInput) => {
      const parsed = profileUpdateSchema.parse(input);
      const { error } = await supabase
        .from('profiles')
        .update(parsed)
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKey(userId) });
    },
  });
}
