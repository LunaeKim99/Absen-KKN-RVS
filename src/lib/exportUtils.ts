import { formatInTimeZone } from 'date-fns-tz';
import { KKN_CONFIG } from '@/config/kkn';
import { formatKknDate, getKknStartDate, getKknEndDate } from '@/lib/kkn-utils';
import type { AttendanceWithProfile, Profile } from '@/types/database';
import type { MemberReport } from '@/features/admin/hooks/useReports';
import * as XLSX from 'xlsx';

export interface ExportOptions {
  startDate?: string;
  endDate?: string;
}

/** WIB timestamp string for the export header. */
function nowWibFormatted(): string {
  return formatInTimeZone(
    new Date(),
    KKN_CONFIG.TIMEZONE,
    'dd-MM-yyyy HH:mm',
  );
}

/** Common 5-row header block shared by all sheets. */
function headerRows(start: string, end: string): string[][] {
  return [
    ['Laporan Absensi KKN'],
    [`Periode KKN ${formatKknDate(getKknStartDate())} – ${formatKknDate(getKknEndDate())}`],
    [`Durasi ${KKN_CONFIG.DURATION_DAYS} Hari`],
    [`Rentang Filter: ${start} s/d ${end}`],
    [`Tanggal Export: ${nowWibFormatted()} WIB`],
  ];
}

/** Format an attendance date (stored as yyyy-mm-dd) to DD-MM-YYYY. */
function fmtAttendanceDate(dateStr: string): string {
  return formatKknDate(new Date(dateStr + 'T00:00:00+07:00'));
}

/** Format a check-in timestamp to HH:mm WIB. */
function fmtTime(dateStr: string): string {
  return formatInTimeZone(
    new Date(dateStr),
    KKN_CONFIG.TIMEZONE,
    'HH:mm',
  );
}

/** Attendance row shared by CSV and the "Data Absensi" sheet. */
function attendanceRow(a: AttendanceWithProfile, no: number): string[] {
  return [
    no.toString(),
    a.profiles?.name ?? '',
    a.profiles?.nim ?? '',
    a.profiles?.faculty ?? '',
    a.profiles?.major ?? '',
    fmtAttendanceDate(a.attendance_date),
    fmtTime(a.check_in_at),
    a.status,
    a.notes ?? '',
  ];
}

/**
 * Generate CSV content from attendance data.
 * Columns: No, Nama, NIM, Fakultas, Jurusan, Tanggal, Jam, Status, Catatan.
 */
export function exportCsv(
  attendances: AttendanceWithProfile[],
  _members: Profile[],
  options: ExportOptions = {},
): string {
  const { startDate, endDate } = options;
  const start = startDate ?? formatKknDate(getKknStartDate());
  const end = endDate ?? formatKknDate(getKknEndDate());

  const rows: string[][] = [
    ...headerRows(start, end),
    [],
    ['No', 'Nama', 'NIM', 'Fakultas', 'Jurusan', 'Tanggal', 'Jam', 'Status', 'Catatan'],
  ];

  attendances.forEach((a, i) => rows.push(attendanceRow(a, i + 1)));

  const bom = '\ufeff';
  const csvLines = rows.map((r) => r.join(',')).join('\r\n');
  return bom + csvLines;
}

/**
 * Trigger a CSV file download in the browser.
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 40-day monitoring row indexed by day number. */
interface DaySummary {
  date: string;
  dayNum: number;
  dayName: string;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
}

function buildDaySummaries(attendances: AttendanceWithProfile[]): DaySummary[] {
  const kknStart = getKknStartDate();
  const days: DaySummary[] = [];
  for (let i = 0; i < KKN_CONFIG.DURATION_DAYS; i++) {
    const d = new Date(kknStart);
    d.setDate(kknStart.getDate() + i);
    days.push({
      date: formatKknDate(d),
      dayNum: i + 1,
      dayName: new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(d),
      hadir: 0,
      terlambat: 0,
      izin: 0,
      sakit: 0,
      alpa: 0,
    });
  }

  for (const a of attendances) {
    const day = days.find((d) => d.date === fmtAttendanceDate(a.attendance_date));
    if (day) {
      switch (a.status) {
        case 'HADIR': day.hadir++; break;
        case 'TERLAMBAT': day.terlambat++; break;
        case 'IZIN': day.izin++; break;
        case 'SAKIT': day.sakit++; break;
        case 'ALPA': day.alpa++; break;
      }
    }
  }
  return days;
}

function buildDataAbsensiRows(
  attendances: AttendanceWithProfile[],
  start: string,
  end: string,
): string[][] {
  const rows: string[][] = [
    ...headerRows(start, end),
    [],
    ['No', 'Nama', 'NIM', 'Fakultas', 'Jurusan', 'Tanggal', 'Jam', 'Status', 'Catatan'],
  ];
  attendances.forEach((a, i) => rows.push(attendanceRow(a, i + 1)));
  return rows;
}

function buildRekapAnggotaRows(
  byMember: MemberReport[],
  start: string,
  end: string,
): string[][] {
  const rows: string[][] = [
    ...headerRows(start, end),
    [],
    ['No', 'Nama', 'NIM', 'Fakultas', 'Jurusan', 'HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPA', 'Total', '% Kehadiran'],
  ];

  byMember.forEach((m, i) => {
    rows.push([
      (i + 1).toString(),
      m.name,
      m.nim,
      m.faculty,
      m.major,
      m.total_hadir.toString(),
      m.total_terlambat.toString(),
      m.total_izin.toString(),
      m.total_sakit.toString(),
      m.total_alpa.toString(),
      (m.total_hadir + m.total_terlambat + m.total_izin + m.total_sakit + m.total_alpa).toString(),
      `${m.attendance_percentage}%`,
    ]);
  });
  return rows;
}

function buildMonitoringRows(
  attendances: AttendanceWithProfile[],
  start: string,
  end: string,
): string[][] {
  const days = buildDaySummaries(attendances);
  const rows: string[][] = [
    ...headerRows(start, end),
    [],
    ['No', 'Tanggal', 'Hari', 'Hari ke-', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa'],
  ];

  days.forEach((d, i) => {
    rows.push([
      (i + 1).toString(),
      d.date,
      d.dayName,
      d.dayNum.toString(),
      d.hadir.toString(),
      d.terlambat.toString(),
      d.izin.toString(),
      d.sakit.toString(),
      d.alpa.toString(),
    ]);
  });
  return rows;
}

/**
 * Build the three-sheet Excel workbook:
 * 1. Data Absensi – header + full attendance list
 * 2. Rekap Anggota – header + per-member summary
 * 3. Monitoring 40 Hari – header + daily summary (exactly 40 rows)
 */
export function buildExcelWorkbook(
  attendances: AttendanceWithProfile[],
  _members: Profile[],
  byMember: MemberReport[],
  options: ExportOptions = {},
): XLSX.WorkBook {
  const { startDate, endDate } = options;
  const start = startDate ?? formatKknDate(getKknStartDate());
  const end = endDate ?? formatKknDate(getKknEndDate());

  const sheet1 = XLSX.utils.aoa_to_sheet(buildDataAbsensiRows(attendances, start, end));
  const sheet2 = XLSX.utils.aoa_to_sheet(buildRekapAnggotaRows(byMember, start, end));
  const sheet3 = XLSX.utils.aoa_to_sheet(buildMonitoringRows(attendances, start, end));

  const wb: XLSX.WorkBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet1, 'Data Absensi');
  XLSX.utils.book_append_sheet(wb, sheet2, 'Rekap Anggota');
  XLSX.utils.book_append_sheet(wb, sheet3, 'Monitoring 40 Hari');
  return wb;
}

/**
 * Export attendance/member report data to an Excel (.xlsx) file.
 * Filename: laporan-absensi-kkn-{start}-sampai-{end}.xlsx
 */
export function exportExcel(
  attendances: AttendanceWithProfile[],
  members: Profile[],
  byMember: MemberReport[],
  options: ExportOptions = {},
): void {
  const { startDate, endDate } = options;
  const startFmt = formatKknDate(new Date(startDate ?? getKknStartDate()));
  const endFmt = formatKknDate(new Date(endDate ?? getKknEndDate()));
  const filename = `laporan-absensi-kkn-${startFmt}-sampai-${endFmt}.xlsx`;

  const wb = buildExcelWorkbook(attendances, members, byMember, options);
  XLSX.writeFile(wb, filename);
}
