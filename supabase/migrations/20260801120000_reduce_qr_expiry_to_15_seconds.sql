-- =============================================
-- Absensi KKN - Reduce QR expiry to 15 seconds
-- =============================================
-- All QR tokens now expire after 15 seconds instead of 60.
-- Applies to: get_active_qr, admin_generate_qr, process_attendance.
-- =============================================

-- 1. get_active_qr: return existing or auto-create with 15s expiry
create or replace function public.get_active_qr()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qr_record record;
  v_new_token text;
  v_new_qr_id uuid;
  v_now timestamptz;
  v_expires_at timestamptz;
begin
  v_now := now();
  v_expires_at := v_now + interval '15 seconds';

  perform pg_advisory_xact_lock(hashtext('absensi_kkn_qr_active_lock')::bigint);

  update public.qr_sessions
  set is_active = false
  where is_active = true
    and expires_at <= v_now
    and used_by is null;

  select * into v_qr_record
  from public.qr_sessions
  where is_active = true
  and expires_at > v_now
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
  end if;

  v_new_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_new_qr_id := extensions.gen_random_uuid();

  insert into public.qr_sessions (id, token, is_active, expires_at, created_by)
  values (v_new_qr_id, v_new_token, true, v_expires_at, null);

  return json_build_object(
    'success', true,
    'qr', json_build_object(
      'id', v_new_qr_id,
      'token', v_new_token,
      'expires_at', v_expires_at
    )
  );
exception
  when others then
    return json_build_object(
      'success', false,
      'error', sqlerrm
    );
end;
$$;

-- 2. admin_generate_qr: manual rotation with 15s expiry
create or replace function public.admin_generate_qr(p_admin_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_token text;
  v_new_qr_id uuid;
  v_today date;
  v_expires_at timestamptz;
  v_is_admin boolean;
begin
  select exists (
    select 1 from public.profiles
    where id = p_admin_id
    and role = 'ADMIN'
    and is_active = true
  ) into v_is_admin;

  if not v_is_admin then
    return json_build_object(
      'success', false,
      'error', 'Hanya admin yang dapat membuat QR'
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('absensi_kkn_qr_active_lock')::bigint);

  v_today := (now() at time zone 'Asia/Jakarta')::date;
  v_expires_at := now() + interval '15 seconds';

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

  update public.qr_sessions set is_active = false where is_active = true;

  v_new_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_new_qr_id := extensions.gen_random_uuid();

  insert into public.qr_sessions (id, token, is_active, expires_at, created_by)
  values (v_new_qr_id, v_new_token, true, v_expires_at, p_admin_id);

  insert into public.activity_logs (user_id, action, details)
  values (p_admin_id, 'QR_GENERATED', json_build_object('qr_id', v_new_qr_id)::text);

  return json_build_object(
    'success', true,
    'qr', json_build_object(
      'id', v_new_qr_id,
      'token', v_new_token,
      'expires_at', v_expires_at
    )
  );
exception
  when others then
    return json_build_object(
      'success', false,
      'error', sqlerrm
    );
end;
$$;

-- 3. process_attendance: auto-rotate QR with 15s expiry after attendance
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
  v_expires_at timestamptz;
  v_attendance_status text;
  v_today date;
  v_attendance record;
begin
  v_check_in_at := now();
  v_expires_at := v_check_in_at + interval '15 seconds';
  v_today := (v_check_in_at at time zone 'Asia/Jakarta')::date;

  perform pg_advisory_xact_lock(hashtext('absensi_kkn_qr_active_lock')::bigint);

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
  and expires_at > v_check_in_at
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

  v_new_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_new_qr_id := extensions.gen_random_uuid();

  insert into public.qr_sessions (id, token, is_active, expires_at, created_by)
  values (v_new_qr_id, v_new_token, true, v_expires_at, null);

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
exception
  when others then
    return json_build_object(
      'success', false,
      'error', sqlerrm
    );
end;
$$;

notify pgrst, 'reload schema';

grant execute on function public.process_attendance(uuid, text, double precision, double precision, double precision, text) to authenticated;
grant execute on function public.get_active_qr() to authenticated;
grant execute on function public.admin_generate_qr(uuid) to authenticated;

revoke execute on function public.process_attendance(uuid, text, double precision, double precision, double precision, text) from public;
revoke execute on function public.get_active_qr() from public;
revoke execute on function public.admin_generate_qr(uuid) from public;