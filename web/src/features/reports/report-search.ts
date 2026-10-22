/** Filter laporan di URL; dipakai bersama oleh halaman (server) dan bar filter (klien). */
export interface ReportSearch {
  category?: string;
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  priority?: string;
  page?: string;
  limit?: string;
  /** Pilihan cepat rentang waktu bila from/to kosong: '7' (default), '30', atau 'semua'. */
  rentang?: string;
}

export type RangePreset = '7' | '30' | 'semua' | 'custom';

export const DEFAULT_RANGE_DAYS = 7;

/** Tanggal (YYYY-MM-DD) di zona WIB, `offsetDays` hari dari hari ini. */
export function wibDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

/**
 * Rentang tanggal efektif. Tanpa from/to di URL, default 7 hari terakhir (hari ini + 6 hari sebelumnya, WIB);
 * `rentang=30` untuk 30 hari, `rentang=semua` tanpa batas tanggal.
 */
export function resolveRange(sp: ReportSearch): { from?: string; to?: string; preset: RangePreset } {
  if (sp.from || sp.to) return { from: sp.from, to: sp.to, preset: 'custom' };
  if (sp.rentang === 'semua') return { preset: 'semua' };
  const days = sp.rentang === '30' ? 30 : DEFAULT_RANGE_DAYS;
  return { from: wibDate(-(days - 1)), to: wibDate(), preset: days === 30 ? '30' : '7' };
}

/** Ubah filter URL menjadi query API (rentang efektif, tanggal lokal WIB → ISO). */
export function toApiQuery(sp: ReportSearch, page: number, limit: number) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  for (const k of ['category', 'status', 'q', 'priority'] as const) if (sp[k]) qs.set(k, sp[k]!);
  const { from, to } = resolveRange(sp);
  if (from) qs.set('from', new Date(`${from}T00:00:00+07:00`).toISOString());
  if (to) qs.set('to', new Date(`${to}T23:59:59+07:00`).toISOString());
  return qs;
}
