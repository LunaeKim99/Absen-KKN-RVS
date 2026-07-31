import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatKknDate, getKknStartDate, getKknEndDate } from '@/lib/kkn-utils';
import type {
  AttendanceWithProfile,
  Profile,
  MemberSummary,
} from '@/types/database';

const EMPTY_SUMMARY: MemberSummary = {
  total_hadir: 0,
  total_terlambat: 0,
  total_izin: 0,
  total_sakit: 0,
  total_alpa: 0,
  attendance_percentage: 0,
};

/** Per-member report row: member identity + attendance summary. */
export interface MemberReport extends MemberSummary {
  id: string;
  name: string;
  nim: string;
  faculty: string;
  major: string;
}

function reportKey(startDate: string, endDate: string) {
  return ['admin', 'laporan', startDate, endDate] as const;
}

/** Clamp an ISO date string (yyyy-mm-dd) to the KKN period boundaries. */
function clampDate(dateStr: string): string {
  const kknStart = getKknStartDate();
  const kknEnd = getKknEndDate();
  const target = new Date(dateStr + 'T00:00:00+07:00');

  if (target < kknStart) return formatKknDate(kknStart);
  if (target > kknEnd) return formatKknDate(kknEnd);
  return dateStr;
}

function computeMemberReport(
  members: Profile[],
  attendances: AttendanceWithProfile[],
): MemberReport[] {
  const byId = new Map<string, MemberSummary>();
  for (const m of members) {
    byId.set(m.id, { ...EMPTY_SUMMARY });
  }

  for (const a of attendances) {
    const summary = byId.get(a.user_id);
    if (!summary) continue;
    const key = `total_${a.status.toLowerCase()}` as keyof MemberSummary;
    (summary as unknown as Record<string, number>)[key]++;
  }

  return members.map((m) => {
    const summary = byId.get(m.id) ?? { ...EMPTY_SUMMARY };
    const percentage = Math.round(
      ((summary.total_hadir + summary.total_terlambat) / 40) * 100,
    );
    return {
      ...summary,
      attendance_percentage: percentage,
      id: m.id,
      name: m.name,
      nim: m.nim,
      faculty: m.faculty,
      major: m.major,
    };
  });
}

export function useReportData(startDate?: string, endDate?: string) {
  const clampedStart = clampDate(startDate ?? formatKknDate(getKknStartDate()));
  const clampedEnd = clampDate(endDate ?? formatKknDate(getKknEndDate()));

  return useQuery<{
    attendances: AttendanceWithProfile[];
    members: Profile[];
    byMember: MemberReport[];
  }>({
    queryKey: reportKey(clampedStart, clampedEnd),
    queryFn: async () => {
      const { data: attendances, error: attError } = await supabase
        .from('attendances')
        .select('*, profiles!user_id(name, nim)')
        .gte('attendance_date', clampedStart)
        .lte('attendance_date', clampedEnd)
        .order('attendance_date', { ascending: false });
      if (attError) throw attError;

      const { data: members, error: memError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'ANGGOTA')
        .eq('approval_status', 'APPROVED')
        .order('created_at', { ascending: false });
      if (memError) throw memError;

      const attList = (attendances as AttendanceWithProfile[]) ?? [];
      const memList = (members as Profile[]) ?? [];

      return {
        attendances: attList,
        members: memList,
        byMember: computeMemberReport(memList, attList),
      };
    },
  });
}

export { EMPTY_SUMMARY };
