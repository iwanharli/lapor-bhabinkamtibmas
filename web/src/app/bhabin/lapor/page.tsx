import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { activeSchemas, slugOf } from '@/features/bhabin/data';
import { CategoryIcon } from '@/features/reports/category-icon';

const HINT: Record<string, string> = {
  SAMBANG: 'Kunjungan & sambang warga, tokoh, perangkat desa',
  DETEKSI_DINI: 'Potensi gangguan kamtibmas — urgensi tinggi jadi prioritas',
  PROBLEM_SOLVING: 'Mediasi & penyelesaian masalah warga',
  HARGA_PANGAN: 'Harga & stok komoditas di pasar/kios',
  MAPPING_KK: 'Pendataan data keluarga di desa binaan',
  KETAHANAN_PANGAN: 'Kegiatan & lahan ketahanan pangan',
};

export default async function PilihKategoriPage() {
  const schemas = await activeSchemas();
  return (
    <>
      <h1 className="text-xl font-bold">Buat laporan</h1>
      <p className="mb-4 text-sm text-muted">Pilih jenis kegiatan yang dilaporkan.</p>
      <ul className="space-y-2.5">
        {schemas.map((s) => (
          <li key={s.category}>
            <Link href={`/bhabin/lapor/${slugOf(s.category)}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-sm transition active:scale-[0.99] hover:border-primary/40">
              <CategoryIcon category={s.category} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{s.title}</span>
                <span className="block truncate text-xs text-muted">{HINT[s.category] ?? ''}</span>
              </span>
              <ChevronRight size={18} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
