import { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  FileDown,
  Calendar,
  Users,
  BarChart3,
} from 'lucide-react';
import { useReportData } from '@/features/admin/hooks/useReports';
import { exportExcel, exportCsv, downloadCsv } from '@/lib/exportUtils';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { Skeleton } from '@/components/ui/Skeleton';

const KKN_START = '2026-07-27';
const KKN_END = '2026-09-06';

function displayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
}

export default function LaporanPage() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(KKN_START);
  const [endDate, setEndDate] = useState(KKN_END);

  const displayRange = `Rentang: ${displayDate(startDate)} s/d ${displayDate(endDate)}`;

  const { data: reportData, isLoading } = useReportData(startDate, endDate);

  const summary = useMemo(() => {
    if (!reportData) return null;
    const { byMember, attendances } = reportData;
    const totalHadir = byMember.reduce((s, m) => s + m.total_hadir, 0);
    const totalTerlambat = byMember.reduce((s, m) => s + m.total_terlambat, 0);
    const totalIzin = byMember.reduce((s, m) => s + m.total_izin, 0);
    const totalSakit = byMember.reduce((s, m) => s + m.total_sakit, 0);
    const totalAlpa = byMember.reduce((s, m) => s + m.total_alpa, 0);
    return {
      members: byMember.length,
      records: attendances.length,
      totalHadir,
      totalTerlambat,
      totalIzin,
      totalSakit,
      totalAlpa,
    };
  }, [reportData]);

  const handleExportExcel = () => {
    if (!reportData) return;
    try {
      exportExcel(reportData.attendances, reportData.members, reportData.byMember, {
        startDate,
        endDate,
      });
      toast.success('File Excel berhasil diunduh');
    } catch {
      toast.error('Gagal mengunduh file Excel');
    }
  };

  const handleExportCsv = () => {
    if (!reportData) return;
    try {
      const csv = exportCsv(reportData.attendances, reportData.members, {
        startDate,
        endDate,
      });
      downloadCsv(csv, `laporan-absensi-kkn-${startDate}-sampai-${endDate}.csv`);
      toast.success('File CSV berhasil diunduh');
    } catch {
      toast.error('Gagal mengunduh file CSV');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Absensi"
        description="Rekap kehadiran anggota KKN"
        action={
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportExcel}
              disabled={!reportData || reportData.attendances.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Export Excel (.xlsx)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={!reportData || reportData.attendances.length === 0}
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Date Filters */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="report-start"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Dari Tanggal
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                <input
                  id="report-start"
                  type="date"
                  value={startDate}
                  min={KKN_START}
                  max={KKN_END}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="flex-1">
              <label
                htmlFor="report-end"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Sampai Tanggal
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                <input
                  id="report-end"
                  type="date"
                  value={endDate}
                  min={KKN_START}
                  max={KKN_END}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="shrink-0">
              <p className="whitespace-nowrap rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {displayRange}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <SummaryCard label="Anggota" value={summary.members} icon={<Users className="h-5 w-5" />} color="gray" />
          <SummaryCard label="Total Record" value={summary.records} icon={<BarChart3 className="h-5 w-5" />} color="blue" />
          <SummaryCard label="Hadir" value={summary.totalHadir} color="green" />
          <SummaryCard label="Terlambat" value={summary.totalTerlambat} color="amber" />
          <SummaryCard label="Izin + Sakit" value={summary.totalIzin + summary.totalSakit} color="blue" />
          <SummaryCard label="Alpa" value={summary.totalAlpa} color="red" />
        </div>
      ) : null}

      {/* Member Summary Table */}
      {!isLoading && reportData && (
        <Card>
          <CardHeader>
            <CardTitle>Rekap Per Anggota</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {reportData.byMember.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Tidak ada data anggota</p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">No</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Nama</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">NIM</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Hadir</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Terlambat</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Izin</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Sakit</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Alpa</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">% Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.byMember.map((m, i) => (
                      <tr key={m.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{m.name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{m.nim}</td>
                        <td className="px-4 py-3 text-center text-green-700 font-medium dark:text-green-400">{m.total_hadir}</td>
                        <td className="px-4 py-3 text-center text-amber-700 font-medium dark:text-amber-400">{m.total_terlambat}</td>
                        <td className="px-4 py-3 text-center text-blue-700 font-medium dark:text-blue-400">{m.total_izin}</td>
                        <td className="px-4 py-3 text-center text-blue-700 font-medium dark:text-blue-400">{m.total_sakit}</td>
                        <td className="px-4 py-3 text-center text-red-700 font-medium dark:text-red-400">{m.total_alpa}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`font-semibold ${
                              m.attendance_percentage >= 80
                                ? 'text-green-700 dark:text-green-400'
                                : m.attendance_percentage >= 60
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-red-700 dark:text-red-400'
                            }`}
                          >
                            {m.attendance_percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  color: 'gray' | 'green' | 'amber' | 'red' | 'blue';
}) {
  const colors = {
    gray: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-800',
    green: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}