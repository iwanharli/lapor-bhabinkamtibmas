export interface VillageRow {
  id: string;
  kodeWilayah: string;
  nama: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  polsekId: string | null;
  polsek: string | null;
  hasGeometry: boolean;
  luasKm2: number | null;
  bhabin: number;
  laporan: number;
}

export interface VillageStats {
  total: number;
  dengan_batas: number;
  tanpa_bhabin: number;
}

export interface VillageGeoJson {
  type: 'FeatureCollection';
  /** Jumlah desa berbatas dalam cakupan; `truncated` bila terlalu banyak untuk digambar (pilih Polsek dulu). */
  total?: number;
  truncated?: boolean;
  features: { type: 'Feature'; id: string; properties: { id: string; nama: string; kecamatan: string }; geometry: GeoJSON.Geometry }[];
}
