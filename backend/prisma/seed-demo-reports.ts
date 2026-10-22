/**
 * Data contoh laporan untuk pengembangan dashboard web (JANGAN dijalankan di produksi).
 * Membuat ±30 hari laporan dari beberapa Bhabin di dua Polsek, termasuk tren harga pangan.
 *   npm run seed:demo           # lewati bila sudah ada laporan
 *   npm run seed:demo -- --reset
 */
import { Prisma, PrismaClient, ReportCategory as C, ReportStatus as S, StockStatus, UnitLevel, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// PRNG deterministik agar data contoh selalu sama.
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

const PREFIX: Record<C, string> = {
  SAMBANG: 'SB', DETEKSI_DINI: 'DD', PROBLEM_SOLVING: 'PS', PENYULUHAN: 'PY',
  HARGA_PANGAN: 'HP', MAPPING_KK: 'KK', KETAHANAN_PANGAN: 'KP',
};

const BASE_PRICE: Record<string, number> = {
  BERAS_MEDIUM: 13200, BERAS_PREMIUM: 15500, MINYAK_CURAH: 16500, MINYAK_KEMASAN: 18500,
  GULA_PASIR: 17800, CABAI_MERAH: 42000, CABAI_RAWIT: 55000, BAWANG_MERAH: 36000,
  BAWANG_PUTIH: 40000, TELUR_AYAM: 29000, DAGING_SAPI: 135000, DAGING_AYAM: 37000,
};

const WARGA = ['Budi Santoso', 'Siti Aminah', 'Ahmad Fauzi', 'Dewi Lestari', 'Joko Susilo', 'Rina Marlina', 'H. Ma\'ruf', 'Ust. Hasan', 'Pak RT Darto', 'Yanti Sukaesih'];

function dataFor(cat: C, day: number): { data: Prisma.InputJsonObject; priority?: boolean } {
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
    case C.MAPPING_KK:
      return { data: {
        nama_kk: pick(WARGA), jumlah_anggota: int(1, 7), alamat: `RT 0${int(1, 9)} / RW 0${int(1, 5)}`,
        kondisi_hunian: pick(['Layak', 'Layak', 'Perlu Perhatian', 'Dalam Pemantauan']),
      } };
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
function price(kode: string, daysAgo: number) {
  const trend = 1 + (30 - daysAgo) * 0.001;
  const spike = kode.startsWith('CABAI') && daysAgo < 7 ? 1 + (7 - daysAgo) * 0.05 : 1;
  const noise = 0.95 + rnd() * 0.1;
  return Math.round((BASE_PRICE[kode] * trend * spike * noise) / 100) * 100;
}

function statusFor(daysAgo: number): S {
  if (daysAgo <= 1) return pick([S.SUBMITTED, S.SUBMITTED, S.IN_REVIEW]);
  if (daysAgo <= 4) return pick([S.SUBMITTED, S.IN_REVIEW, S.APPROVED, S.APPROVED, S.NEEDS_REVISION]);
  return pick([S.APPROVED, S.APPROVED, S.APPROVED, S.APPROVED, S.APPROVED, S.NEEDS_REVISION, S.REJECTED]);
}

async function ensureStructure() {
  const polres = await prisma.unit.findUniqueOrThrow({ where: { kode: 'POLRES-CONTOH' } });
  const polsek1 = await prisma.unit.findUniqueOrThrow({ where: { kode: 'POLSEK-CONTOH' } });
  const polsek2 = await prisma.unit.upsert({
    where: { kode: 'POLSEK-CONTOH-2' }, update: {},
    create: { kode: 'POLSEK-CONTOH-2', nama: 'Polsek Contoh Utara', level: UnitLevel.POLSEK, parentId: polres.id },
  });

  const village = (kode: string, nama: string, kecamatan: string, polsekId: string) =>
    prisma.village.upsert({
      where: { kodeWilayah: kode }, update: {},
      create: { kodeWilayah: kode, nama, kecamatan, kabupaten: 'Kabupaten Contoh', provinsi: 'Provinsi Contoh', polsekId },
    });
  const villages1 = [await village('99.01.01.2001', 'Sukamaju', 'Kecamatan Contoh', polsek1.id), await village('99.01.01.2002', 'Harapan', 'Kecamatan Contoh', polsek1.id)];
  const villages2 = [await village('99.01.02.2001', 'Mekarsari', 'Kecamatan Utara', polsek2.id), await village('99.01.02.2002', 'Cijaya', 'Kecamatan Utara', polsek2.id)];

  const hash = await argon2.hash('Demo#12345', { type: argon2.argon2id });
  const bhabin = async (nrp: string, nama: string, unitId: string, vs: { id: string }[]) => {
    const u = await prisma.user.upsert({
      where: { nrp }, update: {},
      create: { nrp, nama, pangkat: nrp === '90000012' ? 'Brigpol' : 'Bripka', role: UserRole.BHABIN, unitId, passwordHash: hash, mustChangePassword: false },
    });
    await prisma.userVillage.createMany({ data: vs.map((v) => ({ userId: u.id, villageId: v.id, since: new Date('2026-01-01') })), skipDuplicates: true });
    return { user: u, villages: vs, unitId };
  };
  await prisma.user.upsert({
    where: { nrp: '90000006' }, update: {},
    create: { nrp: '90000006', nama: 'Verifikator Utara', pangkat: 'Aiptu', role: UserRole.VERIFIKATOR, unitId: polsek2.id, passwordHash: hash, mustChangePassword: false },
  });

  return {
    polresId: polres.id,
    bhabins: [
      await bhabin('90000001', 'Contoh Bhabin', polsek1.id, villages1),
      await bhabin('90000011', 'Dedi Kurniawan', polsek1.id, [villages1[1]]),
      await bhabin('90000012', 'Rina Wulandari', polsek2.id, [villages2[0]]),
      await bhabin('90000013', 'Agus Salim', polsek2.id, [villages2[1]]),
    ],
    verifiers: await prisma.user.findMany({ where: { role: UserRole.VERIFIKATOR } }),
  };
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed demo tidak boleh dijalankan di produksi');

  if (process.argv.includes('--reset')) {
    await prisma.$transaction([
      prisma.reportStatusHistory.deleteMany(), prisma.reportItem.deleteMany(), prisma.attachment.deleteMany(),
      prisma.report.deleteMany(), prisma.reportCounter.deleteMany(),
    ]);
  } else if (await prisma.report.count()) {
    console.log('Laporan sudah ada, dilewati (gunakan --reset untuk membuat ulang).');
    return;
  }

  const { polresId, bhabins, verifiers } = await ensureStructure();
  const commodities = await prisma.commodity.findMany({ where: { active: true } });
  const schemas = await prisma.formSchema.findMany({ where: { status: 'ACTIVE' } });
  const version = Object.fromEntries(schemas.map((s) => [s.category, s.version]));
  const counters = new Map<string, number>();
  const centers = [[-6.5951, 106.8162], [-6.6013, 106.8051], [-6.5702, 106.8311], [-6.5604, 106.8455]];
  const weights: C[] = [C.SAMBANG, C.SAMBANG, C.SAMBANG, C.HARGA_PANGAN, C.HARGA_PANGAN, C.DETEKSI_DINI, C.MAPPING_KK, C.KETAHANAN_PANGAN, C.PROBLEM_SOLVING, C.PENYULUHAN];

  let total = 0;
  for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
    for (const [bi, b] of bhabins.entries()) {
      const n = int(1, 3);
      for (let k = 0; k < n; k++) {
        const cat = pick(weights);
        const occurredAt = new Date(Date.now() - daysAgo * 86_400_000);
        occurredAt.setHours(int(7, 16), int(0, 59), 0, 0);
        if (occurredAt > new Date()) occurredAt.setTime(Date.now() - int(10, 300) * 60_000);

        const period = `${String(occurredAt.getFullYear()).slice(2)}${String(occurredAt.getMonth() + 1).padStart(2, '0')}`;
        const key = `${cat}-${period}`;
        const no = (counters.get(key) ?? 0) + 1;
        counters.set(key, no);

        const status = statusFor(daysAgo);
        const { data, priority = false } = dataFor(cat, daysAgo);
        const [clat, clng] = centers[bi];
        const mock = rnd() < 0.02;
        const verifier = verifiers.find((v) => v.unitId === b.unitId) ?? verifiers[0];
        const decided = status === S.APPROVED || status === S.NEEDS_REVISION || status === S.REJECTED;
        const note = status === S.NEEDS_REVISION ? 'Foto kurang jelas, mohon diulang.' : status === S.REJECTED ? 'Laporan duplikat dengan laporan sebelumnya.' : null;
        const submittedAt = new Date(occurredAt.getTime() + int(5, 90) * 60_000);
        const reviewedAt = new Date(submittedAt.getTime() + int(1, 20) * 3_600_000);

        await prisma.report.create({
          data: {
            clientUuid: randomUUID(), nomor: `${PREFIX[cat]}-POLRES-CONTOH-${period}-${String(no).padStart(5, '0')}`,
            category: cat, schemaVersion: version[cat] ?? 1, userId: b.user.id, unitId: b.unitId, villageId: pick(b.villages).id,
            status, priority, data, occurredAt, lat: clat + (rnd() - 0.5) * 0.02, lng: clng + (rnd() - 0.5) * 0.02,
            gpsAccuracyM: Math.round(4 + rnd() * 30), isMockLocation: mock, insideVillage: mock ? false : rnd() > 0.04,
            submittedAt, receivedAt: submittedAt,
            ...(decided && { reviewedById: verifier.id, reviewedAt, reviewNote: note }),
            ...(cat === C.HARGA_PANGAN && {
              items: {
                create: commodities.filter(() => rnd() > 0.25).map((c) => {
                  const harga = price(c.kode, daysAgo);
                  const stok: StockStatus = c.kode.startsWith('CABAI') && daysAgo < 5 ? pick(['MENIPIS', 'MENIPIS', 'KOSONG', 'AMAN'] as const) : pick(['AMAN', 'AMAN', 'AMAN', 'MENIPIS'] as const);
                  return { commodityId: c.id, harga, satuan: c.satuanDefault, stok };
                }),
              },
            }),
            history: {
              create: [
                { fromStatus: S.DRAFT, toStatus: S.SUBMITTED, actorId: b.user.id, at: submittedAt },
                ...(status !== S.SUBMITTED ? [{ fromStatus: S.SUBMITTED, toStatus: S.IN_REVIEW, actorId: verifier.id, at: new Date(reviewedAt.getTime() - 600_000) }] : []),
                ...(decided ? [{ fromStatus: S.IN_REVIEW, toStatus: status, actorId: verifier.id, note, at: reviewedAt }] : []),
              ],
            },
          },
        });
        total++;
      }
    }
  }

  for (const [key, lastNo] of counters) {
    const [category, period] = key.split('-') as [C, string];
    await prisma.reportCounter.upsert({
      where: { unitId_category_period: { unitId: polresId, category, period } },
      create: { unitId: polresId, category, period, lastNo }, update: { lastNo },
    });
  }
  console.log(`${total} laporan contoh dibuat.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
