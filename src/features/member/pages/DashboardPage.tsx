import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Clock,
  QrCode,
  UserX,
  Timer,
} from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuth } from '@/hooks/useAuth';
import { useAttendanceToday } from '@/features/member/hooks/useAttendanceToday';
import { useAttendanceHistory } from '@/features/member/hooks/useAttendanceHistory';
import {
  formatKknDate,
  getKknDayInfo,
  isKknActiveNow,
} from '@/lib/kkn-utils';
import { KKN_CONFIG } from '@/config/kkn';
import type { AttendanceStatus } from '@/types/database';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingScreen } from '@/components/ui/Spinner';

const HISTORY_STATS: { key: AttendanceStatus; label: string; className: string }[] = [
  { key: 'HADIR', label: 'Hadir', className: 'text-green-600 dark:text-green-400' },
  { key: 'TERLAMBAT', label: 'Terlambat', className: 'text-amber-600 dark:text-amber-400' },
  { key: 'IZIN', label: 'Izin', className: 'text-blue-600 dark:text-blue-400' },
  { key: 'SAKIT', label: 'Sakit', className: 'text-orange-600 dark:text-orange-400' },
  { key: 'ALPA', label: 'Alpa', className: 'text-red-600 dark:text-red-400' },
];

const KKN_STATUS_TEXT: Record<string, string> = {
  BELUM_DIMULAI: 'Belum dimulai',
  BERLANGSUNG: 'Berlangsung',
  SELESAI: 'Selesai',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading, signOut } = useAuth();
  const { data: attendanceToday } = useAttendanceToday(user?.id ?? '');
  const { summary, isLoading: historyLoading } = useAttendanceHistory(
    user?.id ?? '',
  );

  const kkn = useMemo(() => getKknDayInfo(), []);

  const firstName = useMemo(() => {
    const fullName = profile?.name?.trim() ?? 'Anggota';
    return fullName.split(' ')[0];
  }, [profile]);

  const isSuspended = !profile || profile.is_active === false;

  if (authLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Halo, {firstName}!
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {profile?.name ?? 'Anggota KKN'} &middot; Anggota
        </p>
      </div>

      {isSuspended && profile && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <CardContent className="flex items-start gap-3 pt-5">
            <UserX className="mt-0.5 h-6 w-6 shrink-0 text-red-600 dark:text-red-400" />
            <div className="space-y-1">
              <p className="font-semibold text-red-900 dark:text-red-300">
                Akun Anda telah ditangguhkan
              </p>
              <p className="text-sm text-red-800 dark:text-red-400">
                Hubungi admin untuk informasi lebih lanjut.
              </p>
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-2 text-sm font-medium text-red-900 underline underline-offset-2 dark:text-red-300"
              >
                Keluar dari akun
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance status today */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
            Status Absensi Hari Ini
          </CardTitle>
          <CardDescription>{formatKknDate(kkn.today)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {attendanceToday ? (
            <div className="flex items-center justify-between rounded-xl bg-green-50 p-4 dark:bg-green-900/20">
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">Sudah Hadir</p>
                <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                  Jam check-in:{' '}
                  {formatInTimeZone(
                    attendanceToday.check_in_at,
                    KKN_CONFIG.TIMEZONE,
                    'HH:mm',
                  )}{' '}
                  WIB
                </p>
              </div>
              <StatusBadge.AttendanceStatusBadge status={attendanceToday.status} />
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 p-4 text-center dark:bg-gray-800/50">
              <p className="font-medium text-gray-700 dark:text-gray-300">Belum Absen</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Scan QR dari layar admin untuk melakukan absensi hari ini.
              </p>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!isKknActiveNow()}
            onClick={() => navigate('/scan')}
          >
            <QrCode className="h-5 w-5" />
            Scan QR
          </Button>
          {!isKknActiveNow() && (
            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
              {kkn.status === 'BELUM_DIMULAI'
                ? 'Absensi belum dibuka.'
                : 'Masa absensi KKN telah berakhir.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* History summary */}
      {!historyLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-green-600 dark:text-green-400" />
              Ringkasan Riwayat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {HISTORY_STATS.map((stat) => (
                <div
                  key={stat.key}
                  className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800/50"
                >
                  <p className={`text-lg font-bold ${stat.className}`}>
                    {summary[stat.key]}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KKN period info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-green-600 dark:text-green-400" />
            Info Periode KKN
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                kkn.status === 'BERLANGSUNG'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : kkn.status === 'SELESAI'
                    ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              }`}
            >
              {KKN_STATUS_TEXT[kkn.status]}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Mulai</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {formatKknDate(kkn.startDate)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Selesai</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {formatKknDate(kkn.endDate)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Durasi</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {kkn.durationDays} hari
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Hari ke-</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {kkn.isWithinPeriod ? kkn.dayNumber : '-'}
              </p>
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Progress</span>
              <span>
                {kkn.remainingDays > 0
                  ? `Sisa ${kkn.remainingDays} hari`
                  : kkn.status === 'SELESAI'
                    ? 'Selesai'
                    : 'Belum dimulai'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-2 rounded-full bg-green-600"
                style={{ width: `${kkn.progressPercentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
