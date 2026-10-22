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
}
