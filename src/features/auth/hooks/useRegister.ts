import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RegisterInput } from '@/validations';

export function useRegister() {
  const mutation = useMutation({
    mutationFn: async (input: RegisterInput) => {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            name: input.name,
            nim: input.nim,
            faculty: input.faculty,
            major: input.major,
            role: 'ANGGOTA',
          },
        },
      });
      if (error) {
        const message = error.message;
        if (message.includes('already registered') || message.includes('Database error')) {
          throw new Error('Email atau NIM sudah terdaftar');
        }
        throw new Error(message || 'Gagal mendaftar, silakan coba lagi');
      }
      return data.user;
    },
  });

  return {
    register: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
