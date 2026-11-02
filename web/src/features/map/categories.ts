/** Warna titik peta per kategori (selaras palet grafik). */
export const CATEGORY_COLOR: Record<string, string> = {
  SAMBANG: '#0a3a8c',
  DETEKSI_DINI: '#d7141f',
  PROBLEM_SOLVING: '#e07b00',
  PENYULUHAN: '#6d3fc4',
  HARGA_PANGAN: '#0587a8',
  MAPPING_KK: '#64748b',
  KETAHANAN_PANGAN: '#15803d',
};

export interface MapPoint {
  id: string;
  nomor: string;
  category: string;
  status: string;
  priority: boolean;
  lat: number;
  lng: number;
  occurred_at: string;
  desa: string;
  bhabin: string;
  flagged: boolean;
  timezone: string;
}

export interface MapCluster {
  lat: number;
  lng: number;
  jumlah: number;
  prioritas: number;
  /** Kategori terbanyak di gugus (untuk warna). */
  category: string;
}

export type MapView =
  | { mode: 'points'; total: number; points: MapPoint[] }
  | { mode: 'clusters'; total: number; clusters: MapCluster[] };

export interface MapSummary {
  total: number;
  byCategory: Record<string, number>;
  flagged: number;
  priority: MapPoint[];
}

const REGION_PARAMS = ['provinsiKode', 'kabupatenKode', 'kecamatanKode', 'desaKode'];

/** Parameter URL untuk membuka satu wilayah (kosong: seluruh Indonesia); tingkatnya terbaca dari kode "11.01.01.2001". */
export function regionQuery(query: string, kode: string) {
  const next = new URLSearchParams(query);
  const parts = kode ? kode.split('.') : [];
  REGION_PARAMS.forEach((name, i) => {
    if (i < parts.length) next.set(name, parts.slice(0, i + 1).join('.'));
    else next.delete(name);
  });
  return next;
}
