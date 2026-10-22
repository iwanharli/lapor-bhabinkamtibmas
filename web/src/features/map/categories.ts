/** Warna titik peta per kategori (selaras palet grafik). */
export const CATEGORY_COLOR: Record<string, string> = {
  SAMBANG: '#1d4ed8',
  DETEKSI_DINI: '#c81e3a',
  PROBLEM_SOLVING: '#c2650a',
  PENYULUHAN: '#7c3aed',
  HARGA_PANGAN: '#0ea5e9',
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
