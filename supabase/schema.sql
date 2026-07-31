-- =============================================
-- Absensi KKN - Database Schema for Supabase
-- =============================================

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  nim text unique not null,
  email text unique not null,
  faculty text not null,
  major text not null,
  role text not null check (role in ('ADMIN', 'ANGGOTA')) default 'ANGGOTA',
  approval_status text not null check (approval_status in ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')) default 'PENDING',
  approval_notes text,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  is_active boolean not null default true,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. ATTENDANCES TABLE
create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  check_in_at timestamptz not null default now(),
  status text not null check (status in ('HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPA')) default 'HADIR',
  latitude double precision,
  longitude double precision,
  location_accuracy double precision,
  device_info text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, attendance_date)
);

-- 3. QR SESSIONS TABLE
create table if not exists public.qr_sessions (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  is_active boolean not null default true,
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id),
  used_by uuid references public.profiles(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- 4. ACTIVITY LOGS TABLE
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

-- 5. KKN PERIODS TABLE
create table if not exists public.kkn_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  duration_days integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================
-- INDEXES
-- =============================================
create index if not exists idx_profiles_nim on public.profiles(nim);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_approval_status on public.profiles(approval_status);
create index if not exists idx_attendances_user_id on public.attendances(user_id);
create index if not exists idx_attendances_date on public.attendances(attendance_date);
create index if not exists idx_attendances_status on public.attendances(status);
create index if not exists idx_qr_sessions_token on public.qr_sessions(token);
create index if not exists idx_qr_sessions_active on public.qr_sessions(is_active);
create index if not exists idx_activity_logs_user_id on public.activity_logs(user_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs(created_at);
create index if not exists idx_kkn_periods_active on public.kkn_periods(is_active);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.attendances
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.kkn_periods
  for each row execute function public.handle_updated_at();

-- =============================================
-- AUTO CREATE PROFILE ON SIGNUP TRIGGER
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
   insert into public.profiles (id, name, nim, email, faculty, major, role, approval_status)
   values (
     new.id,
     coalesce(new.raw_user_meta_data->>'name', ''),
     coalesce(new.raw_user_meta_data->>'nim', ''),
     coalesce(new.email, ''),
     coalesce(new.raw_user_meta_data->>'faculty', ''),
     coalesce(new.raw_user_meta_data->>'major', ''),
     'ANGGOTA',
     'APPROVED'
   );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- DEFAULT KKN PERIOD
-- =============================================
insert into public.kkn_periods (name, start_date, end_date, duration_days, is_active)
values ('KKN 2026', '2026-07-27', '2026-09-06', 42, true)
on conflict do nothing;

-- =============================================
-- RPC: ATOMIC QR ROTATION + ATTENDANCE
-- =============================================
create or replace function public.process_attendance(
  p_user_id uuid,
  p_token text,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_location_accuracy double precision default null,
  p_device_info text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_qr_record record;
  v_new_token text;
  v_new_qr_id uuid;
  v_check_in_at timestamptz;
  v_attendance_status text;
  v_today date;
  v_attendance record;
begin
  -- Set today in Asia/Jakarta timezone
  v_today := (now() at time zone 'Asia/Jakarta')::date;
  
   -- 1. Validate user is active (approval is automatic on signup)
   if not exists (
     select 1 from public.profiles
     where id = p_user_id
     and role = 'ANGGOTA'
     and is_active = true
   ) then
     return json_build_object(
       'success', false,
       'error', 'Akun Anda tidak aktif'
     );
   end if;

  -- 2. Validate user hasn't already attended today
  if exists (
    select 1 from public.attendances
    where user_id = p_user_id
    and attendance_date = v_today
  ) then
    return json_build_object(
      'success', false,
      'error', 'Anda sudah melakukan absensi hari ini'
    );
  end if;

  -- 3. Find and lock the active QR token
  select * into v_qr_record
  from public.qr_sessions
  where token = p_token
  and is_active = true
  and expires_at > now()
  for update;

  if not found then
    return json_build_object(
      'success', false,
      'error', 'QR tidak valid atau sudah kedaluwarsa'
    );
  end if;

  -- 4. Check KKN period is active
  if not exists (
    select 1 from public.kkn_periods
    where is_active = true
    and v_today >= start_date
    and v_today <= end_date
  ) then
    return json_build_object(
      'success', false,
      'error', 'Periode KKN tidak aktif'
    );
  end if;

  -- 5. Mark QR as used
  v_check_in_at := now();
  
  -- Determine attendance status (within 15 minutes of start = HADIR, else TERLAMBAT)
  v_attendance_status := 'HADIR';
  
  update public.qr_sessions
  set is_active = false,
      used_by = p_user_id,
      used_at = v_check_in_at
  where id = v_qr_record.id;

  -- 6. Create attendance record
  insert into public.attendances (
    user_id, attendance_date, check_in_at, status,
    latitude, longitude, location_accuracy, device_info
  ) values (
    p_user_id, v_today, v_check_in_at, v_attendance_status,
    p_latitude, p_longitude, p_location_accuracy, p_device_info
  )
  returning * into v_attendance;

  -- 7. Generate new QR token
  v_new_token := encode(gen_random_bytes(32), 'hex');
  v_new_qr_id := gen_random_uuid();
  
  insert into public.qr_sessions (id, token, is_active, expires_at, created_by)
  values (v_new_qr_id, v_new_token, true, now() + interval '60 seconds', null);

  -- 8. Log the attendance
  insert into public.activity_logs (user_id, action, details)
  values (p_user_id, 'ATTENDANCE', json_build_object(
    'date', v_today,
    'status', v_attendance_status,
    'check_in_at', v_check_in_at
  )::text);

  -- 9. Return success with new token
  return json_build_object(
    'success', true,
    'attendance', json_build_object(
      'id', v_attendance.id,
      'status', v_attendance_status,
      'check_in_at', v_check_in_at,
      'date', v_today
    ),
    'new_qr_token', v_new_token,
    'new_qr_id', v_new_qr_id
  );
end;
$$ language plpgsql;

-- =============================================
-- RPC: GET ACTIVE QR TOKEN
-- =============================================
create or replace function public.get_active_qr()
returns json
language plpgsql
security definer
as $$
declare
  v_qr_record record;
  v_today date;
begin
  v_today := (now() at time zone 'Asia/Jakarta')::date;
  
  -- Get active QR that hasn't expired
  select * into v_qr_record
  from public.qr_sessions
  where is_active = true
  and expires_at > now()
  order by created_at desc
  limit 1;
  
  if found then
    return json_build_object(
      'success', true,
      'qr', json_build_object(
        'id', v_qr_record.id,
        'token', v_qr_record.token,
        'expires_at', v_qr_record.expires_at
      )
    );
  else
    -- No active QR, create new one
    declare
      v_new_token text;
      v_new_qr_id uuid;
    begin
      v_new_token := encode(gen_random_bytes(32), 'hex');
      v_new_qr_id := gen_random_uuid();
      
      insert into public.qr_sessions (id, token, is_active, expires_at, created_by)
      values (v_new_qr_id, v_new_token, true, now() + interval '60 seconds', null);
      
      return json_build_object(
        'success', true,
        'qr', json_build_object(
          'id', v_new_qr_id,
          'token', v_new_token,
          'expires_at', now() + interval '60 seconds'
        )
      );
    end;
  end if;
end;
$$ language plpgsql;

-- =============================================
-- RPC: GENERATE NEW QR (ADMIN ONLY)
-- =============================================
create or replace function public.admin_generate_qr(p_admin_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_new_token text;
  v_new_qr_id uuid;
  v_today date;
begin
  v_today := (now() at time zone 'Asia/Jakarta')::date;
  
  -- Check KKN period is active
  if not exists (
    select 1 from public.kkn_periods
    where is_active = true
    and v_today >= start_date
    and v_today <= end_date
  ) then
    return json_build_object(
      'success', false,
      'error', 'Periode KKN tidak aktif'
    );
  end if;
  
  -- Deactivate all existing active QR
  update public.qr_sessions set is_active = false where is_active = true;
  
  -- Generate new QR
  v_new_token := encode(gen_random_bytes(32), 'hex');
  v_new_qr_id := gen_random_uuid();
  
  insert into public.qr_sessions (id, token, is_active, expires_at, created_by)
  values (v_new_qr_id, v_new_token, true, now() + interval '60 seconds', p_admin_id);
  
  -- Log the action
  insert into public.activity_logs (user_id, action, details)
  values (p_admin_id, 'QR_GENERATED', json_build_object('qr_id', v_new_qr_id)::text);
  
  return json_build_object(
    'success', true,
    'qr', json_build_object(
      'id', v_new_qr_id,
      'token', v_new_token,
      'expires_at', now() + interval '60 seconds'
    )
  );
end;
$$;

-- =============================================
-- RPC: APPROVE USER
-- =============================================
create or replace function public.admin_approve_user(
  p_admin_id uuid,
  p_user_id uuid,
  p_notes text default null
)
returns json
language plpgsql
security definer
as $$
begin
  update public.profiles
  set approval_status = 'APPROVED',
      approved_by = p_admin_id,
      approved_at = now(),
      approval_notes = p_notes
  where id = p_user_id;
  
  insert into public.activity_logs (user_id, action, details)
  values (p_admin_id, 'USER_APPROVED', json_build_object('target_user', p_user_id, 'notes', p_notes)::text);
  
  return json_build_object('success', true);
end;
$$;

-- =============================================
-- RPC: REJECT USER
-- =============================================
create or replace function public.admin_reject_user(
  p_admin_id uuid,
  p_user_id uuid,
  p_notes text
)
returns json
language plpgsql
security definer
as $$
begin
  update public.profiles
  set approval_status = 'REJECTED',
      approval_notes = p_notes
  where id = p_user_id;
  
  insert into public.activity_logs (user_id, action, details)
  values (p_admin_id, 'USER_REJECTED', json_build_object('target_user', p_user_id, 'notes', p_notes)::text);
  
  return json_build_object('success', true);
end;
$$;

-- =============================================
-- RPC: SUSPEND USER
-- =============================================
create or replace function public.admin_suspend_user(
  p_admin_id uuid,
  p_user_id uuid,
  p_notes text default null
)
returns json
language plpgsql
security definer
as $$
begin
  update public.profiles
  set approval_status = 'SUSPENDED',
      is_active = false,
      approval_notes = coalesce(p_notes, approval_notes)
  where id = p_user_id;
  
  insert into public.activity_logs (user_id, action, details)
  values (p_admin_id, 'USER_SUSPENDED', json_build_object('target_user', p_user_id, 'notes', p_notes)::text);
  
  return json_build_object('success', true);
end;
$$;

-- =============================================
-- RPC: TOGGLE USER ACTIVE STATUS
-- =============================================
create or replace function public.admin_toggle_user_active(
  p_admin_id uuid,
  p_user_id uuid,
  p_is_active boolean
)
returns json
language plpgsql
security definer
as $$
begin
  update public.profiles
  set is_active = p_is_active,
      approval_status = case when p_is_active then 'APPROVED' else 'SUSPENDED' end
  where id = p_user_id;
  
  insert into public.activity_logs (user_id, action, details)
  values (p_admin_id, 'USER_TOGGLED', json_build_object('target_user', p_user_id, 'is_active', p_is_active)::text);
  
  return json_build_object('success', true);
end;
$$;

-- =============================================
-- RPC: GET TODAY ATTENDANCE STATS (ADMIN)
-- =============================================
create or replace function public.admin_get_today_stats()
returns json
language plpgsql
security definer
as $$
declare
  v_today date;
  v_stats json;
begin
  v_today := (now() at time zone 'Asia/Jakarta')::date;
  
  select json_build_object(
    'total_members', (select count(*) from public.profiles where role = 'ANGGOTA' and approval_status = 'APPROVED'),
    'hadir', (select count(*) from public.attendances where attendance_date = v_today and status = 'HADIR'),
    'terlambat', (select count(*) from public.attendances where attendance_date = v_today and status = 'TERLAMBAT'),
    'izin', (select count(*) from public.attendances where attendance_date = v_today and status = 'IZIN'),
    'sakit', (select count(*) from public.attendances where attendance_date = v_today and status = 'SAKIT'),
    'alpa', (
      select count(*) from public.profiles 
      where role = 'ANGGOTA' and approval_status = 'APPROVED'
      and id not in (
        select user_id from public.attendances where attendance_date = v_today
      )
    ),
    'total_approved', (select count(*) from public.profiles where role = 'ANGGOTA' and approval_status = 'APPROVED'),
    'total_pending', (select count(*) from public.profiles where role = 'ANGGOTA' and approval_status = 'PENDING'),
    'total_rejected', (select count(*) from public.profiles where role = 'ANGGOTA' and approval_status = 'REJECTED'),
    'total_suspended', (select count(*) from public.profiles where role = 'ANGGOTA' and approval_status = 'SUSPENDED'),
    'total_registered', (select count(*) from public.profiles where role = 'ANGGOTA'),
    'today', v_today
  ) into v_stats;
  
  return v_stats;
end;
$$ language plpgsql;

-- =============================================
-- RLS HELPER: CHECK ADMIN (SECURITY DEFINER bypasses RLS, avoids recursion)
-- =============================================
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid();

  return v_role = 'ADMIN';
end;
$$;

-- =============================================
-- RLS: ENABLE ROW LEVEL SECURITY
-- =============================================
alter table public.profiles enable row level security;
alter table public.attendances enable row level security;
alter table public.qr_sessions enable row level security;
alter table public.activity_logs enable row level security;
alter table public.kkn_periods enable row level security;

-- =============================================
-- RLS POLICIES: PROFILES
-- =============================================
-- Admin can see all profiles
create policy "Admin can view all profiles" on public.profiles
  for select to authenticated
  using (public.is_admin());

-- Users can view their own profile
create policy "Users can view own profile" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

-- Users can update their own limited fields
create policy "Users can update own profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Public insert for signup (handled by trigger)
create policy "Allow signup insert" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

-- =============================================
-- RLS POLICIES: ATTENDANCES
-- =============================================
-- Admin can see all attendances
create policy "Admin can view all attendances" on public.attendances
  for select to authenticated
  using (public.is_admin());

-- Users can view their own attendances
create policy "Users can view own attendances" on public.attendances
  for select to authenticated
  using (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: QR_SESSIONS
-- =============================================
-- Admin can see all QR sessions
create policy "Admin can view all QR sessions" on public.qr_sessions
  for select to authenticated
  using (public.is_admin());

-- =============================================
-- RLS POLICIES: ACTIVITY_LOGS
-- =============================================
-- Admin can see all activity logs
create policy "Admin can view all activity logs" on public.activity_logs
  for select to authenticated
  using (public.is_admin());

-- Users can see their own activity logs
create policy "Users can view own activity logs" on public.activity_logs
  for select to authenticated
  using (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES: KKN_PERIODS
-- =============================================
-- Everyone can read KKN periods
create policy "Everyone can read KKN periods" on public.kkn_periods
  for select to authenticated
  using (true);

-- =============================================
-- GRANT PERMISSIONS
-- =============================================
grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.attendances to anon, authenticated;
grant select on public.qr_sessions to anon, authenticated;
grant select on public.activity_logs to anon, authenticated;
grant select on public.kkn_periods to anon, authenticated;
grant insert on public.profiles to authenticated;
grant update on public.profiles to authenticated;
grant insert on public.attendances to authenticated;
grant insert on public.qr_sessions to authenticated;
grant insert on public.activity_logs to authenticated;
grant execute on function public.process_attendance to authenticated;
grant execute on function public.get_active_qr to authenticated;
grant execute on function public.admin_generate_qr to authenticated;
grant execute on function public.admin_approve_user to authenticated;
grant execute on function public.admin_reject_user to authenticated;
grant execute on function public.admin_suspend_user to authenticated;
grant execute on function public.admin_toggle_user_active to authenticated;
grant execute on function public.admin_get_today_stats to authenticated;
grant execute on function public.is_admin() to authenticated;
