import { localDateStr, localDayToIso } from '@/lib/format';

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


/**
 * Rentang tanggal efektif di zona `tz` (zona pengguna). Tanpa from/to di URL, default 7 hari terakhir (hari ini + 6 hari sebelumnya);
 * `rentang=30` untuk 30 hari, `rentang=semua` tanpa batas tanggal.
 */
export function resolveRange(sp: ReportSearch, tz?: string): { from?: string; to?: string; preset: RangePreset } {
  if (sp.from || sp.to) return { from: sp.from, to: sp.to, preset: 'custom' };
  if (sp.rentang === 'semua') return { preset: 'semua' };
  const days = sp.rentang === '30' ? 30 : DEFAULT_RANGE_DAYS;
  return { from: localDateStr(-(days - 1), tz), to: localDateStr(0, tz), preset: days === 30 ? '30' : '7' };
}

/** Ubah filter URL menjadi query API (rentang efektif, tanggal lokal di zona `tz` → ISO). */
export function toApiQuery(sp: ReportSearch, page: number, limit: number, tz?: string) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  for (const k of ['category', 'status', 'q', 'priority'] as const) if (sp[k]) qs.set(k, sp[k]!);
  const { from, to } = resolveRange(sp, tz);
  if (from) qs.set('from', localDayToIso(from, tz));
  if (to) qs.set('to', localDayToIso(to, tz, true));
  return qs;
}
