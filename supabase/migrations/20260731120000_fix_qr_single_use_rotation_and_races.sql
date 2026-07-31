-- =============================================
-- Absensi KKN - QR single-use + auto-rotation + race-safety
-- =============================================
-- Fixes:
--  1. QR expired but still `is_active` was never invalidated → admin
--     canvas stuck on a dead token (no auto-regenerate).
--  2. Nothing enforced a single active QR → concurrent generation could
--     create duplicate active tokens (race condition).
--  3. get_active_qr could double-insert when called concurrently.
-- =============================================

-- 1. Collapse any currently-multiple active QRs down to the single newest.
--    (Defensive: production data may already contain duplicates.)
update public.qr_sessions qs
set is_active = false
where is_active = true
  and id <> (
    select id from public.qr_sessions
    where is_active = true
    order by created_at desc
    limit 1
  );

-- 2. Enforce "exactly one active QR" at the DB level via a partial unique
--    index. This is the source-of-truth guard for single-use rotation.
create unique index if not exists idx_qr_sessions_one_active
  on public.qr_sessions (is_active)
  where is_active;

-- Convenience handle reused by the rotation RPCs.
-- pg_advisory_xact_lock is transaction-scoped, so the lock is released
-- automatically at commit/rollback. Using a stable hash avoids collisions
-- with unrelated advisory locks in the same database.
-- =============================================
-- RPC: process_attendance (serialize + keep auto-rotation)
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
  -- Serialize all attendance processing so two members scanning the same
  -- token cannot race past the `for update` check.
  perform pg_advisory_xact_lock(hashtext('absensi_kkn_qr_active_lock')::bigint);

  v_today := (now() at time zone 'Asia/Jakarta')::date;

  -- Account must be an active ANGGOTA (no approval gate).
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

  -- One attendance per member per day.
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

  -- Lock + consume the presented token (single-use enforcement).
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

  -- KKN period window check.
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

  -- Mark this token consumed (invalidates the scanned QR immediately).
  update public.qr_sessions
  set is_active = false,
      used_by = p_user_id,
      used_at = v_check_in_at
  where id = v_qr_record.id;

  -- Record attendance.
  insert into public.attendances (
    user_id, attendance_date, check_in_at, status,
    latitude, longitude, location_accuracy, device_info
  ) values (
    p_user_id, v_today, v_check_in_at, v_attendance_status,
    p_latitude, p_longitude, p_location_accuracy, p_device_info
  )
  returning * into v_attendance;

  -- Auto-generate the next single-use QR.
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
-- RPC: get_active_qr (serialize; invalidate expired; auto-create)
-- =============================================
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
begin
  -- Serialize so two concurrent calls cannot each create a new QR.
  perform pg_advisory_xact_lock(hashtext('absensi_kkn_qr_active_lock')::bigint);

  -- Invalidate any QR that has silently slipped past its expiry window.
  update public.qr_sessions
  set is_active = false
  where is_active = true
    and expires_at <= now()
    and used_by is null;

  -- Return the currently valid active QR.
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
  end if;

  -- No valid active QR: rotate a fresh single-use token.
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
$$;

-- =============================================
-- RPC: admin_generate_qr (serialize; single active; admin-only)
-- =============================================
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
  v_is_admin boolean;
begin
  -- Only the ADMIN role may rotate the QR. Verified inside the function so
  -- the check cannot be bypassed by calling RPC from a member account.
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

  -- Deactivate every existing QR before creating the next single-use one.
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

-- Force PostgREST to reload its schema cache so the recreated RPCs are
-- immediately callable (avoids transient 404 on rpc/<function>).
notify pgrst, 'reload schema';

-- Re-assert execute grants. CREATE OR REPLACE preserves existing grants,
-- but this also covers the case where the functions were missing entirely
-- (the 404 you see when PostgREST can't resolve the RPC).
grant execute on function public.process_attendance(uuid, text, double precision, double precision, double precision, text) to authenticated;
grant execute on function public.get_active_qr() to authenticated;
grant execute on function public.admin_generate_qr(uuid) to authenticated;
revoke execute on function public.process_attendance(uuid, text, double precision, double precision, double precision, text) from public;
revoke execute on function public.get_active_qr() from public;
revoke execute on function public.admin_generate_qr(uuid) from public;
