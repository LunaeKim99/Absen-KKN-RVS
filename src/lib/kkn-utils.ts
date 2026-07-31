import { differenceInCalendarDays, format } from 'date-fns';
import { id } from 'date-fns/locale';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { KKN_CONFIG } from '@/config/kkn';
import type { KknStatus } from '@/config/kkn';

const TZ = KKN_CONFIG.TIMEZONE;

export const getKknStartDate = (): Date => {
  return fromZonedTime(KKN_CONFIG.START_DATE, TZ);
};

export const getKknEndDate = (): Date => {
  return fromZonedTime(KKN_CONFIG.END_DATE, TZ);
};

export const getKknDurationDays = (): number => {
  return KKN_CONFIG.DURATION_DAYS;
};

export const getTodayInWIB = (): Date => {
  return toZonedTime(new Date(), TZ);
};

export const getKknDayNumber = (date?: Date): number => {
  const today = date ?? getTodayInWIB();
  const startDate = getKknStartDate();
  const dayNum = differenceInCalendarDays(today, startDate) + 1;
  return dayNum;
};

export const isDateWithinKknPeriod = (date?: Date): boolean => {
  const target = date ?? getTodayInWIB();
  const start = getKknStartDate();
  const end = getKknEndDate();
  return target >= start && target <= end;
};

export const isKknActiveNow = (): boolean => {
  const status = getKknStatus();
  return status === 'BERLANGSUNG';
};

export const getRemainingKknDays = (): number => {
  const today = getTodayInWIB();
  const end = getKknEndDate();
  const remaining = differenceInCalendarDays(end, today);
  return remaining > 0 ? remaining : 0;
};

export const getElapsedKknDays = (): number => {
  const today = getTodayInWIB();
  const start = getKknStartDate();
  const elapsed = differenceInCalendarDays(today, start) + 1;
  return elapsed > 0 ? elapsed : 0;
};

export const getKknProgressPercentage = (): number => {
  const elapsed = getElapsedKknDays();
  const total = getKknDurationDays();
  return Math.min((elapsed / total) * 100, 100);
};

export const formatKknDate = (date: Date): string => {
  return format(date, 'dd-MM-yyyy', { locale: id });
};

export const getKknStatus = (): KknStatus => {
  const today = getTodayInWIB();
  const start = getKknStartDate();
  const end = getKknEndDate();

  if (today < start) return 'BELUM_DIMULAI';
  if (today > end) return 'SELESAI';
  return 'BERLANGSUNG';
};

export const getKknDayInfo = () => {
  const today = getTodayInWIB();
  const start = getKknStartDate();
  const end = getKknEndDate();
  const dayNum = getKknDayNumber();
  const isWithin = isDateWithinKknPeriod(today);

  return {
    startDate: start,
    endDate: end,
    today,
    dayNumber: dayNum,
    isWithinPeriod: isWithin,
    status: getKknStatus(),
    remainingDays: getRemainingKknDays(),
    elapsedDays: getElapsedKknDays(),
    progressPercentage: getKknProgressPercentage(),
    durationDays: getKknDurationDays(),
  };
};
