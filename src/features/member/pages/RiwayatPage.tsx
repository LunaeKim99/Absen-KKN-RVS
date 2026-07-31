import { useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  Filter,
} from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuth } from '@/hooks/useAuth';
import { useAttendanceHistory } from '@/features/member/hooks/useAttendanceHistory';
import { KKN_CONFIG } from '@/config/kkn';
import type { AttendanceStatus } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

type AttendanceRow = {
  id: string;
  attendance_date: string;
  check_in_at: string;
  status: AttendanceStatus;
};

const STATUS_STATS: { key: AttendanceStatus; label: string; className: string }[] = [
  { key: 'HADIR', label: 'Hadir', className: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  { key: 'TERLAMBAT', label: 'Terlambat', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  { key: 'IZIN', label: 'Izin', className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  { key: 'SAKIT', label: 'Sakit', className: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' },
  { key: 'ALPA', label: 'Alpa', className: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
];

export default function RiwayatPage() {
  const { user } = useAuth();
  const { attendances, summary, isLoading } = useAttendanceHistory(user?.id ?? '');

  const [dateRange, setDateRange] = useState<{
    from: string;
    to: string;
  }>({
    from: KKN_CONFIG.START_DATE,
    to: KKN_CONFIG.END_DATE,
  });

  const filtered = useMemo(() => {
    return attendances.filter((a: AttendanceRow) => {
      const withinFrom = !dateRange.from || a.attendance_date >= dateRange.from;
      const withinTo = !dateRange.to || a.attendance_date <= dateRange.to;
      return withinFrom && withinTo;
    });
  }, [attendances, dateRange]);

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setDateRange((p) => ({ ...p, from: e.target.value }));
  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setDateRange((p) => ({ ...p, to: e.target.value }));

  return (
    <div className="space-y-6">
      <PageHeader title="Riwayat Absensi" />

      {/* Summary stat cards */}
      <div className="grid grid-cols-5 gap-2">
        {STATUS_STATS.map((stat) => (
          <Card key={stat.key}>
            <CardContent className="pt-4 text-center">
              <p className={`text-xl font-bold ${stat.className.replace('bg-', 'text-')}`}>
                {summary[stat.key]}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Date range filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filter Periode
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="date-from"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Dari
            </label>
            <input
              id="date-from"
              type="date"
              min={KKN_CONFIG.START_DATE}
              max={KKN_CONFIG.END_DATE}
              value={dateRange.from}
              onChange={handleFromChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex-1">
            <label
              htmlFor="date-to"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Sampai
            </label>
            <input
              id="date-to"
              type="date"
              min={KKN_CONFIG.START_DATE}
              max={KKN_CONFIG.END_DATE}
              value={dateRange.to}
              onChange={handleToChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </CardContent>
      </Card>

      {/* History list / table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Tidak ada riwayat absensi"
          description="Belum ada data absensi pada periode yang dipilih."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden w-full overflow-x-auto rounded-xl border border-gray-200 md:block dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">
                    Tanggal
                  </th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">
                    Jam (WIB)
                  </th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a: AttendanceRow) => (
                  <tr
                    key={a.id}
                    className="border-t border-gray-100 last:border-b-0 dark:border-gray-800"
                  >
                    <td className="px-4 py-2.5">
                      {formatInTimeZone(
                        a.attendance_date,
                        KKN_CONFIG.TIMEZONE,
                        'dd-MM-yyyy',
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {formatInTimeZone(
                        a.check_in_at,
                        KKN_CONFIG.TIMEZONE,
                        'HH:mm',
                      )}{' '}
                      WIB
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge.AttendanceStatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="space-y-3 md:hidden">
            {filtered.map((a: AttendanceRow) => (
              <Card key={a.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatInTimeZone(
                          a.attendance_date,
                          KKN_CONFIG.TIMEZONE,
                          'dd-MM-yyyy',
                        )}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatInTimeZone(
                            a.check_in_at,
                            KKN_CONFIG.TIMEZONE,
                            'HH:mm',
                          )}{' '}
                          WIB
                        </span>
                      </div>
                    </div>
                  </div>
                  <StatusBadge.AttendanceStatusBadge status={a.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
