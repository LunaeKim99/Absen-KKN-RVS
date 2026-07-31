-- =============================================
-- Absensi KKN - Seed Data (Admin Only)
-- =============================================
-- Jalankan SETELAH schema.sql
--
-- NOTE: Anggota wajib mendaftar sendiri via /register.
-- Admin dibuat lewat seed ini (auth.users + profiles + role ADMIN).
-- =============================================

-- =============================================
-- 1. CREATE ADMIN ACCOUNT (Supabase Auth)
-- =============================================
-- Ganti email & password sesuai keinginan Anda.
DO $$
DECLARE
  admin_email   TEXT := 'admin@kkn.univ.ac.id';    -- ← GANTI EMAIL
  admin_password TEXT := 'Admin123!';          -- ← GANTI PASSWORD
  admin_uid     UUID;
  existing_id   UUID;
BEGIN
  -- Cek apakah email sudah terdaftar
  SELECT id INTO existing_id FROM auth.users WHERE email = admin_email LIMIT 1;

  IF existing_id IS NULL THEN
    -- Buat user di auth.users
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(), -- langsung dikonfirmasi
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('name', 'Admin KKN', 'faculty', 'Administrasi', 'major', 'Sistem Informasi'),
      now(), now(),
      '', '', '', ''
    )
    RETURNING id INTO admin_uid;

    RAISE NOTICE 'Admin auth user dibuat: % (%)', admin_email, admin_uid;
  ELSE
    admin_uid := existing_id;
    RAISE NOTICE 'Admin auth user sudah ada, pakai UID: %', admin_uid;
  END IF;

  -- =============================================
  -- 2. UPDATE PROFILE -> ADMIN (trigger set ANGGOTA)
  -- =============================================
  -- Trigger on_auth_user_created menaruh role ANGGOTA.
  -- Di sini di-override menjadi ADMIN + APPROVED.
  UPDATE public.profiles
  SET role            = 'ADMIN',
      approval_status = 'APPROVED',
      is_active       = true,
      faculty         = 'Administrasi',
      major           = 'Sistem Informasi'
  WHERE id = admin_uid;

  RAISE NOTICE 'Profile admin diupdate untuk email: %', admin_email;
END $$;

-- =============================================
-- 3. KKN PERIOD (default)
-- =============================================
INSERT INTO public.kkn_periods (name, start_date, end_date, duration_days, is_active)
VALUES ('KKN 2026', '2026-07-27', '2026-09-06', 42, true)
ON CONFLICT DO NOTHING;

-- =============================================
-- VERIFIKASI
-- =============================================
SELECT id, email, role, approval_status, is_active, name
FROM public.profiles
WHERE role = 'ADMIN';

SELECT count(*) AS total_anggota,
       count(*) FILTER (WHERE approval_status = 'PENDING')  AS pending,
       count(*) FILTER (WHERE approval_status = 'APPROVED') AS approved
FROM public.profiles
WHERE role = 'ANGGOTA';