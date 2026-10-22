import type { BadgeTone } from '@/components/ui';

/** Label & warna aksi audit. Aksi yang belum terdaftar tampil apa adanya. */
export const ACTION_META: Record<string, { label: string; tone: BadgeTone }> = {
  LOGIN: { label: 'Masuk', tone: 'success' },
  LOGIN_FAILED: { label: 'Gagal masuk', tone: 'danger' },
  LOGOUT: { label: 'Keluar', tone: 'neutral' },
  TOKEN_REUSE_DETECTED: { label: 'Token dipakai ulang', tone: 'danger' },
  PASSWORD_CHANGED: { label: 'Ganti sandi', tone: 'info' },
  REPORT_IN_REVIEW: { label: 'Laporan ditinjau', tone: 'warn' },
  REPORT_APPROVED: { label: 'Laporan disetujui', tone: 'success' },
  REPORT_NEEDS_REVISION: { label: 'Minta revisi', tone: 'orange' },
  REPORT_REJECTED: { label: 'Laporan ditolak', tone: 'danger' },
  ATTACHMENT_UPLOAD: { label: 'Unggah lampiran', tone: 'info' },
  ATTACHMENT_DOWNLOAD: { label: 'Buka lampiran', tone: 'neutral' },
  EXPORT_CREATE: { label: 'Ekspor data', tone: 'warn' },
  USER_CREATE: { label: 'Tambah pengguna', tone: 'success' },
  USER_UPDATE: { label: 'Ubah pengguna', tone: 'info' },
  USER_IMPORT: { label: 'Impor pengguna', tone: 'success' },
  USER_RESET_PASSWORD: { label: 'Reset sandi', tone: 'warn' },
  USER_SET_VILLAGES: { label: 'Atur desa binaan', tone: 'info' },
  DEVICE_REVOKE: { label: 'Cabut perangkat', tone: 'danger' },
  UNIT_CREATE: { label: 'Tambah unit', tone: 'success' },
  VILLAGE_CREATE: { label: 'Tambah desa', tone: 'success' },
  VILLAGE_GEOMETRY_SET: { label: 'Ubah batas desa', tone: 'info' },
  COMMODITY_UPDATE: { label: 'Ubah komoditas', tone: 'info' },
  SCHEMA_RETIRE: { label: 'Nonaktifkan formulir', tone: 'warn' },
  SENSITIVE_READ: { label: 'Buka data sensitif', tone: 'danger' },
};

export const actionLabel = (a: string) => ACTION_META[a]?.label ?? a;
