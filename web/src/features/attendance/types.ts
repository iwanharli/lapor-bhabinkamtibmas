export interface AttendanceRow {
  user_id: string;
  nrp: string;
  nama: string;
  pangkat: string | null;
  unit: string;
  timezone: string;
  ci_id: string | null;
  ci_time: string | null;
  ci_inside: boolean | null;
  ci_distance: number | null;
  ci_mock: boolean | null;
  ci_late_sync: boolean | null;
  ci_selfie: string | null;
  ci_desa: string | null;
  terlambat: boolean;
  co_id: string | null;
  co_time: string | null;
  co_inside: boolean | null;
  co_mock: boolean | null;
  co_selfie: string | null;
  durasi_menit: number | null;
}

export interface AttendanceDaily {
  date: string;
  lateAfter: string;
  data: AttendanceRow[];
  meta: { page: number; limit: number; total: number };
  summary: { bhabin: number; hadir: number; terlambat: number; luar: number; palsu: number; pulang: number; filtered: number };
  /** Jumlah check-in per jam (waktu setempat). */
  hours: { jam: number; jumlah: number }[];
  /** Unit (Polsek) dengan persentase hadir terendah. */
  lowestUnits: { unit_id: string; unit: string; bhabin: number; hadir: number }[];
}
