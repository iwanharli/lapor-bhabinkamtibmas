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
  dengan_polsek: number;
  kecamatan_tanpa_polsek: number;
  tanpa_bhabin: number;
}

export interface VillageGeoJson {
  type: 'FeatureCollection';
  /** Jumlah desa berbatas dalam cakupan; `truncated` bila terlalu banyak untuk digambar (pilih Polsek dulu). */
  total?: number;
  truncated?: boolean;
  features: { type: 'Feature'; id: string; properties: { id: string; nama: string; kecamatan: string }; geometry: GeoJSON.Geometry }[];
}

/** Satu wilayah di pohon desa (provinsi, kabupaten/kota, atau kecamatan). */
export interface RegionNode {
  kode: string;
  nama: string;
  level: number;
  desa: number;
  terbina: number;
  satuan: string[];
}

/** Polsek nasional yang belum terhubung ke kecamatan mana pun. */
export interface PolsekWithoutRegion {
  id: string;
  nama: string;
  polres: string;
  polda: string;
  lat: number | null;
  lng: number | null;
  kawasan: boolean;
}

/** Polsek yang wilayahnya ditetapkan manual oleh admin. */
export interface PolsekManual {
  id: string;
  nama: string;
  polres: string;
  polda: string;
  wilayah: { kode: string; nama: string; chain: string }[];
}
