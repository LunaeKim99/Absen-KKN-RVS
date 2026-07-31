import { useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Calendar,
  TrendingUp,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Activity,
} from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { useAdminStats } from '@/features/admin/hooks/useAdminStats';
import { useAllAttendance } from '@/features/admin/hooks/useAllAttendance';
import { usePendaftaran } from '@/features/admin/hooks/usePendaftaran';
import {
  getKknDayInfo,
  isKknActiveNow,
  formatKknDate,
} from '@/lib/kkn-utils';
import { KKN_CONFIG } from '@/config/kkn';
import type { ApprovalStatus } from '@/types/database';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

const STATUS_ICON: Record<ApprovalStatus, React.ReactNode> = {
  PENDING: <Clock className="h-4 w-4" />,
  APPROVED: <CheckCircle2 className="h-4 w-4" />,
  REJECTED: <XCircle className="h-4 w-4" />,
  SUSPENDED: <MinusCircle className="h-4 w-4" />,
};

const STAT_CARD_CLASSES: Record<string, string> = {
  total: 'bg-green-50 text-green-700 border-green-200',
  hadir: 'bg-blue-50 text-blue-700 border-blue-200',
  belum_hadir: 'bg-red-50 text-red-700 border-red-200',
  terlambat: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: attendances, isLoading: attendancesLoading } = useAllAttendance();
  const { data: registrations, isLoading: registrationsLoading } = usePendaftaran();

  const kkn = useMemo(() => getKknDayInfo(), []);

  const recentAttendance = useMemo(() => {
    if (!attendances) return [];
    return attendances.slice(0, 5);
  }, [attendances]);

  const recentRegistrations = useMemo(() => {
    if (!registrations) return [];
    return registrations.slice(0, 5);
  }, [registrations]);

  const isLoading = statsLoading || attendancesLoading || registrationsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard Admin" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard Admin" />

      {/* Attendance Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Anggota"
          value={stats?.total_members ?? 0}
          icon={<Users className="h-5 w-5" />}
          className={STAT_CARD_CLASSES.total}
        />
        <StatCard
          label="Hadir Hari Ini"
          value={stats?.hadir ?? 0}
          icon={<UserCheck className="h-5 w-5" />}
          className={STAT_CARD_CLASSES.hadir}
        />
        <StatCard
          label="Belum Hadir"
          value={stats?.alpa ?? 0}
          icon={<UserX className="h-5 w-5" />}
          className={STAT_CARD_CLASSES.belum_hadir}
        />
        <StatCard
          label="Terlambat"
          value={stats?.terlambat ?? 0}
          icon={<Clock className="h-5 w-5" />}
          className={STAT_CARD_CLASSES.terlambat}
        />
      </div>

      {/* Account Stats Row */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-600" />
            Status Akun Anggota
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <AccountStat label="Total Terdaftar" value={stats?.total_registered ?? 0} />
            <AccountStat
              label="PENDING"
              value={stats?.total_pending ?? 0}
              status="PENDING"
            />
            <AccountStat
              label="APPROVED"
              value={stats?.total_approved ?? 0}
              status="APPROVED"
            />
            <AccountStat
              label="REJECTED"
              value={stats?.total_rejected ?? 0}
              status="REJECTED"
            />
            <AccountStat
              label="SUSPENDED"
              value={stats?.total_suspended ?? 0}
              status="SUSPENDED"
            />
          </div>
        </CardContent>
      </Card>

      {/* KKN Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            Progres KKN
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Hari ke-</p>
              <p className="text-2xl font-bold text-gray-900">
                {kkn.isWithinPeriod ? kkn.dayNumber : '-'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Sisa Hari</p>
              <p className="text-2xl font-bold text-gray-900">
                {kkn.remainingDays > 0 ? kkn.remainingDays : 0}
              </p>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-3 rounded-full bg-green-600 transition-all duration-300"
              style={{ width: `${Math.min(kkn.progressPercentage, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{formatKknDate(kkn.startDate)}</span>
            <StatusBadge.AttendanceStatusBadge status={isKknActiveNow() ? 'HADIR' : 'ALPA'} />
            <span>{formatKknDate(kkn.endDate)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Recent Attendance & Registrations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Absensi Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAttendance.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">Belum ada absensi</p>
            ) : (
              <div className="space-y-3">
                {recentAttendance.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {a.profiles?.name ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {a.attendance_date} &middot;{' '}
                        {formatInTimeZone(a.check_in_at, KKN_CONFIG.TIMEZONE, 'HH:mm')} WIB
                      </p>
                    </div>
                    <StatusBadge.AttendanceStatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Registrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              Pendaftaran Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentRegistrations.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">Belum ada pendaftaran</p>
            ) : (
              <div className="space-y-3">
                {recentRegistrations.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.nim}</p>
                    </div>
                    <StatusBadge.ApprovalStatusBadge status={r.approval_status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  className: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function AccountStat({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status?: ApprovalStatus;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="flex items-center gap-2">
        {status && STATUS_ICON[status]}
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      {status && (
        <div className="mt-1">
          <StatusBadge.ApprovalStatusBadge status={status} />
        </div>
      )}
    </div>
  );
}
