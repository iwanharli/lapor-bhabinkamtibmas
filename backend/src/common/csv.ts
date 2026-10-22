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

/** Waktu dalam format lokal WIB, mis. "22/10/2026 07.42". */
export const wib = (d: Date | null | undefined) =>
  d ? d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

/** Nama berkas ekspor dengan tanggal hari ini (WIB). */
export const exportName = (base: string) => `${base}_${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })}.csv`;
