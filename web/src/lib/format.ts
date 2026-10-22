export const CATEGORY_LABEL: Record<string, string> = {
  SAMBANG: 'Sambang / DDS',
  DETEKSI_DINI: 'Deteksi Dini',
  PROBLEM_SOLVING: 'Problem Solving',
  PENYULUHAN: 'Penyuluhan',
  HARGA_PANGAN: 'Harga Pangan',
  MAPPING_KK: 'Mapping KK',
  KETAHANAN_PANGAN: 'Ketahanan Pangan',
};

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Terkirim',
  IN_REVIEW: 'Ditinjau',
  NEEDS_REVISION: 'Perlu Revisi',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
};

export const ROLE_LABEL: Record<string, string> = {
  BHABIN: 'Bhabinkamtibmas',
  VERIFIKATOR: 'Verifikator',
  PIMPINAN: 'Pimpinan',
  ADMIN_UNIT: 'Admin Unit',
  SUPERADMIN: 'Superadmin',
  AUDITOR: 'Auditor',
};

const TZ = 'Asia/Jakarta';

export const rupiah = (n: number | null | undefined) => (n == null ? '—' : `Rp ${n.toLocaleString('id-ID')}`);

export const tanggalJam = (d: string | Date) =>
  new Date(d).toLocaleString('id-ID', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';

export const tanggal = (d: string | Date) =>
  new Date(d).toLocaleDateString('id-ID', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });

export const persen = (now: number | null, prev: number | null) =>
  now == null || !prev ? null : Math.round(((now - prev) / prev) * 1000) / 10;

/** Nilai isian form menjadi teks tampilan. */
export function displayValue(v: unknown): string {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'number') return v.toLocaleString('id-ID');
  return String(v);
}

export const personName = (p: { pangkat?: string | null; nama: string }) => [p.pangkat, p.nama].filter(Boolean).join(' ');

/** Waktu relatif singkat: "baru saja", "5 menit lalu", "3 hari lalu"; lebih dari 30 hari → tanggal. */
export function relatif(d: string | Date) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'baru saja';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const day = Math.round(h / 24);
  if (day <= 30) return `${day} hari lalu`;
  return tanggal(d);
}
