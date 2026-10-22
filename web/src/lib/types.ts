/** Bentuk data respons API yang dipakai dashboard. */

export interface Paged<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

export interface PersonRef {
  nama: string;
  pangkat: string | null;
}

// ===== Laporan =====

export interface ReportListItem {
  id: string;
  nomor: string;
  category: string;
  status: string;
  priority: boolean;
  occurredAt: string;
  insideVillage: boolean | null;
  isMockLocation: boolean;
  user: PersonRef & { id: string; nrp: string };
  village: { id: string; nama: string; kecamatan: string };
  unit: { id: string; nama: string; timezone: string };
  _count: { attachments: number };
}

export interface SchemaField {
  key: string;
  label: string;
  type: string;
  sensitive?: boolean;
}

export interface ReportPriceItem {
  harga: number;
  satuan: string;
  stok: 'AMAN' | 'MENIPIS' | 'KOSONG';
  commodity: { id: number; nama: string };
}

export interface StatusHistoryEntry {
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  at: string;
  actor: PersonRef & { role: string };
}

export interface ReportAttachment {
  id: string;
  fieldKey: string;
  mime: string;
  sizeBytes: number;
  source: 'CAMERA' | 'FILE';
  capturedAt: string | null;
  watermarked: boolean;
  hasThumb: boolean;
}

export interface ReportDetail extends ReportListItem {
  submittedAt: string | null;
  receivedAt: string;
  lat: number;
  lng: number;
  gpsAccuracyM: number | null;
  data: Record<string, unknown>;
  schema: { title: string; fields: SchemaField[] } | null;
  items: ReportPriceItem[];
  attachments: ReportAttachment[];
  history: StatusHistoryEntry[];
  /** Batas pelapor boleh meralat laporan terkirim (null bila draft). */
  editableUntil: string | null;
  /** Field sensitif yang terisi (isinya hanya lewat reveal-sensitive). */
  sensitiveFilled: string[];
  canRevealSensitive: boolean;
}

// ===== Analitik =====

export interface Overview {
  range: { from: string; to: string; days: number };
  totals: {
    total: number;
    prioritas: number;
    lokasi_janggal: number;
    bhabinAktif: number;
    totalBhabin: number;
    tidakAktif7: number;
  };
  previous: { total: number; bhabinAktif: number };
  byCategory: { category: string; jumlah: number }[];
  daily: { hari: string; category: string; jumlah: number }[];
  priority: {
    id: string;
    nomor: string;
    occurredAt: string;
    data: { kategori_kerawanan?: string };
    village: { nama: string };
    user: { nama: string };
    unit: { timezone: string };
  }[];
}

export interface LatestPrice {
  commodity_id: number;
  nama: string;
  satuan: string;
  rata2: number | null;
  minimum: number | null;
  maksimum: number | null;
  sampel: number;
  rata2_sebelumnya: number | null;
  stok_menipis: number;
  stok_kosong: number;
}

export interface PriceTrendRow {
  hari: string;
  commodity_id: number;
  rata2: number;
}

export interface PriceAreaRow {
  kecamatan: string;
  desa: string;
  rata2: number;
  sampel: number;
  terakhir: string;
}

// ===== Administrasi =====

/** Simpul pohon unit dari /units/children. */
export interface UnitNode {
  id: string;
  parentId: string | null;
  level: string;
  kode: string;
  nama: string;
  timezone: string;
  childCount: number;
  /** Jumlah langsung di unit ini (bukan termasuk turunan). */
  counts: { users: number; bhabin: number; villages: number };
}

export interface UnitSummary {
  polda: number;
  polres: number;
  polsek: number;
  users: number;
  bhabin: number;
  villages: number;
  polsek_tanpa_bhabin: number;
}

export interface UnitOption {
  id: string;
  parentId: string | null;
  level: string;
  kode: string;
  nama: string;
  timezone?: string;
  /** Jumlah langsung di unit ini (bukan termasuk turunan). */
  counts?: { users: number; bhabin: number; villages: number };
}

export interface VillageOption {
  id: string;
  nama: string;
  kecamatan: string;
  kabupaten: string;
  polsekId: string | null;
}

export interface UserListItem extends PersonRef {
  id: string;
  nrp: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  unit: { nama: string };
}

export interface UserDetail extends UserListItem {
  jabatan: string | null;
  phone: string | null;
  unitId: string;
  unit: { nama: string; level: string };
  mustChangePassword: boolean;
  lockedUntil: string | null;
  createdAt: string;
  villages: { since: string; village: { id: string; nama: string } }[];
}

export interface DeviceRow {
  id: string;
  platform: string;
  model: string | null;
  appVersion: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
}
