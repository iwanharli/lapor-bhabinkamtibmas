/** Zona waktu Indonesia. Penyimpanan selalu UTC; tampilan & penanggalan bisnis memakai zona unit. */
export const TIMEZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'] as const;
export type IndonesianTimezone = (typeof TIMEZONES)[number];

export const DEFAULT_TZ: IndonesianTimezone = 'Asia/Jakarta';

export const TZ_LABEL: Record<string, string> = { 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' };

export const tzOf = (tz?: string | null) => (tz && TZ_LABEL[tz] ? tz : DEFAULT_TZ);

/** Tanggal lokal "YYYY-MM-DD" di zona tertentu. */
export const localDate = (d: Date, tz?: string | null) => d.toLocaleDateString('en-CA', { timeZone: tzOf(tz) });

/** "22/10/2026, 07.42 WITA" untuk ekspor/tampilan. */
export const localDateTime = (d: Date | null | undefined, tz?: string | null) =>
  d
    ? `${d.toLocaleString('id-ID', { timeZone: tzOf(tz), day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} ${TZ_LABEL[tzOf(tz)]}`
    : '';
