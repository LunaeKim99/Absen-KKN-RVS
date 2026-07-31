export type UserRole = 'ADMIN' | 'ANGGOTA';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type AttendanceStatus = 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPA';

export interface Profile {
  id: string;
  name: string;
  nim: string;
  email: string;
  faculty: string;
  major: string;
  role: UserRole;
  approval_status: ApprovalStatus;
  approval_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  is_active: boolean;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  attendance_date: string;
  check_in_at: string;
  status: AttendanceStatus;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  device_info: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface QrSession {
  id: string;
  token: string;
  is_active: boolean;
  expires_at: string;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

export interface KknPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminTodayStats {
  total_members: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
  total_approved: number;
  total_pending: number;
  total_rejected: number;
  total_suspended: number;
  total_registered: number;
  today: string;
}

export interface AttendanceWithProfile extends Attendance {
  profiles: Profile;
}

export interface PendingRegistration {
  id: string;
  name: string;
  nim: string;
  email: string;
  faculty: string;
  major: string;
  created_at: string;
  approval_status: ApprovalStatus;
}

export interface MemberSummary {
  total_hadir: number;
  total_terlambat: number;
  total_izin: number;
  total_sakit: number;
  total_alpa: number;
  attendance_percentage: number;
}

export interface ExportData {
  attendances: Attendance[];
  members: Profile[];
  periodStart: string;
  periodEnd: string;
}

export interface QrScanResult {
  success: boolean;
  attendance?: {
    id: string;
    status: AttendanceStatus;
    check_in_at: string;
    date: string;
  };
  new_qr_token?: string;
  new_qr_id?: string;
  error?: string;
}

export interface ActiveQrResponse {
  success: boolean;
  qr?: {
    id: string;
    token: string;
    expires_at: string;
  };
  error?: string;
}

export interface AdminQrResponse extends ActiveQrResponse {
  used_by_name?: string;
  used_at?: string;
}