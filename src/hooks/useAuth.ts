import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import type { User } from '@supabase/supabase-js';

interface UseAuthResult {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isAnggola: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const queryClient = useQueryClient();

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['auth-session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queryClient.setQueryData(['auth-session'], nextSession);
      if (!nextSession) {
        queryClient.removeQueries({ queryKey: ['profile'] });
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const user = session?.user ?? null;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Gagal memuat profil:', error.message);
        return null;
      }
      return data as Profile | null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = sessionLoading || (user !== null && profileLoading);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  return {
    user,
    profile: profile ?? null,
    isLoading,
    isAdmin: profile?.role === 'ADMIN',
    isAnggola: profile?.role === 'ANGGOTA',
    signOut,
  };
}
