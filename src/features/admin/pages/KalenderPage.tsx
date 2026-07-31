import { useMemo, useState } from 'react';
import {
  Users,
  FileText,
} from 'lucide-react';
import { eachDayOfInterval, format } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { useAllAttendance } from '@/features/admin/hooks/useAllAttendance';
import { useAnggota } from '@/features/admin/hooks/useAnggota';
import {
  getKknStartDate,
  getKknEndDate,
  getKknDayNumber,
  getTodayInWIB,
} from '@/lib/kkn-utils';
import { KKN_CONFIG } from '@/config/kkn';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { AttendanceWithProfile } from '@/types/database';

const WEEKDAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function dayNameIndo(date: Date): string {
  const zoned = toZonedTime(date, KKN_CONFIG.TIMEZONE);
  return format(zoned, 'EEEE', { locale: id });
}

function formatDayDate(date: Date): string {
  return formatInTimeZone(date, KKN_CONFIG.TIMEZONE, 'dd-MM-yyyy');
}

function formatDayIso(date: Date): string {
  return formatInTimeZone(date, KKN_CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function formatTimeWib(iso: string): string {
  return formatInTimeZone(new Date(iso), KKN_CONFIG.TIMEZONE, 'HH:mm');
}

export default function KalenderPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: allAttendance = [], isLoading: attendanceLoading } = useAllAttendance();
  const { data: members = [], isLoading: membersLoading } = useAnggota();

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: getKknStartDate(),
      end: getKknEndDate(),
    });
  }, []);

  const todayIso = useMemo(
    () => formatInTimeZone(getTodayInWIB(), KKN_CONFIG.TIMEZONE, 'yyyy-MM-dd'),
    [],
  );

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, AttendanceWithProfile[]>();
    for (const a of allAttendance) {
      const iso = a.attendance_date;
      const existing = map.get(iso) ?? [];
      existing.push(a);
      map.set(iso, existing);
    }
    return map;
  }, [allAttendance]);

  const totalMembers = members.length;

  const selectedAttendances = selectedDate
    ? attendanceByDate.get(selectedDate) ?? []
    : [];

  const isLoading = attendanceLoading || membersLoading;

  const getCellStatus = (day: Date) => {
    const iso = formatDayIso(day);
    const count = attendanceByDate.get(iso)?.length ?? 0;
    const isToday = iso === todayIso;
    const isPast = iso < todayIso;
    const isFuture = iso > todayIso;
    const isIncomplete = isPast && count < totalMembers && totalMembers > 0;
    return { iso, count, isToday, isPast, isFuture, isIncomplete };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalender KKN"
        description="Ikuti perkembangan kehadiran selama masa KKN"
      />

      {/* Calendar */}
      <Card>
        <CardHeader>
          <CardTitle>
            Kalender Kehadiran ({days.length} hari)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
              {Array.from({ length: 14 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Weekday headers (desktop only) */}
              <div className="mb-3 hidden lg:grid grid-cols-7 gap-2">
                {WEEKDAY_NAMES.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
                {days.map((day, i) => {
                  const { iso, count, isToday, isFuture, isIncomplete } = getCellStatus(day);
                  const dayNum = getKknDayNumber(day);

                     return (
                    <CalendarCell
                      key={i}
                      day={day}
                      dayNum={dayNum}
                      attendanceCount={count}
                      isToday={isToday}
                      isFuture={isFuture}
                      isIncomplete={isIncomplete}
                      totalMembers={totalMembers}
                      onClick={() => setSelectedDate(iso)}
                    />
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Selected day detail */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>
              Detail Absensi — {formatDayDate(new Date(selectedDate + 'T00:00:00+07:00'))}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {selectedAttendances.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={FileText}
                  title="Belum ada absensi"
                  description={`Tidak ada data absensi untuk tanggal ${formatDayDate(new Date(selectedDate + 'T00:00:00+07:00'))}`}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">No</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Nama</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">NIM</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Jam</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAttendances.map((a, i) => (
                      <tr key={a.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {a.profiles?.name ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {a.profiles?.nim ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {formatTimeWib(a.check_in_at)} WIB
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge.AttendanceStatusBadge status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Day Detail Modal (full screen on mobile) */}
      <Modal
        open={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? `Absensi ${formatDayDate(new Date(selectedDate + 'T00:00:00+07:00'))}` : ''}
        size="lg"
      >
        {selectedDate && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {selectedAttendances.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Belum ada absensi untuk tanggal ini
              </p>
            ) : (
              selectedAttendances.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/50"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {a.profiles?.name ?? '-'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {a.profiles?.nim ?? '-'} · {formatTimeWib(a.check_in_at)} WIB
                    </p>
                  </div>
                  <StatusBadge.AttendanceStatusBadge status={a.status} />
                </div>
              ))
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function CalendarCell({
  day,
  dayNum,
  attendanceCount,
  isToday,
  isFuture,
  isIncomplete,
  totalMembers,
  onClick,
}: {
  day: Date;
  dayNum: number;
  attendanceCount: number;
  isToday: boolean;
  isFuture: boolean;
  isIncomplete: boolean;
  totalMembers: number;
  onClick: () => void;
}) {
  const dayName = dayNameIndo(day);
  const dateLabel = formatInTimeZone(day, KKN_CONFIG.TIMEZONE, 'dd');
  const monthLabel = formatInTimeZone(day, KKN_CONFIG.TIMEZONE, 'MMM');

  const baseClasses =
    'relative flex min-h-[100px] flex-col items-center justify-center rounded-lg border p-2 text-center transition-all min-w-[44px]';

  let stateClasses = 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900';
  let textClasses = 'text-gray-900 dark:text-gray-100';
  let subTextClasses = 'text-gray-500 dark:text-gray-400';

  if (isToday) {
    stateClasses = 'border-green-500 bg-green-50 ring-2 ring-green-500 dark:bg-green-900/20';
    textClasses = 'text-green-800 dark:text-green-200 font-semibold';
    subTextClasses = 'text-green-600 dark:text-green-300';
  } else if (isFuture) {
    stateClasses = 'border-gray-200 bg-gray-50 opacity-50 dark:border-gray-700 dark:bg-gray-800';
    textClasses = 'text-gray-400 dark:text-gray-500';
    subTextClasses = 'text-gray-400 dark:text-gray-500';
  } else if (isIncomplete) {
    stateClasses = 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20';
    textClasses = 'text-amber-800 dark:text-amber-200';
    subTextClasses = 'text-amber-600 dark:text-amber-300';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isFuture}
      className={`${baseClasses} ${stateClasses} ${textClasses} ${isFuture ? 'cursor-not-allowed' : 'hover:shadow-md'}`}
      aria-label={`Hari ke-${dayNum}, ${dayName} ${dateLabel} ${monthLabel}`}
    >
      <span className="text-xs font-medium uppercase">{dayName.slice(0, 3)}</span>
      <span className="text-2xl font-bold">{dateLabel}</span>
      <span className={`text-xs ${subTextClasses}`}>{monthLabel}</span>
      <span className={`text-xs ${subTextClasses}`}>ke-{dayNum}</span>

      {/* Attendance count */}
      {totalMembers > 0 && (
        <div className="mt-1 flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span className="text-xs font-medium">
            {attendanceCount}/{totalMembers}
          </span>
        </div>
      )}

      {/* Incomplete indicator */}
      {isIncomplete && (
        <span
          className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-400"
          aria-label="Absensi belum lengkap"
          title="Absensi belum lengkap"
        />
      )}

      {/* Today indicator */}
      {isToday && (
        <span
          className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500"
          aria-label="Hari ini"
          title="Hari ini"
        />
      )}
    </button>
  );
}