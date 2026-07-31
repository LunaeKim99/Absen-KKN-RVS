import { useMemo, useState } from 'react';
import { CalendarDays, Search, Pencil, ClipboardList } from 'lucide-react';
import { useFilteredAttendance, useUpdateAttendanceStatus } from '@/features/admin/hooks/useAllAttendance';
import { formatKknDate } from '@/lib/kkn-utils';
import { formatInTimeZone } from 'date-fns-tz';
import { KKN_CONFIG } from '@/config/kkn';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AttendanceStatus } from '@/types/database';
import type { AttendanceWithProfile } from '@/types/database';

const KKN_START_ISO = '2026-07-27';
const KKN_END_ISO = '2026-09-06';

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua Status' },
  { value: 'HADIR', label: 'Hadir' },
  { value: 'TERLAMBAT', label: 'Terlambat' },
  { value: 'IZIN', label: 'Izin' },
  { value: 'SAKIT', label: 'Sakit' },
  { value: 'ALPA', label: 'Alpa' },
];

const STATUS_EDIT_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'HADIR', label: 'Hadir' },
  { value: 'TERLAMBAT', label: 'Terlambat' },
  { value: 'IZIN', label: 'Izin' },
  { value: 'SAKIT', label: 'Sakit' },
  { value: 'ALPA', label: 'Alpa' },
];

function formatDateOnly(dateStr: string): string {
  return formatKknDate(new Date(dateStr + 'T00:00:00+07:00'));
}

function formatTimeWib(iso: string): string {
  return formatInTimeZone(new Date(iso), KKN_CONFIG.TIMEZONE, 'HH:mm');
}

export default function AbsensiPage() {
  const { toast } = useToast();
  const [dateFilter, setDateFilter] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editRecord, setEditRecord] = useState<AttendanceWithProfile | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('HADIR');
  const [editNotes, setEditNotes] = useState('');

  const { data: filteredByHook = [], isLoading } = useFilteredAttendance({
    date: dateFilter || undefined,
    search: search || undefined,
  });

  const updateStatus = useUpdateAttendanceStatus();

  const rows = useMemo(() => {
    if (!statusFilter) return filteredByHook;
    return filteredByHook.filter((a) => a.status === statusFilter);
  }, [filteredByHook, statusFilter]);

  const openEdit = (record: AttendanceWithProfile) => {
    setEditRecord(record);
    setEditStatus(record.status);
    setEditNotes(record.notes ?? '');
  };

  const handleSave = async () => {
    if (!editRecord) return;
    try {
      await updateStatus.mutateAsync({
        attendanceId: editRecord.id,
        status: editStatus,
        notes: editNotes.trim() || undefined,
      });
      setEditRecord(null);
      toast.success('Status absensi diperbarui');
    } catch {
      toast.error('Gagal memperbarui status absensi');
    }
  };

  const hasActiveFilters = Boolean(dateFilter || search || statusFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Absensi"
        description="Kelola dan pantau kehadiran anggota KKN"
      />

      {/* Filters */}
      <Card>
        <CardContent className="space-y-4 p-4 md:p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="filter-date"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Tanggal
              </label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <Input
                  id="filter-date"
                  type="date"
                  value={dateFilter}
                  min={KKN_START_ISO}
                  max={KKN_END_ISO}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-9"
                  aria-label="Filter tanggal"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="filter-search"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Cari
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <Input
                  id="filter-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nama atau NIM..."
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="filter-status"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Status
              </label>
              <Select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={STATUS_FILTER_OPTIONS}
                aria-label="Filter status"
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFilter('');
                  setSearch('');
                  setStatusFilter('');
                }}
              >
                Hapus Filter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result count */}
      <p className="text-sm text-gray-600 dark:text-gray-400" role="status">
        Menampilkan {rows.length} data absensi
      </p>

      {/* Desktop Table */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">No</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Nama</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">NIM</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Tanggal</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Jam</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Catatan</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b dark:border-gray-800">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <EmptyState
                      icon={ClipboardList}
                      title="Belum ada data absensi"
                      description={hasActiveFilters ? 'Coba ubah filter pencarian' : 'Data absensi akan muncul di sini'}
                    />
                  </td>
                </tr>
              ) : (
                rows.map((a, i) => (
                  <tr key={a.id} className="border-b hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{a.profiles?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{a.profiles?.nim ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDateOnly(a.attendance_date)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatTimeWib(a.check_in_at)} WIB</td>
                    <td className="px-4 py-3">
                      <StatusBadge.AttendanceStatusBadge status={a.status} />
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-gray-600 dark:text-gray-400" title={a.notes ?? ''}>
                      {a.notes ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(a)}
                        className="min-w-[44px] min-h-[44px]"
                        aria-label={`Ubah status ${a.profiles?.name ?? 'anggota'}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Belum ada data absensi"
            description={hasActiveFilters ? 'Coba ubah filter pencarian' : 'Data absensi akan muncul di sini'}
          />
        ) : (
          rows.map((a, i) => (
            <Card key={a.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{a.profiles?.name ?? '-'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{a.profiles?.nim ?? '-'}</p>
                  </div>
                  <StatusBadge.AttendanceStatusBadge status={a.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">No</p>
                    <p className="text-gray-700 dark:text-gray-300">{i + 1}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Tanggal</p>
                    <p className="text-gray-700 dark:text-gray-300">{formatDateOnly(a.attendance_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Jam</p>
                    <p className="text-gray-700 dark:text-gray-300">{formatTimeWib(a.check_in_at)} WIB</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Catatan</p>
                    <p className="text-gray-700 dark:text-gray-300">{a.notes ?? '-'}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(a)}
                  className="w-full"
                >
                  <Pencil className="h-4 w-4" />
                  Ubah Status
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Status Modal */}
      <Modal
        open={!!editRecord}
        onClose={() => setEditRecord(null)}
        title="Ubah Status Absensi"
      >
        {editRecord && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="font-medium text-gray-900 dark:text-gray-100">{editRecord.profiles?.name ?? '-'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {editRecord.profiles?.nim ?? '-'} &middot; {formatDateOnly(editRecord.attendance_date)} &middot;{' '}
                {formatTimeWib(editRecord.check_in_at)} WIB
              </p>
            </div>
            <div>
              <label
                htmlFor="edit-status"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Status
              </label>
              <Select
                id="edit-status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as AttendanceStatus)}
                options={STATUS_EDIT_OPTIONS}
              />
            </div>
            <div>
              <label
                htmlFor="edit-notes"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Catatan
              </label>
              <textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                placeholder="Catatan tambahan (opsional)..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditRecord(null)}>
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                loading={updateStatus.isPending}
              >
                Simpan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}