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

const TZ_OFFSET: Record<string, string> = { 'Asia/Jakarta': '+07:00', 'Asia/Makassar': '+08:00', 'Asia/Jayapura': '+09:00' };

/** ISO 8601 dengan offset zona (Indonesia tanpa DST), mis. "2026-10-25T08:30:00+07:00". */
export const isoLocal = (d: Date | null | undefined, tz?: string | null) => {
  if (!d) return null;
  const z = tzOf(tz);
  const local = new Date(d.getTime() + Number(TZ_OFFSET[z].slice(0, 3)) * 3_600_000);
  return `${local.toISOString().slice(0, 19)}${TZ_OFFSET[z]}`;
};
