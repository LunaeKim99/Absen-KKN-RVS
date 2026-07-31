-- Fix 403 Forbidden on admin RPCs
-- All write functions are SECURITY INVOKER but write to tables
-- with RLS enabled + no INSERT/UPDATE policies for authenticated role.
-- => PostgREST returns 403 (SQLSTATE 42501 insufficient_privilege)
-- Fix: switch to SECURITY DEFINER so writes bypass RLS.

-- =============================================
-- process_attendance (member: writes attendances + qr_sessions + activity_logs)
-- =============================================
CREATE OR REPLACE FUNCTION public.process_attendance(
  p_user_id uuid,
  p_token text,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_location_accuracy double precision default null,
  p_device_info text default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  if not exists (
    select 1 from public.profiles
    where id = p_user_id
    and role = 'ANGGOTA'
    and approval_status = 'APPROVED'
    and is_active = true
  ) then
    return json_build_object(
      'success', false,
      'error', 'Akun Anda belum disetujui atau tidak aktif'
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

-- =============================================
-- get_active_qr (user: reads + inserts qr_sessions)
-- =============================================
CREATE OR REPLACE FUNCTION public.get_active_qr()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_qr_record record;
  v_today date;
begin
  v_today := (now() at time zone 'Asia/Jakarta')::date;

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
$$;

-- =============================================
-- admin_generate_qr
-- =============================================
CREATE OR REPLACE FUNCTION public.admin_generate_qr(p_admin_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_new_token text;
  v_new_qr_id uuid;
  v_today date;
begin
  v_today := (now() at time zone 'Asia/Jakarta')::date;

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

  v_new_token := encode(gen_random_bytes(32), 'hex');
  v_new_qr_id := gen_random_uuid();

  insert into public.qr_sessions (id, token, is_active, expires_at, created_by)
  values (v_new_qr_id, v_new_token, true, now() + interval '60 seconds', p_admin_id);

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
-- admin_approve_user
-- =============================================
CREATE OR REPLACE FUNCTION public.admin_approve_user(
  p_admin_id uuid,
  p_user_id uuid,
  p_notes text default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
-- admin_reject_user
-- =============================================
CREATE OR REPLACE FUNCTION public.admin_reject_user(
  p_admin_id uuid,
  p_user_id uuid,
  p_notes text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
-- admin_suspend_user
-- =============================================
CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  p_admin_id uuid,
  p_user_id uuid,
  p_notes text default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
-- admin_toggle_user_active
-- =============================================
CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(
  p_admin_id uuid,
  p_user_id uuid,
  p_is_active boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
-- admin_get_today_stats (reads all tables - SECURITY DEFINER so not filtered by RLS)
-- =============================================
CREATE OR REPLACE FUNCTION public.admin_get_today_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- =============================================
-- Re-assert grants: SECURITY DEFINER makes function
-- callable by PUBLIC by default; we restrict to authenticated.
-- =============================================
REVOKE EXECUTE ON FUNCTION public.process_attendance(uuid, text, double precision, double precision, double precision, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_active_qr() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_generate_qr(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_approve_user(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reject_user(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_suspend_user(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_user_active(uuid, uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_today_stats() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.process_attendance(uuid, text, double precision, double precision, double precision, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_qr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_generate_qr(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_user(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_user(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_active(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_today_stats() TO authenticated;
