import { localDate } from './time';

/**
 * CSV untuk Excel berbahasa Indonesia: pemisah titik koma (karena koma = desimal), BOM UTF-8, CRLF.
 */
export function toCsv(header: string[], rows: (string | number | boolean | null | undefined | Date)[][]) {
  const cell = (v: unknown) => {
    if (v == null) return '';
    const s = v instanceof Date ? v.toISOString() : typeof v === 'boolean' ? (v ? 'Ya' : 'Tidak') : String(v);
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

export { localDateTime as waktu } from './time';

/** Nama berkas ekspor dengan tanggal hari ini (WIB). */
export const exportName = (base: string, tz?: string | null) => `${base}_${localDate(new Date(), tz)}.csv`;
