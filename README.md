# Absensi KKN

Aplikasi web absensi untuk mahasiswa KKN (Kuliah Kerja Nyata) yang dibangun dengan React 19, TypeScript, Vite, dan Supabase. Mendukung absensi berbasis QR code dengan rotasi token otomatis, manajemen pengguna admin, dan dashboard statistik real-time.

**Periode KKN:** 27 Juli 2026 – 6 September 2026 (durasi 42 hari)  
**Timezone:** Asia/Jakarta (WIB, UTC+7)

---

## Fitur Utama

- **Absensi QR Code** — Mahasiswa scan QR untuk absen; token QR berotasi otomatis setiap 60 detik demi keamanan.
- **Status Kehadiran** — HADIR, TERLAMBAT, IZIN, SAKIT, ALPA dengan validasi sisi server.
- **Manajemen Pengguna** — Admin bisa approve/reject/suspend akun mahasiswa; pendaftaran via Supabase Auth.
- **Dashboard Admin** — Statistik kehadiran harian, daftar anggota, log aktivitas.
- **Profil Mahasiswa** — NIM, nama, fakultas, jurusan, foto, status persetujuan.
- **Riwayat Absensi** — Lihat riwayat kehadiran pribadi per tanggal.
- **Row Level Security (RLS)** — Data terisolasi per pengguna; admin akses penuh via policy.
- **Responsive UI** — Mobile-first dengan Tailwind CSS v4, siap PWA.

---

## Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 8, React Router 7 |
| Styling | Tailwind CSS v4 (CSS-first), clsx, tailwind-merge |
| State & Data | TanStack Query v5, React Hook Form + Zod v4 |
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
3. Jalankan seluruh isi file `supabase/schema.sql` (copy-paste → Run).
   - Schema mencakup: tabel `profiles`, `attendances`, `qr_sessions`, `activity_logs`, `kkn_periods`.
   - Index, trigger `updated_at`, trigger auto-create profile on signup.
   - RPC functions: `process_attendance`, `get_active_qr`, `admin_generate_qr`, `admin_approve_user`, `admin_reject_user`, `admin_suspend_user`, `admin_toggle_user_active`, `admin_get_today_stats`.
   - **RLS policies** sudah dikonfigurasi di schema (aktif otomatis via `alter table ... enable row level security`).
4. Di **Authentication → Providers**, aktifkan **Email/Password**.
5. **(PENTING)** Buat akun admin dengan menjalankan `supabase/seed.sql`:
   - Ganti email di `seed.sql` dengan email admin Anda.
   - Buat user admin di **Authentication → Users** → pilih email tersebut, disable `Auto-confirm`.
   - Jalankan `seed.sql` → role otomatis dijadikan **ADMIN** (user tidak bisa self-register sebagai admin).
6. (Opsional) Atur **Site URL** dan **Redirect URLs** di Auth settings untuk production.
7. Catat `Project URL` dan `anon/public key` → isi ke file `.env`.

### Keterangan Penting tentang Registrasi

- **Anggota / mahasiswa wajib mendaftar sendiri** melalui halaman `/register`.
- **Admin TIDAK membuat akun anggota satu per satu** di database.
- Setiap anggota yang mendaftar otomatis masuk ke status **PENDING** menunggu persetujuan admin.
- Admin mengelola pendaftaran di halaman **Manajemen Pendaftaran** (`/admin/pendaftaran`).

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
├── public/                 # Static assets
├── supabase/
│   └── schema.sql          # Full DB schema + RPC + RLS
├── src/
│   ├── components/         # Shared UI components (Button, Input, Card, QRScanner, dll)
│   ├── config/
│   │   └── kkn.ts          # KKN period constants (dates, duration, timezone)
│   ├── features/           # Feature-based modules
│   │   ├── admin/          # Admin dashboard, user management, stats
│   │   ├── attendance/     # QR scanner, attendance flow, history
│   │   ├── auth/           # Login, register, session handling
│   │   └── profile/        # Profile view/edit
│   ├── hooks/              # Custom React hooks (useAuth, useAttendance, dll)
│   ├── lib/
│   │   ├── kkn-utils.ts    # KKN date utilities (getKknDayNumber, isKknActiveNow, dll)
│   │   ├── supabase/       # Supabase client (browser & server helpers)
│   │   └── utils.ts        # General helpers (clsx, formatters)
│   ├── tests/
│   │   └── kkn-utils.test.ts   # Vitest unit tests untuk KKN utilities
│   ├── types/              # TypeScript types (database, RPC, domain)
│   ├── validations/        # Zod schemas (attendance, profile, auth)
│   ├── App.tsx             # Root component + routing
│   ├── main.tsx            # Entry point
│   └── index.css           # Tailwind v4 import + global styles
├── tests/
│   └── kkn-utils.test.ts   # (alias to src/tests)
├── .env.example
├── vercel.json
├── vitest.config.ts
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Catatan Keamanan

- **RLS Aktif** — Semua tabel memiliki `enable row level security` dengan policy:
  - `profiles`: Admin lihat semua; user lihat/edit milik sendiri; insert via trigger signup.
  - `attendances`: Admin lihat semua; user lihat milik sendiri.
  - `qr_sessions`: Hanya admin yang bisa baca.
  - `activity_logs`: Admin lihat semua; user lihat milik sendiri.
  - `kkn_periods`: Bisa dibaca semua authenticated user.
- **Service Role Key** — Tidak pernah digunakan di frontend. Operasi sensitif (rotasi QR, approve user, stats) dilakukan via **PostgreSQL RPC** yang dieksekusi dengan privilege `security definer` di sisi database.
- **Validasi Sisi Server** — Semua mutasi lewat RPC: cek role, approval_status, periode KKN aktif, QR valid & belum expired, duplicate attendance prevention.
- **Token QR Rotasi** — Token baru digenerate otomatis (`gen_random_bytes(32)`) setiap absensi sukses; token lama dinonaktifkan.
- **Headers Keamanan** — Dikonfigurasi via `vercel.json` untuk production.

---

## Lisensi

MIT License — bebas digunakan, dimodifikasi, dan didistribusikan.

---

*Dibangun untuk KKN 2026 — Periode 27 Juli 2026 s.d. 6 September 2026 (42 hari).*