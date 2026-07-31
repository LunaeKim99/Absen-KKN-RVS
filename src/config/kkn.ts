export const KKN_CONFIG = {
  START_DATE: '2026-07-27' as const,
  END_DATE: '2026-09-06' as const,
  DURATION_DAYS: 42,
  TIMEZONE: 'Asia/Jakarta' as const,
  QR_TOKEN_EXPIRES_SECONDS: 60,
} as const;

export type KknStatus = 'BELUM_DIMULAI' | 'BERLANGSUNG' | 'SELESAI';
