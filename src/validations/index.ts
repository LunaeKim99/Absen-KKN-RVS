import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  nim: z.string().min(8, 'NIM minimal 8 karakter').max(20, 'NIM maksimal 20 karakter').regex(/^\d+$/, 'NIM harus berupa angka'),
  faculty: z.string().min(1, 'Fakultas wajib diisi'),
  major: z.string().min(1, 'Jurusan wajib diisi'),
  email: z.string().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Konfirmasi password tidak cocok',
  path: ['confirmPassword'],
});

export const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter').optional(),
  faculty: z.string().min(1, 'Fakultas wajib diisi').optional(),
  major: z.string().min(1, 'Jurusan wajib diisi').optional(),
  email: z.string().email('Format email tidak valid').optional(),
});

export const adminApproveSchema = z.object({
  userId: z.string().uuid('ID tidak valid'),
  notes: z.string().optional(),
});

export const adminRejectSchema = z.object({
  userId: z.string().uuid('ID tidak valid'),
  notes: z.string().min(1, 'Alasan penolakan wajib diisi'),
});

export const adminSuspendSchema = z.object({
  userId: z.string().uuid('ID tidak valid'),
  notes: z.string().optional(),
});

export const adminToggleActiveSchema = z.object({
  userId: z.string().uuid('ID tidak valid'),
  isActive: z.boolean(),
});

export const attendanceStatusUpdateSchema = z.object({
  attendanceId: z.string().uuid('ID tidak valid'),
  status: z.enum(['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPA']),
  notes: z.string().optional(),
});

export const qrScanSchema = z.object({
  token: z.string().min(1, 'Token QR tidak valid'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationAccuracy: z.number().optional(),
  deviceInfo: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type AdminApproveInput = z.infer<typeof adminApproveSchema>;
export type AdminRejectInput = z.infer<typeof adminRejectSchema>;
export type AdminSuspendInput = z.infer<typeof adminSuspendSchema>;
export type AdminToggleActiveInput = z.infer<typeof adminToggleActiveSchema>;
export type AttendanceStatusUpdateInput = z.infer<typeof attendanceStatusUpdateSchema>;
export type QrScanInput = z.infer<typeof qrScanSchema>;