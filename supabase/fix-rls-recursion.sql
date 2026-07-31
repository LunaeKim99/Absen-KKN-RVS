-- =============================================
-- Fix RLS Infinite Recursion in policies
-- Jalankan ini di Supabase SQL Editor
-- =============================================

-- 1. Helper function to check admin status (bypass RLS with SECURITY DEFINER)
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
as $$
declare
  v_role text;
begin
  -- Read profiles table WITHOUT triggering RLS (SECURITY DEFINER bypasses RLS)
  select role into v_role
  from public.profiles
  where id = auth.uid();
  
  return v_role = 'ADMIN';
end;
$$;

-- Also create helper for current user's profile for other checks
create or replace function public.my_profile_id()
returns uuid
language plpgsql
security definer
as $$
begin
  return auth.uid();
end;
$$;

-- 2. Drop broken policies on profiles
drop policy if exists "Admin can view all profiles" on public.profiles;

-- 3. Recreate policies on profiles without recursion
-- Admin can see all profiles
create policy "Admin can view all profiles" on public.profiles
  for select to authenticated
  using (public.is_admin());

-- Users can view their own profile (already correct, no change needed)
-- "Users can view own profile" remains: using (auth.uid() = id)

-- Users can update their own profile (already correct)
-- "Users can update own profile" remains: using (auth.uid() = id)

-- Allow signup insert (already correct)
-- "Allow signup insert" remains: with check (auth.uid() = id)

-- 4. Drop and recreate broken policies on attendances
drop policy if exists "Admin can view all attendances" on public.attendances;
create policy "Admin can view all attendances" on public.attendances
  for select to authenticated
  using (public.is_admin());

-- Users can view own attendances (already correct)
-- "Users can view own attendances" remains: using (auth.uid() = user_id)

-- 5. Drop and recreate broken policies on qr_sessions
drop policy if exists "Admin can view all QR sessions" on public.qr_sessions;
create policy "Admin can view all QR sessions" on public.qr_sessions
  for select to authenticated
  using (public.is_admin());

-- 6. Drop and recreate broken policies on activity_logs
drop policy if exists "Admin can view all activity logs" on public.activity_logs;
create policy "Admin can view all activity logs" on public.activity_logs
  for select to authenticated
  using (public.is_admin());

-- Users can view own activity logs (already correct)
-- "Users can view own activity logs" remains: using (auth.uid() = user_id)

-- 7. Grant execute on helper functions
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_profile_id() to authenticated;

-- =============================================
-- VERIFIKASI: Cek semua policies sekarang
-- =============================================
select 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'attendances', 'qr_sessions', 'activity_logs')
order by tablename, policyname;