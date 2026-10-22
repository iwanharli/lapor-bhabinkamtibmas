/**
 * Data contoh laporan untuk pengembangan dashboard web (JANGAN dijalankan di produksi).
 * Membuat ±30 hari laporan dari beberapa Bhabin di dua Polsek, termasuk tren harga pangan.
 *   npm run seed:demo           # lewati bila sudah ada laporan
 *   npm run seed:demo -- --reset
 */
import { PrismaClient, ReportCategory as C, ReportStatus as S, StockStatus, UnitLevel, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { dataFor, int, pick, PREFIX, price, rnd } from './demo/report-data';

const prisma = new PrismaClient();

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
    create: { nrp: '90000006', nama: 'Pimpinan Polsek Utara', pangkat: 'AKP', role: UserRole.PIMPINAN, unitId: polsek2.id, passwordHash: hash, mustChangePassword: false },
  });

  return {
    polresId: polres.id,
    bhabins: [
      await bhabin('90000001', 'Contoh Bhabin', polsek1.id, villages1),
      await bhabin('90000011', 'Dedi Kurniawan', polsek1.id, [villages1[1]]),
      await bhabin('90000012', 'Rina Wulandari', polsek2.id, [villages2[0]]),
      await bhabin('90000013', 'Agus Salim', polsek2.id, [villages2[1]]),
    ],
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

  const { polresId, bhabins } = await ensureStructure();
  const commodities = await prisma.commodity.findMany({ where: { active: true } });
  const schemas = await prisma.formSchema.findMany({ where: { status: 'ACTIVE' } });
  const version = Object.fromEntries(schemas.map((s) => [s.category, s.version]));
  const counters = new Map<string, number>();
  const centers = [[-6.5951, 106.8162], [-6.6013, 106.8051], [-6.5702, 106.8311], [-6.5604, 106.8455]];
  const weights: C[] = [C.SAMBANG, C.SAMBANG, C.SAMBANG, C.HARGA_PANGAN, C.HARGA_PANGAN, C.DETEKSI_DINI, C.MAPPING_KK, C.KETAHANAN_PANGAN, C.PROBLEM_SOLVING];

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

        const { data, priority = false } = dataFor(cat, daysAgo);
        const [clat, clng] = centers[bi];
        const mock = rnd() < 0.02;
        const submittedAt = new Date(occurredAt.getTime() + int(5, 90) * 60_000);

        await prisma.report.create({
          data: {
            clientUuid: randomUUID(), nomor: `${PREFIX[cat]}-POLRES-CONTOH-${period}-${String(no).padStart(5, '0')}`,
            category: cat, schemaVersion: version[cat] ?? 1, userId: b.user.id, unitId: b.unitId, villageId: pick(b.villages).id,
            status: S.SUBMITTED, priority, data, occurredAt, lat: clat + (rnd() - 0.5) * 0.02, lng: clng + (rnd() - 0.5) * 0.02,
            gpsAccuracyM: Math.round(4 + rnd() * 30), isMockLocation: mock, insideVillage: mock ? false : rnd() > 0.04,
            submittedAt, receivedAt: submittedAt,
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
