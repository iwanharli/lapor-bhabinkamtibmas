export type LiveStatus = 'aktif' | 'terputus' | 'belum_ada_titik' | 'selesai';

export interface LivePerson {
  user_id: string; nrp: string; nama: string; pangkat: string | null; unit: string;
  check_in: string; check_out: string | null; last_time: string | null; lat: number | null; lng: number | null;
  acc: number | null; mock: boolean | null; battery: number | null; points: number; status: LiveStatus;
}

export interface LiveResponse {
  date: string; staleMinutes: number; retentionDays: number; data: LivePerson[];
  summary: { dinas: number; aktif: number; terputus: number; selesai: number };
}

export interface RouteResponse {
  user: { id: string; nrp: string; nama: string; pangkat: string | null };
  date: string; retentionDays: number; distanceKm: number;
  attendance: { type: 'CHECK_IN' | 'CHECK_OUT'; clientTime: string; lat: number; lng: number }[];
  points: { clientTime: string; lat: number; lng: number; gpsAccuracyM: number | null; isMockLocation: boolean }[];
}

export const STATUS: Record<LiveStatus, { label: string; color: string; dot: string }> = {
  aktif: { label: 'Aktif', color: '#16a34a', dot: 'bg-success' },
  terputus: { label: 'Terputus', color: '#d97706', dot: 'bg-warn' },
  belum_ada_titik: { label: 'Belum ada titik', color: '#d97706', dot: 'bg-warn' },
  selesai: { label: 'Selesai dinas', color: '#64748b', dot: 'bg-muted' },
};
