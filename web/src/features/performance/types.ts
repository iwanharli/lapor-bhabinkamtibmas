export interface BhabinPerformance {
  id: string;
  nrp: string;
  nama: string;
  pangkat: string | null;
  unit: string;
  timezone: string;
  desa: number;
  total: number;
  disetujui: number;
  menunggu: number;
  revisi: number;
  ditolak: number;
  lokasi_janggal: number;
  hari_aktif: number;
  terakhir: string | null;
  terakhir_sepanjang: string | null;
  sambang: number;
  deteksi_dini: number;
  problem_solving: number;
  penyuluhan: number;
  harga_pangan: number;
  mapping_kk: number;
  ketahanan_pangan: number;
}

export const CATEGORY_KEYS = ['sambang', 'deteksi_dini', 'problem_solving', 'penyuluhan', 'harga_pangan', 'mapping_kk', 'ketahanan_pangan'] as const;

/** Status kehadiran dari persentase hari aktif melapor. */
export function attendance(pct: number) {
  if (pct >= 70) return { label: 'Aktif', tone: 'success' as const, bar: 'bg-success' };
  if (pct >= 40) return { label: 'Cukup', tone: 'warn' as const, bar: 'bg-warn' };
  return { label: 'Kurang', tone: 'danger' as const, bar: 'bg-danger' };
}
