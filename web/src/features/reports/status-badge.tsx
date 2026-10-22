import { Badge } from '@/components/ui';

/** Draft hanya terlihat oleh pelapornya; laporan terkirim langsung final (tanpa verifikasi). */
export function StatusBadge({ status }: { status: string }) {
  return status === 'DRAFT' ? <Badge tone="neutral">Draft</Badge> : <Badge tone="info">Terkirim</Badge>;
}

export function PriorityBadge() {
  return <Badge tone="danger" strong className="text-[10px]">Prioritas</Badge>;
}

/** Hasil cek lokasi otomatis: titik laporan terhadap desa binaan & deteksi lokasi palsu. */
export function LocationBadge({ insideVillage, isMockLocation }: { insideVillage: boolean | null; isMockLocation: boolean }) {
  if (isMockLocation) return <Badge tone="danger">Lokasi palsu</Badge>;
  if (insideVillage === false) return <Badge tone="warn">Di luar desa</Badge>;
  if (insideVillage) return <Badge tone="success">Sesuai desa</Badge>;
  return <Badge tone="neutral">Tanpa batas desa</Badge>;
}
