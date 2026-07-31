-- Auto-approve new signups + remove approval gate from process_attendance
-- so members can scan/absent immediately after registration.

-- 1. New trigger: auto-APPROVED on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- 2. process_attendance: drop approval_status gate, keep is_active
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
set search_path = public
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
  v_today := (now() at time zone 'Asia/Jakarta')::date;

  -- Only require the user to be an active ANggota (no approval gate)
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

  v_check_in_at := now();
  v_attendance_status := 'HADIR';

  update public.qr_sessions
  set is_active = false,
      used_by = p_user_id,
      used_at = v_check_in_at
  where id = v_qr_record.id;

  insert into public.attendances (
    user_id, attendance_date, check_in_at, status,
    latitude, longitude, location_accuracy, device_info
  ) values (
    p_user_id, v_today, v_check_in_at, v_attendance_status,
    p_latitude, p_longitude, p_location_accuracy, p_device_info
  )
  returning * into v_attendance;

  v_new_token := encode(gen_random_bytes(32), 'hex');
  v_new_qr_id := gen_random_uuid();

  insert into public.qr_sessions (id, token, is_active, expires_at, created_by)
  values (v_new_qr_id, v_new_token, true, now() + interval '60 seconds', null);

  insert into public.activity_logs (user_id, action, details)
  values (p_user_id, 'ATTENDANCE', json_build_object(
    'date', v_today,
    'status', v_attendance_status,
    'check_in_at', v_check_in_at
  )::text);

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
$$;
