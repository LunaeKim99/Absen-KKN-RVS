/* eslint-disable react-refresh/only-export-components */
import { type HTMLAttributes } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { ApprovalStatus, AttendanceStatus } from '@/types/database';

const approvalLabels: Record<ApprovalStatus, string> = {
  PENDING: 'Menunggu Persetujuan',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  SUSPENDED: 'Ditangguhkan',
};

const attendanceLabels: Record<AttendanceStatus, string> = {
  HADIR: 'Hadir',
  TERLAMBAT: 'Terlambat',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  ALPA: 'Alpa',
};

const approvalVariant: Record<ApprovalStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUSPENDED: 'neutral',
};

const attendanceVariant: Record<AttendanceStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  HADIR: 'success',
  TERLAMBAT: 'warning',
  IZIN: 'info',
  SAKIT: 'warning',
  ALPA: 'danger',
};

function ApprovalStatusBadge({ status, className, ...props }: HTMLAttributes<HTMLSpanElement> & { status: ApprovalStatus }) {
  return (
    <Badge variant={approvalVariant[status]} className={className} {...props as React.HTMLAttributes<HTMLSpanElement>}>
      {approvalLabels[status]}
    </Badge>
  );
}

function AttendanceStatusBadge({ status, className, ...props }: HTMLAttributes<HTMLSpanElement> & { status: AttendanceStatus }) {
  return (
    <Badge variant={attendanceVariant[status]} className={className} {...props as React.HTMLAttributes<HTMLSpanElement>}>
      {attendanceLabels[status]}
    </Badge>
  );
}

export const StatusBadge = {
  ApprovalStatusBadge,
  AttendanceStatusBadge,
};
