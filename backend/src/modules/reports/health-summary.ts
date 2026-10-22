import { ageYears } from './report-validator';

/** Angka ringkas kesehatan keluarga dari isian Mapping lengkap (data biasa + rahasia). Tanpa nama/NIK. */
export interface HealthSummary {
  balita: number;
  stunting: number;
  berisiko: number;
  belum_ditangani: number;
  belum_diketahui: number;
  ibu_hamil: number;
  ibu_kek: number;
  remaja_anemia: number;
}

const HAMIL = ['Ibu hamil', 'Ibu hamil KEK/anemia'];
const RISK = ['Stunting', 'Berisiko stunting'];

/** Umur dihitung terhadap `at` (waktu kegiatan), sehingga angka mencerminkan kondisi saat pendataan. */
export function healthSummary(data: Record<string, unknown>, at = new Date()): HealthSummary {
  const h: HealthSummary = { balita: 0, stunting: 0, berisiko: 0, belum_ditangani: 0, belum_diketahui: 0, ibu_hamil: 0, ibu_kek: 0, remaja_anemia: 0 };
  const rows = (Array.isArray(data.anggota) ? data.anggota : []) as Record<string, unknown>[];
  for (const a of rows) {
    const umur = ageYears(a?.tanggal_lahir, at);
    if (umur != null && umur < 5) {
      h.balita++;
      const st = a.status_stunting as string | undefined;
      if (st === 'Stunting') h.stunting++;
      else if (st === 'Berisiko stunting') h.berisiko++;
      else if (!st || st === 'Belum diketahui') h.belum_diketahui++;
      if (RISK.includes(st ?? '') && a.stunting_ditangani === 'Belum') h.belum_ditangani++;
    }
    const r = a?.risiko_ibu as string | undefined;
    if (HAMIL.includes(r ?? '')) h.ibu_hamil++;
    if (r === 'Ibu hamil KEK/anemia') h.ibu_kek++;
    if (r === 'Remaja putri anemia') h.remaja_anemia++;
  }
  const kk = data.kk_risiko_ibu as string | undefined;
  if (HAMIL.includes(kk ?? '')) h.ibu_hamil++;
  if (kk === 'Ibu hamil KEK/anemia') h.ibu_kek++;
  return h;
}
