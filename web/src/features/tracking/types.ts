export type LiveStatus = 'aktif' | 'terputus' | 'belum_ada_titik' | 'selesai';

export interface LivePerson {
  user_id: string; nrp: string; nama: string; pangkat: string | null; unit: string;
  check_in: string; check_out: string | null; last_time: string | null; lat: number | null; lng: number | null;
  acc: number | null; mock: boolean | null; status: LiveStatus;
}

export interface LiveResponse {
  date: string; staleMinutes: number; data: LivePerson[];
  summary: { dinas: number; aktif: number; terputus: number; selesai: number };
}

export const STATUS: Record<LiveStatus, { label: string; color: string; dot: string }> = {
  aktif: { label: 'Aktif', color: '#16a34a', dot: 'bg-success' },
  terputus: { label: 'Terputus', color: '#d97706', dot: 'bg-warn' },
  belum_ada_titik: { label: 'Belum ada titik', color: '#d97706', dot: 'bg-warn' },
  selesai: { label: 'Selesai dinas', color: '#64748b', dot: 'bg-muted' },
};
