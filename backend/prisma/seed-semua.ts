/**
 * Jalankan seluruh seeder pengembangan berurutan (JANGAN di produksi): data dasar, wilayah + desa
 * seluruh Indonesia, laporan Polres Contoh + fotonya, laporan nasional, agregat, dan absensi.
 *
 *   npm run seed:semua                  # membuat ulang semua data contoh (data lama dihapus)
 *   npm run seed:semua -- --tanpa-desa  # lewati impor desa (lebih cepat bila desa sudah ada)
 *
 * Argumen lain diteruskan ke seed:demo-nasional, mis. `--hari=60 --per-hari=1 --prov=32,33`.
 */
import { execSync } from 'child_process';

if (process.env.NODE_ENV === 'production') throw new Error('Seed demo tidak boleh dijalankan di produksi');
const args = process.argv.slice(2);
const nasional = args.filter((a) => /^--(hari|per-hari|prov)=/.test(a)).join(' ');

const steps: [string, string][] = [
  ['Data dasar (unit contoh, akun peran, komoditas, skema)', 'npm run -s seed'],
  ...(args.includes('--tanpa-desa') ? [] : [['Batas wilayah + desa seluruh Indonesia', 'npm run -s seed:wilayah -- --desa=all'] as [string, string]]),
  ['Hapus laporan contoh nasional lama', 'npm run -s seed:demo-nasional -- --hapus'],
  ['Laporan Polres Contoh', 'npm run -s seed:demo -- --reset'],
  ['Foto laporan Polres Contoh', 'npm run -s seed:demo-attachments -- --reset'],
  ['Laporan contoh nasional', `npm run -s seed:demo-nasional -- ${nasional}`],
  ['Agregat dashboard', 'npm run -s aggregates:rebuild'],
  ['Absensi contoh', 'npm run -s seed:demo-absensi'],
  ['Notifikasi dari laporan 7 hari terakhir', 'npm run -s notifications:isi'],
];

const t0 = Date.now();
steps.forEach(([label, cmd], i) => {
  console.log(`\n[${i + 1}/${steps.length}] ${label}`);
  const t = Date.now();
  execSync(cmd, { stdio: 'inherit' });
  console.log(`    selesai dalam ${Math.round((Date.now() - t) / 1000)} detik`);
});
console.log(`\nSemua seeder selesai dalam ${Math.round((Date.now() - t0) / 60_000 * 10) / 10} menit.`);
