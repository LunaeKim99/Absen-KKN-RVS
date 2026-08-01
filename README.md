# Absensi KKN

Aplikasi web absensi untuk mahasiswa KKN (Kuliah Kerja Nyata) yang dibangun dengan React 19, TypeScript, Vite, dan Supabase. Mendukung absensi berbasis QR code dengan rotasi token otomatis, manajemen pengguna admin, dan dashboard statistik real-time.

**Periode KKN:** 27 Juli 2026 – 6 September 2026 (durasi 42 hari)  
**Timezone:** Asia/Jakarta (WIB, UTC+7)

---

## Fitur Utama

- **Absensi QR Code** — Mahasiswa scan QR untuk absen; QR **single-use**, token lama langsung dinonaktifkan setelah dipakai, token baru digenerate otomatis.
- **Rotasi QR Otomatis** — QR expired (60 detik) otomatis diganti tanpa intervensi admin; race condition dicegah dengan advisory lock + partial unique index.
- **Status Kehadiran** — HADIR, TERLAMBAT, IZIN, SAKIT, ALPA dengan validasi sisi server.
- **Manajemen Pengguna** — Admin bisa approve/reject/suspend akun mahasiswa; pendaftaran via Supabase Auth.
- **Dashboard Admin** — Statistik kehadiran harian, daftar anggota, log aktivitas.
- **Profil Mahasiswa** — NIM, nama, fakultas, jurusan, status persetujuan.
- **Riwayat Absensi** — Lihat riwayat kehadiran pribadi per tanggal.
- **Dark Mode** — Dukungan penuh tema gelap/terang, simpan preferensi (localStorage), ikuti preferensi OS.
- **Row Level Security (RLS)** — Data terisolasi per pengguna; admin akses penuh via policy.
- **Responsive UI** — Mobile-first dengan Tailwind CSS v4 (sidebar overlay, tabel → card list di layar kecil).

---

## Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 8, React Router 7 |
| Styling | Tailwind CSS v4 (CSS-first), clsx, tailwind-merge |
| State & Data | TanStack Query v5, Zod v4 |
| Backend (BaaS) | Supabase (PostgreSQL, Auth, Realtime, Edge Functions, RPC) |
| QR Code | html5-qrcode (scanner), qrcode (generator) |
| Date/Time | date-fns v4, date-fns-tz v3 (WIB handling) |
| Testing | Vitest 4, happy-dom, @testing-library/react |
| Lint/Format | ESLint 10, TypeScript ESLint, React Compiler |
| Deploy | Vercel (static output) |

---

## Instalasi

```bash
# Clone repository
git clone <repo-url>
cd absensi-kkn

# Install dependencies
npm install
```

---

## Konfigurasi Environment

Salin file contoh dan isi nilai asli dari project Supabase:

```bash
cp .env.example .env
```

| Variabel | Deskripsi |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL project Supabase (mis. `https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon/public key Supabase (safe untuk frontend) |
| `VITE_APP_NAME` | Nama aplikasi (default: `Absensi KKN`) |
| `VITE_APP_ENV` | Environment: `development` \| `production` |

> **Catatan:** Jangan pernah memasukkan `service_role_key` ke frontend. Hanya gunakan `anon` key.

---

## Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor** di dashboard Supabase.
3. Jalankan migration secara berurutan (dari yang paling awal):
   ```bash
   # Atau jalankan file SQL satu per satu dari SQL Editor (copy-paste → Run):
   supabase/migrations/20260731090750_new-migration.sql
   supabase/migrations/20260731104125_fix_rpc_security_definer.sql
   supabase/migrations/20260731105218_auto_approve_signup_and_remove_attendance_gate.sql
   supabase/migrations/20260731120000_fix_qr_single_use_rotation_and_races.sql
   supabase/migrations/20260731121000_activate_pgcrypto_and_harden_qr_rpcs.sql   ← TERAKHIR
   ```
   - **`pgcrypto`** diaktifkan di migration terakhir → `gen_random_bytes()` tersedia.
   - **Partial unique index** `idx_qr_sessions_one_active` → hanya ada 1 QR aktif di database.
   - **Advisory lock** di semua RPC → mencegah race condition.
   - **RPC function** (error-safe): `process_attendance`, `get_active_qr`, `admin_generate_qr`, `admin_approve_user`, `admin_reject_user`, `admin_suspend_user`, `admin_toggle_user_active`, `admin_get_today_stats`.
4. Di **Authentication → Providers**, aktifkan **Email/Password**.
5. Buat akun admin dengan menjalankan `supabase/seed.sql` (ganti email dengan email admin Anda).
6. Catat `Project URL` dan `anon/public key` → isi ke file `.env`.

---

## Menjalankan Development

```bash
npm run dev
```

Akses di `http://localhost:5173` (default Vite).

---

## Build Production

```bash
npm run build
```

Output berada di folder `dist/` (sudah dikonfigurasi di `vercel.json`). Preview lokal:

```bash
npm run preview
```

---

## Deployment ke Vercel

1. Push repository ke GitHub/GitLab/Bitbucket.
2. Buka [vercel.com](https://vercel.com) → **Add New Project** → Import repository.
3. Framework preset: **Vite** (auto-detect).
4. Set **Environment Variables** dari file `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_APP_NAME`
   - `VITE_APP_ENV` = `production`
5. Deploy. Vercel akan menjalankan `npm run build` dan menyajikan folder `dist/`.
6. `vercel.json` sudah mengatur header keamanan: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`.

---

## Struktur Proyek

```
absensi-kkn/
├── public/                 # Static assets (favicon, icons)
├── supabase/
│   ├── schema.sql          # Full DB schema + RPC + RLS (baseline)
│   └── migrations/         # Migrations incremental (urutan waktu)
│       ├── 20260731090750_new-migration.sql
│       ├── 20260731104125_fix_rpc_security_definer.sql
│       ├── 20260731105218_auto_approve_signup_and_remove_attendance_gate.sql
│       ├── 20260731120000_fix_qr_single_use_rotation_and_races.sql
│       └── 20260731121000_activate_pgcrypto_and_harden_qr_rpcs.sql
├── src/
│   ├── components/         # Shared UI + layout (Button, Input, Card, Modal, layouts)
│   │   ├── layout/         # AdminLayout, MemberLayout, AuthLayout, ProtectedRoute
│   │   └── ui/             # Card, Button, Input, Modal, Toast, StatusBadge, dll
│   ├── config/
│   │   └── kkn.ts          # KKN period constants (dates, duration, timezone)
│   ├── features/           # Feature-based modules
│   │   ├── admin/          # hooks/ + pages/ (dashboard, anggota, QR, absensi, laporan, kalender)
│   │   ├── auth/           # Login, register, session handling
│   │   └── member/         # Dashboard, ScanPage, Riwayat, Profil
│   ├── hooks/              # Custom hooks (useAuth, useTheme, dll)
│   ├── lib/
│   │   ├── kkn-utils.ts    # KKN date utilities (getKknDayNumber, isKknActiveNow, dll)
│   │   ├── qrGenerator.ts  # qrcode wrapper (toDataURL / toCanvas)
│   │   ├── supabase.ts     # Supabase client (browser)
│   │   ├── utils.ts        # General helpers (cn/clsx, formatters)
│   │   └── exportUtils.ts  # Excel export helper
│   ├── types/              # TypeScript types (database, RPC, domain)
│   ├── validations/        # Zod schemas (login, register, profile)
│   ├── App.tsx             # Root component + routing
│   ├── main.tsx            # Entry point
│   └── index.css           # Tailwind v4 import + global styles
├── tests/                  # Vitest unit tests
│   └── kkn-utils.test.ts
├── .env.example
├── vercel.json             # SPA rewrite + security headers + cache
├── vitest.config.ts
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Alur QR Absensi (Single-Use + Auto-Rotate)

1. **Admin buka `/admin/qr`** → `useActiveQr` query `qr_sessions` yang `is_active = true` dan belum expired.
   - Jika tidak ada QR valid → panggil RPC `get_active_qr` → membuat token baru otomatis.
   - Polling 3 detik + realtime channel sebagai fallback sync.
2. **QR tampil** di canvas dengan countdown 60 detik.
3. **Mahasiswa scan** → `process_attendance(p_user_id, p_token, p_device_info)`:
   - Validasi anggota aktif + belum absen hari ini (WIB).
   - **Lock token** (`SELECT ... FOR UPDATE`) → single-use enforcement.
   - Validasi periode KKN aktif.
   - Set `is_active = false`, isi `used_by`, `used_at`.
   - Simpan `attendances`.
   - **Generate QR baru** (`gen_random_bytes(32)`) langsung di transaksi yang sama.
4. **Admin polling berikutnya** (≤3 detik) → mendapatkan token QR baru → canvas otomatis refresh.
5. **QR expired** (60 detik tanpa scan) → `get_active_qr` menginvalidate + bikin baru otomatis.

### Anti Race Condition
- `pg_advisory_xact_lock(hashtext('absensi_kkn_qr_active_lock'))` di semua RPC QR → hanya satu rotasi/proses dalam satu waktu.
- Partial unique index `idx_qr_sessions_one_active` → hanya satu QR aktif di DB.
- Dua mahasiswa scan bersamaan → satu sukses, satu dapat `"QR tidak valid atau sudah kedaluwarsa"`.

---

## Catatan Keamanan

- **RLS Aktif** — Semua tabel memiliki `enable row level security` dengan policy:
  - `profiles`: Admin lihat semua; user lihat/edit milik sendiri; insert via trigger signup.
  - `attendances`: Admin lihat semua; user lihat milik sendiri.
  - `qr_sessions`: Hanya admin yang bisa baca.
  - `activity_logs`: Admin lihat semua; user lihat milik sendiri.
  - `kkn_periods`: Bisa dibaca semua authenticated user.
- **Service Role Key** — Tidak pernah digunakan di frontend. Operasi sensitif (rotasi QR, approve user, stats) dilakukan via **PostgreSQL RPC** (`security definer`) di sisi database.
- **Validasi Sisi Server** — Semua mutasi lewat RPC: cek role, approval_status, periode KKN aktif, QR valid & belum expired, duplicate attendance prevention.
- **Token QR Rotasi** — Token baru digenerate otomatis (`gen_random_bytes(32)` via `pgcrypto`) setiap absensi sukses; token lama dinonaktifkan; partial unique index menjamin single-active.
- **Race Condition** — Advisory lock (`pg_advisory_xact_lock`) di `process_attendance`, `get_active_qr`, `admin_generate_qr`.
- **Error-safe RPC** — Semua RPC menangkap exception dan mengembalikan `{ success: false, error }` alih-alih crash.
- **Headers Keamanan** — Dikonfigurasi via `vercel.json` untuk production.

---

## Troubleshooting

### QR tidak muncul / RPC 404 di browser console

Error `POST .../rpc/get_active_qr 404` atau `No API key found in request` berarti function belum ada / tidak dikenal PostgREST.

1. Pastikan semua migration dijalankan berurutan (lihat **Setup Supabase**).
2. Pastikan extension `pgcrypto` aktif:
   ```sql
   create extension if not exists pgcrypto;
   select extname from pg_extension where extname = 'pgcrypto';
   ```
3. Pastikan RPC ada di schema `public`:
   ```sql
   select proname, pg_get_function_arguments(oid)
   from pg_proc
   where pronamespace = 'public'::regnamespace
   and proname in ('get_active_qr','admin_generate_qr','process_attendance');
   ```
4. Refresh schema cache PostgREST (sudah otomatis via `notify pgrst, 'reload schema'` di migration, tapi bisa diulang manual):
   ```sql
   notify pgrst, 'reload schema';
   ```
5. Redeploy Vercel (env vars di-bundle saat build — set `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` lalu redeploy).

### `gen_random_bytes` error (SQLSTATE 42883)

`gen_random_bytes()` butuh extension `pgcrypto`. Jalankan:
```sql
create extension if not exists pgcrypto;
```

### UI muncul tapi data kosong / polling terus

- Cek koneksi Supabase di Vercel → Environment Variables.
- Cek role akun login (harus `ADMIN` untuk `/admin/*`).
- Cek periode KKN aktif di tabel `kkn_periods`.

---

## Lisensi

MIT License — bebas digunakan, dimodifikasi, dan didistribusikan.

---

*Dibangun untuk KKN 2026 — Periode 27 Juli 2026 s.d. 6 September 2026 (42 hari).*