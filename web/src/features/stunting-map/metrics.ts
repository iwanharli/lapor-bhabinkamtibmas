/** Angka per wilayah dari /analytics/stunting/map. */
export interface AreaStats {
  kode: string; nama: string; chain: string; level: 1 | 2 | 3 | 4;
  kk: number; balita: number; stunting: number; berisiko: number; belum_ditangani: number;
  jamban_tidak_layak: number; air_tidak_layak: number; kk_sanitasi: number;
}

export type MetricKey = 'rasio' | 'belum' | 'jamban' | 'air';

/** Skala warna berurutan (kuning → merah tua) & abu-abu untuk data terlalu sedikit. */
export const COLORS = ['#fef3c7', '#fdba74', '#f97316', '#dc2626', '#7f1d1d'];
export const FEW = '#94a3b8';

export const METRICS: Record<MetricKey, {
  label: string; short: string; unit: '%' | 'orang';
  value: (a: AreaStats) => number | null; breaks?: number[]; hint: string;
}> = {
  rasio: {
    label: 'Stunting & berisiko (% balita)', short: '% stunting', unit: '%', breaks: [10, 20, 30, 40],
    value: (a) => (a.balita >= 3 ? ((a.stunting + a.berisiko) / a.balita) * 100 : null),
    hint: 'Wilayah dengan kurang dari 3 balita terdata diberi warna abu-abu.',
  },
  belum: {
    label: 'Belum ditangani (jumlah balita)', short: 'belum ditangani', unit: 'orang',
    value: (a) => a.belum_ditangani,
    hint: 'Balita stunting/berisiko yang belum rutin ke Posyandu/Puskesmas. Kelas warna dihitung dari wilayah yang tampil.',
  },
  jamban: {
    label: 'Jamban tidak layak (% keluarga)', short: '% jamban', unit: '%', breaks: [15, 30, 45, 60],
    value: (a) => (a.kk_sanitasi >= 3 ? (a.jamban_tidak_layak / a.kk_sanitasi) * 100 : null),
    hint: 'Tanpa septic tank, bersama/umum, atau tidak ada jamban.',
  },
  air: {
    label: 'Air minum tidak layak (% keluarga)', short: '% air', unit: '%', breaks: [10, 20, 30, 40],
    value: (a) => (a.kk_sanitasi >= 3 ? (a.air_tidak_layak / a.kk_sanitasi) * 100 : null),
    hint: 'Sumur/mata air tidak terlindung atau sungai/danau/irigasi.',
  },
};

/** Batas kelas untuk metrik jumlah: kuantil dari wilayah yang tampil (min. bertingkat 1). */
export function countBreaks(values: number[]) {
  const v = values.filter((x) => x > 0).sort((a, b) => a - b);
  if (!v.length) return [1, 2, 3, 4];
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(v.length * p))];
  const out: number[] = [];
  for (const b of [1, q(0.4), q(0.7), q(0.9)]) out.push(Math.max(b, (out.at(-1) ?? 0) + 1));
  return out;
}

export const colorFor = (value: number | null, breaks: number[]) =>
  value == null ? FEW : value === 0 ? COLORS[0] : COLORS[Math.min(breaks.filter((b) => value >= b).length, COLORS.length - 1)];

export const fmt = (v: number | null, unit: '%' | 'orang') =>
  v == null ? 'data sedikit' : unit === '%' ? `${v.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%` : v.toLocaleString('id-ID');
