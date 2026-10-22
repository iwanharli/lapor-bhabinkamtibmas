/** Pembuat isi laporan contoh bersama untuk seed:demo dan seed:demo-nasional. */
import { Prisma, ReportCategory as C } from '@prisma/client';

// PRNG deterministik agar data contoh selalu sama.
let seed = 42;
export const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
export const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
export const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

export const PREFIX: Record<C, string> = {
  SAMBANG: 'SB', DETEKSI_DINI: 'DD', PROBLEM_SOLVING: 'PS', PENYULUHAN: 'PY',
  HARGA_PANGAN: 'HP', MAPPING_KK: 'KK', KETAHANAN_PANGAN: 'KP',
};

export const BASE_PRICE: Record<string, number> = {
  BERAS_MEDIUM: 13200, BERAS_PREMIUM: 15500, MINYAK_CURAH: 16500, MINYAK_KEMASAN: 18500,
  GULA_PASIR: 17800, CABAI_MERAH: 42000, CABAI_RAWIT: 55000, BAWANG_MERAH: 36000,
  BAWANG_PUTIH: 40000, TELUR_AYAM: 29000, DAGING_SAPI: 135000, DAGING_AYAM: 37000,
};

export const WARGA = ['Budi Santoso', 'Siti Aminah', 'Ahmad Fauzi', 'Dewi Lestari', 'Joko Susilo', 'Rina Marlina', 'H. Ma\'ruf', 'Ust. Hasan', 'Pak RT Darto', 'Yanti Sukaesih'];

export function dataFor(cat: C, day: number): { data: Prisma.InputJsonObject; priority?: boolean } {
  switch (cat) {
    case C.SAMBANG:
      return { data: {
        jenis_sasaran: pick(['Warga', 'Tokoh Masyarakat', 'Tokoh Agama', 'Perangkat Desa', 'Tokoh Pemuda']),
        nama_sasaran: pick(WARGA), alamat: `RT 0${int(1, 9)} / RW 0${int(1, 5)}`,
        pesan_kamtibmas: [pick(['Pencurian', 'Penipuan', 'Narkoba', 'Judi Online']), pick(['Kenakalan Remaja', 'Karhutla'])],
        tanggapan: pick(['Warga menyambut baik dan akan meningkatkan ronda malam.', 'Warga meminta patroli lebih sering di malam hari.', 'Tokoh setuju menyampaikan pesan pada pengajian.']),
      } };
    case C.DETEKSI_DINI: {
      const urgensi = pick(['Rendah', 'Rendah', 'Sedang', 'Sedang', 'Tinggi']);
      return { priority: urgensi === 'Tinggi', data: {
        kategori_kerawanan: pick(['Sengketa Lahan', 'Gesekan Antarkelompok', 'Bencana Alam', 'Kriminalitas']),
        urgensi,
        uraian: pick([
          'Terdapat ketegangan antara dua kelompok pemuda terkait batas wilayah parkir pasar.',
          'Warga melaporkan rencana pengerahan massa terkait sengketa lahan garapan.',
          'Debit sungai naik signifikan, beberapa rumah di bantaran berpotensi tergenang.',
          'Maraknya pencurian sepeda motor di sekitar area masjid pada malam hari.',
        ]),
        perkiraan_massa: int(5, 80),
      } };
    }
    case C.PROBLEM_SOLVING:
      return { data: {
        pihak_1_nama: pick(WARGA), pihak_2_nama: pick(WARGA),
        pokok_masalah: pick(['Batas Tanah', 'Perkelahian', 'Utang-Piutang Ringan']),
        uraian: 'Kedua pihak dipertemukan di balai desa bersama kepala desa.',
        hasil: pick(['Tercapai Kesepakatan', 'Tercapai Kesepakatan', 'Mediasi Lanjutan', 'Lanjut Proses Hukum']),
      } };
    case C.PENYULUHAN:
      return { data: {
        jenis: pick(['Pembinaan Siskamling', 'Penyuluhan Tematik']), tema: pick(['Antinarkoba', 'Bijak Bermedsos', 'Kenakalan Remaja']),
        lokasi: pick(['Poskamling RW 02', 'Balai Desa', 'Aula SMPN 1']), jumlah_peserta: int(10, 120),
      } };
    case C.MAPPING_KK: {
      // Skema v2 (bertahap): KK & alamat, hunian, kepala keluarga, anggota keluarga. NIK/No KK tidak diisi di data contoh.
      const kerja = () => pick(['Petani/Pekebun', 'Pedagang', 'Wiraswasta', 'Buruh Harian Lepas', 'Karyawan Swasta', 'Mengurus Rumah Tangga', 'Pegawai Negeri Sipil (PNS)']);
      const ket: Record<string, string> = { Pedagang: 'Sayur di pasar desa', Wiraswasta: 'Bengkel motor', 'Karyawan Swasta': 'PT Sumber Makmur', 'Pegawai Negeri Sipil (PNS)': 'Dinas Pendidikan' };
      const job = (p: string) => ({ [`${p}pekerjaan`]: kerja() });
      const withKet = (o: Record<string, string>, p: string): Record<string, string> => ({ ...o, ...(ket[o[`${p}pekerjaan`] as string] ? { [`${p}pekerjaan_ket`]: ket[o[`${p}pekerjaan`] as string] } : {}) });
      const kk = withKet({ kk_nama: pick(WARGA), kk_jenis_kelamin: 'Laki-laki', kk_pendidikan: pick(['Tamat SD/Sederajat', 'SLTP/Sederajat', 'SLTA/Sederajat']), ...job('kk_') }, 'kk_');
      const anggota = Array.from({ length: int(0, 4) }, (_, i) => withKet({
        nama: pick(WARGA), hubungan: i === 0 ? 'Istri' : 'Anak', jenis_kelamin: i === 0 ? 'Perempuan' : pick(['Laki-laki', 'Perempuan']),
        ...(i === 0 ? { pekerjaan: 'Mengurus Rumah Tangga' } : { pekerjaan: pick(['Pelajar/Mahasiswa', 'Belum/Tidak Bekerja', 'Pedagang']) }),
      }, ''));
      return { data: {
        alamat: `Jl. ${pick(['Melati', 'Mawar', 'Kenanga', 'Flamboyan'])} No. ${int(1, 120)}`, satuan_wilayah: 'RT/RW', rt: `0${int(1, 9)}`, rw: `0${int(1, 5)}`,
        status_kepemilikan: pick(['Milik sendiri', 'Milik sendiri', 'Sewa/Kontrak', 'Menumpang']),
        jenis_bangunan: pick(['Permanen', 'Permanen', 'Semi permanen', 'Tidak permanen']),
        kondisi_hunian: pick(['Layak', 'Layak', 'Perlu Perhatian', 'Tidak Layak']),
        ...kk, anggota: anggota as Prisma.InputJsonObject[],
      } };
    }
    case C.KETAHANAN_PANGAN:
      return { data: {
        jenis_usaha: pick(['Padi', 'Jagung', 'Hortikultura', 'Pekarangan Pangan', 'Perikanan']),
        nama_pengelola: `Kelompok Tani ${pick(['Makmur', 'Sejahtera', 'Subur', 'Harapan'])}`,
        luas_lahan_ha: Math.round(rnd() * 50) / 10 + 0.2, estimasi_produksi_ton: Math.round(rnd() * 80) / 10 + 0.5,
        kondisi: pick(['Berjalan', 'Berjalan', 'Perlu Pendampingan', 'Terhambat']), kendala: [pick(['Pupuk', 'Air/Irigasi', 'Hama'])],
      } };
    case C.HARGA_PANGAN:
      return { data: { jenis_lokasi: pick(['Pasar Tradisional', 'Kios/Agen Sembako']), nama_pasar: pick(['Pasar Harapan', 'Pasar Sentral', 'Pasar Pagi']), nama_kios: `Kios ${pick(['Berkah', 'Sumber Rezeki', 'Barokah'])}` } };
  }
}

/** Harga dengan tren ringan, dan cabai naik tajam di minggu terakhir. */
export function price(kode: string, daysAgo: number) {
  const trend = 1 + (30 - daysAgo) * 0.001;
  const spike = kode.startsWith('CABAI') && daysAgo < 7 ? 1 + (7 - daysAgo) * 0.05 : 1;
  const noise = 0.95 + rnd() * 0.1;
  return Math.round((BASE_PRICE[kode] * trend * spike * noise) / 100) * 100;
}


