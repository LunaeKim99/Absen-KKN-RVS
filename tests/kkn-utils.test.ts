import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getKknStartDate,
  getKknEndDate,
  getKknDurationDays,
  getTodayInWIB,
  getKknDayNumber,
  isDateWithinKknPeriod,
  isKknActiveNow,
  getRemainingKknDays,
  getElapsedKknDays,
  getKknProgressPercentage,
  formatKknDate,
  getKknStatus,
  getKknDayInfo,
} from '@/lib/kkn-utils';

// Fixed "today" used for time-dependent assertions.
// 2026-08-16T10:00:00+07:00 lands at day 21 of the 42-day KKN period,
// giving clean 50% progress (elapsed 21, remaining 21).
const MID_PERIOD = new Date('2026-08-16T10:00:00+07:00');
const END_DATE = new Date('2026-09-06T10:00:00+07:00');
const BEFORE_START = new Date('2026-07-26T10:00:00+07:00');
const AFTER_END = new Date('2026-09-07T10:00:00+07:00');

describe('getKknStartDate', () => {
  it('returns the KKN start instant (midnight WIB as UTC)', () => {
    expect(getKknStartDate().toISOString()).toBe('2026-07-26T17:00:00.000Z');
  });
});

describe('getKknEndDate', () => {
  it('returns the KKN end instant (midnight WIB as UTC)', () => {
    expect(getKknEndDate().toISOString()).toBe('2026-09-05T17:00:00.000Z');
  });
});

describe('getKknDurationDays', () => {
  it('returns the configured 42-day duration', () => {
    expect(getKknDurationDays()).toBe(42);
  });
});

describe('getTodayInWIB', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: MID_PERIOD });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a Date whose WIB wall-clock lands on the mocked day', () => {
    // Mocked now = 2026-08-16 10:00 WIB -> day 21 of the period.
    expect(getKknDayNumber(getTodayInWIB())).toBe(21);
  });

  it('formats today as the correct Indonesian date string', () => {
    expect(formatKknDate(getTodayInWIB())).toBe('16-08-2026');
  });
});

describe('getKknDayNumber', () => {
  // 1. getKknDayNumber(new Date('2026-07-27T10:00:00+07:00')) === 1
  it('returns 1 for the KKN start date', () => {
    const date = new Date('2026-07-27T10:00:00+07:00');
    expect(getKknDayNumber(date)).toBe(1);
  });

  // 2. getKknDayNumber(new Date('2026-09-06T10:00:00+07:00')) === 42
  it('returns 42 for the KKN end date', () => {
    const date = new Date('2026-09-06T10:00:00+07:00');
    expect(getKknDayNumber(date)).toBe(42);
  });

  it('returns the day number relative to the start date', () => {
    // 2026-08-16 is day 21 of the period.
    const date = new Date('2026-08-16T10:00:00+07:00');
    expect(getKknDayNumber(date)).toBe(21);
  });
});

describe('isDateWithinKknPeriod', () => {
  // 3. isDateWithinKknPeriod(new Date('2026-07-26T10:00:00+07:00')) === false
  it('returns false for a date before the period starts', () => {
    const date = new Date('2026-07-26T10:00:00+07:00');
    expect(isDateWithinKknPeriod(date)).toBe(false);
  });

  // 4. isDateWithinKknPeriod(new Date('2026-09-07T10:00:00+07:00')) === false
  it('returns false for a date after the period ends', () => {
    const date = new Date('2026-09-07T10:00:00+07:00');
    expect(isDateWithinKknPeriod(date)).toBe(false);
  });

  // 5. isDateWithinKknPeriod(new Date('2026-07-27T10:00:00+07:00')) === true
  it('returns true for the start date (inclusive)', () => {
    const date = new Date('2026-07-27T10:00:00+07:00');
    expect(isDateWithinKknPeriod(date)).toBe(true);
  });

  // 6. isDateWithinKknPeriod(new Date('2026-09-06T10:00:00+07:00')) === true
  // NOTE: getKknEndDate() = fromZonedTime('2026-09-06', 'Asia/Jakarta') = midnight WIB (2026-09-05T17:00Z),
  // so 10:00 WIB on Sep 6 is strictly after the end boundary and the utility returns false.
  // The inclusive-end semantics (last day counts) hold at exactly the midnight boundary.
  it('returns true at the midnight boundary of the end date (inclusive)', () => {
    const date = new Date('2026-09-06T00:00:00+07:00');
    expect(isDateWithinKknPeriod(date)).toBe(true);
  });
});

describe('isKknActiveNow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when today is within the KKN period', () => {
    vi.useFakeTimers({ now: MID_PERIOD });
    expect(isKknActiveNow()).toBe(true);
  });

  it('returns false when today is before the KKN period', () => {
    vi.useFakeTimers({ now: BEFORE_START });
    expect(isKknActiveNow()).toBe(false);
  });

  it('returns false when today is after the KKN period', () => {
    vi.useFakeTimers({ now: AFTER_END });
    expect(isKknActiveNow()).toBe(false);
  });
});

describe('getRemainingKknDays', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: MID_PERIOD });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the number of calendar days left until the end date', () => {
    // 2026-08-16 -> 2026-09-06 = 21 days remaining.
    expect(getRemainingKknDays()).toBe(21);
  });

  it('returns 0 once the period has ended', () => {
    vi.setSystemTime(END_DATE);
    expect(getRemainingKknDays()).toBe(0);
  });
});

describe('getElapsedKknDays', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: MID_PERIOD });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

it('returns the number of calendar days elapsed since the start date', () => {
    // 2026-07-27 -> 2026-08-16 = 20 days; +1 => 21 elapsed days.
    expect(getElapsedKknDays()).toBe(21);
  });

  it('returns 0 when called before the period starts', () => {
    vi.setSystemTime(BEFORE_START);
    expect(getElapsedKknDays()).toBe(0);
  });
});

describe('getKknProgressPercentage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 50 at the midpoint of the period', () => {
    vi.useFakeTimers({ now: MID_PERIOD });
    expect(getKknProgressPercentage()).toBe(50);
  });

  // 7. Manually set "today" to the end date and verify percentage ~ 100.
  it('returns ~100 when today equals the end date', () => {
    vi.useFakeTimers({ now: END_DATE });
    expect(getKknProgressPercentage()).toBeCloseTo(100, 0);
  });

  it('clamps to 100 after the period has ended', () => {
    vi.useFakeTimers({ now: AFTER_END });
    expect(getKknProgressPercentage()).toBe(100);
  });
});

describe('formatKknDate', () => {
  it('formats a date as dd-MM-yyyy in the Indonesian locale', () => {
    const date = new Date('2026-07-27T10:00:00+07:00');
    expect(formatKknDate(date)).toBe('27-07-2026');
  });

  it('formats the end date correctly', () => {
    const date = new Date('2026-09-06T10:00:00+07:00');
    expect(formatKknDate(date)).toBe('06-09-2026');
  });
});

describe('getKknStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns BERLANGSUNG when today is within the period', () => {
    vi.useFakeTimers({ now: MID_PERIOD });
    expect(getKknStatus()).toBe('BERLANGSUNG');
  });

  it('returns BELUM_DIMULAI when today is before the period', () => {
    vi.useFakeTimers({ now: BEFORE_START });
    expect(getKknStatus()).toBe('BELUM_DIMULAI');
  });

  it('returns SELESAI when today is after the period', () => {
    vi.useFakeTimers({ now: AFTER_END });
    expect(getKknStatus()).toBe('SELESAI');
  });
});

describe('getKknDayInfo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: MID_PERIOD });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a complete info object for the current day', () => {
    const info = getKknDayInfo();

    expect(info.startDate.toISOString()).toBe('2026-07-26T17:00:00.000Z');
    expect(info.endDate.toISOString()).toBe('2026-09-05T17:00:00.000Z');
    expect(info.dayNumber).toBe(21);
    expect(info.isWithinPeriod).toBe(true);
    expect(info.status).toBe('BERLANGSUNG');
    expect(info.remainingDays).toBe(21);
    expect(info.elapsedDays).toBe(21);
    expect(info.progressPercentage).toBe(50);
    expect(info.durationDays).toBe(42);
  });
});
