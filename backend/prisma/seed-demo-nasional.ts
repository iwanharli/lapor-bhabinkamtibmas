/**
 * Data contoh laporan di SETIAP kabupaten/kota Indonesia (JANGAN dijalankan di produksi).
 * Memerlukan batas wilayah: `npm run seed:wilayah` lebih dulu.
 *
 *   npm run seed:demo-nasional              # buat (dilewati bila sudah ada)
 *   npm run seed:demo-nasional -- --hapus   # hapus seluruh data contoh nasional
 *
 * Struktur yang dibuat (kode unit berawalan DEMO-, NRP berawalan 98/99):
 *   Polda per provinsi (zona waktu WIB/WITA/WIT) › Polres & Polsek per kabupaten/kota,
 *   1 Bhabin per kabupaten/kota, 1 verifikator per Polda.
 * Desa binaan: desa asli Kemendagri bila sudah diimpor (seed:wilayah --desa=…), selain itu
 * desa contoh berkode 98.* dengan batas salah satu kecamatan di kabupaten/kota tersebut.
 * Titik laporan diacak di dalam batas desa, ±30 hari terakhir.
 */
import { PrismaClient, ReportCategory as C, ReportStatus as S, StockStatus, UnitLevel, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { dataFor, int, pick, PREFIX, price, rnd, statusFor } from './demo/report-data';

const prisma = new PrismaClient();
const DAYS = 30;
const PER_KAB: [number, number] = [4, 9];

const WITA = ['51', '52', '53', '63', '64', '65', '71', '72', '73', '74', '75', '76'];
const WIT = ['81', '82', '91', '92', '93', '94', '95', '96'];
const tzOf = (prov: string) => (WIT.includes(prov) ? 'Asia/Jayapura' : WITA.includes(prov) ? 'Asia/Makassar' : 'Asia/Jakarta');

const NAMA_DEPAN = ['Agus', 'Budi', 'Dedi', 'Eko', 'Fajar', 'Hendra', 'Iwan', 'Joko', 'Rahmat', 'Yusuf', 'Rina', 'Sari', 'Dewi', 'Made', 'Nyoman', 'Andi', 'La Ode', 'Frans', 'Yohanes', 'Teuku'];
const NAMA_BELAKANG = ['Saputra', 'Wijaya', 'Siregar', 'Nasution', 'Pratama', 'Hidayat', 'Kurniawan', 'Wibowo', 'Sinaga', 'Pangaribuan', 'Mahendra', 'Rumbiak', 'Kambu', 'Lestari', 'Rahman', 'Tanjung'];
const PANGKAT = ['Brigpol', 'Bripka', 'Aipda', 'Aiptu'];
const CATS: C[] = [C.SAMBANG, C.SAMBANG, C.SAMBANG, C.HARGA_PANGAN, C.HARGA_PANGAN, C.DETEKSI_DINI, C.DETEKSI_DINI, C.MAPPING_KK, C.KETAHANAN_PANGAN, C.PROBLEM_SOLVING];

/** Singkatan nama wilayah untuk kode unit: "32.71" → "3271". */
const digits = (kode: string) => kode.replace(/\./g, '');
const shortName = (nama: string) => nama.replace(/^Kabupaten (Administrasi )?/, '').replace(/^Kota (Administrasi )?/, 'Kota ');

async function hapus() {
  const units = await prisma.unit.findMany({ where: { kode: { startsWith: 'DEMO-' } }, select: { id: true } });
  const unitIds = units.map((u) => u.id);
  const users = await prisma.user.findMany({ where: { unitId: { in: unitIds } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const reports = await prisma.report.findMany({ where: { unitId: { in: unitIds } }, select: { id: true } });
  const reportIds = reports.map((r) => r.id);
  await prisma.$transaction([
    prisma.reportStatusHistory.deleteMany({ where: { reportId: { in: reportIds } } }),
    prisma.reportItem.deleteMany({ where: { reportId: { in: reportIds } } }),
    prisma.attachment.deleteMany({ where: { reportId: { in: reportIds } } }),
    prisma.report.deleteMany({ where: { id: { in: reportIds } } }),
    prisma.reportCounter.deleteMany({ where: { unitId: { in: unitIds } } }),
    prisma.userVillage.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.device.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    prisma.village.deleteMany({ where: { kodeWilayah: { startsWith: '98.' } } }),
    // Desa asli Kemendagri hanya dilepas dari Polsek contoh.
    prisma.village.updateMany({ where: { polsekId: { in: unitIds } }, data: { polsekId: null } }),
  ]);
  // Hapus dari Polsek ke atas karena relasi induk.
  for (const level of [UnitLevel.POLSEK, UnitLevel.POLRES, UnitLevel.POLDA]) {
    await prisma.unit.deleteMany({ where: { id: { in: unitIds }, level } });
  }
  await prisma.$executeRaw`DELETE FROM agg_unit_daily WHERE unit_id = ANY(${unitIds}::uuid[])`;
  await prisma.$executeRaw`DELETE FROM agg_user_daily WHERE unit_id = ANY(${unitIds}::uuid[])`;
  await prisma.$executeRaw`DELETE FROM agg_price_daily WHERE unit_id = ANY(${unitIds}::uuid[])`;
  console.log(`Dihapus: ${reportIds.length} laporan, ${userIds.length} pengguna, ${unitIds.length} unit contoh.`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed demo tidak boleh dijalankan di produksi');
  if (process.argv.includes('--hapus')) return hapus();
  if (await prisma.unit.count({ where: { kode: { startsWith: 'DEMO-POLDA-' } } })) {
    console.log('Data contoh nasional sudah ada (gunakan --hapus lalu jalankan ulang untuk membuat ulang).');
    return;
  }

  const mabes = await prisma.unit.findFirstOrThrow({ where: { level: UnitLevel.MABES } });
  const provinces = await prisma.$queryRaw<{ kode: string; nama: string }[]>`SELECT kode, nama FROM regions WHERE level = 1 ORDER BY kode`;
  if (!provinces.length) throw new Error('Batas wilayah belum ada; jalankan `npm run seed:wilayah` dulu.');

  const hash = await argon2.hash('Demo#12345', { type: argon2.argon2id });
  const commodities = await prisma.commodity.findMany({ where: { active: true } });
  const schemas = await prisma.formSchema.findMany({ where: { status: 'ACTIVE' } });
  const version = Object.fromEntries(schemas.map((s) => [s.category, s.version]));
  const t0 = Date.now();
  let totalReports = 0;
  let realVillages = 0;
  let kabCount = 0;

  for (const prov of provinces) {
    const timezone = tzOf(prov.kode);
    const polda = await prisma.unit.create({
      data: { kode: `DEMO-POLDA-${prov.kode}`, nama: `Polda ${prov.nama}`, level: UnitLevel.POLDA, parentId: mabes.id, timezone },
    });
    const verifier = await prisma.user.create({
      data: {
        nrp: `99${prov.kode.padStart(6, '0')}`, nama: `Verifikator ${prov.nama}`, pangkat: 'Iptu', role: UserRole.VERIFIKATOR,
        unitId: polda.id, passwordHash: hash, mustChangePassword: false,
      },
    });

    const kabs = await prisma.$queryRaw<{ kode: string; nama: string }[]>`SELECT kode, nama FROM regions WHERE parent_kode = ${prov.kode} ORDER BY kode`;
    for (const kab of kabs) {
      kabCount++;
      const polres = await prisma.unit.create({
        data: { kode: `DEMO-RES-${digits(kab.kode)}`, nama: `Polres ${shortName(kab.nama)}`, level: UnitLevel.POLRES, parentId: polda.id, timezone },
      });
      const polsek = await prisma.unit.create({
        data: { kode: `DEMO-SEK-${digits(kab.kode)}`, nama: `Polsek Kota ${shortName(kab.nama).replace(/^Kota /, '')}`, level: UnitLevel.POLSEK, parentId: polres.id, timezone },
      });

      // Desa asli (bila sudah diimpor & belum punya Polsek), selain itu desa contoh dari batas kecamatan terbesar.
      let [village] = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id::text FROM villages
        WHERE kode_wilayah LIKE ${kab.kode + '.%'} AND geom IS NOT NULL AND polsek_id IS NULL
        ORDER BY ST_Area(geom) DESC LIMIT 1`;
      if (village) {
        realVillages++;
        await prisma.village.update({ where: { id: village.id }, data: { polsekId: polsek.id } });
      } else {
        [village] = await prisma.$queryRaw<{ id: string }[]>`
          INSERT INTO villages (kode_wilayah, nama, kecamatan, kabupaten, provinsi, kecamatan_kode, polsek_id, geom, centroid)
          SELECT ${'98.' + kab.kode.slice(0, 2) + '.' + kab.kode.slice(3) + '.0001'}, 'Desa Contoh ' || k.nama, k.nama, ${kab.nama}, ${prov.nama},
                 k.kode, ${polsek.id}::uuid, k.geom, ST_PointOnSurface(k.geom)::geography
          FROM regions k WHERE k.parent_kode = ${kab.kode} AND k.geom IS NOT NULL
          ORDER BY ST_Area(k.geom) DESC LIMIT 1
          RETURNING id::text`;
      }
      if (!village) continue;

      const bhabin = await prisma.user.create({
        data: {
          nrp: `98${digits(kab.kode).padStart(6, '0')}`, nama: `${pick(NAMA_DEPAN)} ${pick(NAMA_BELAKANG)}`, pangkat: pick(PANGKAT),
          role: UserRole.BHABIN, unitId: polsek.id, passwordHash: hash, mustChangePassword: false,
          villages: { create: { villageId: village.id, since: new Date('2026-01-01') } },
        },
      });

      // Titik acak di dalam batas desa.
      const n = int(...PER_KAB);
      const points = await prisma.$queryRaw<{ lat: number; lng: number }[]>`
        SELECT ST_Y(d.geom) AS lat, ST_X(d.geom) AS lng
        FROM villages v, ST_Dump(ST_GeneratePoints(v.geom, ${n}::int, ${int(1, 1_000_000)}::int)) d
        WHERE v.id = ${village.id}::uuid`;

      const counters = new Map<string, number>();
      for (const pt of points) {
        const daysAgo = int(0, DAYS);
        const cat = pick(CATS);
        const occurredAt = new Date(Date.now() - daysAgo * 86_400_000 - int(0, 9) * 3_600_000);
        if (occurredAt > new Date()) occurredAt.setTime(Date.now() - int(10, 300) * 60_000);
        const period = `${String(occurredAt.getFullYear()).slice(2)}${String(occurredAt.getMonth() + 1).padStart(2, '0')}`;
        const key = `${cat}-${period}`;
        const no = (counters.get(key) ?? 0) + 1;
        counters.set(key, no);

        const status = statusFor(daysAgo);
        const { data, priority = false } = dataFor(cat, daysAgo);
        const decided = status === S.APPROVED || status === S.NEEDS_REVISION || status === S.REJECTED;
        const note = status === S.NEEDS_REVISION ? 'Foto kurang jelas, mohon diulang.' : status === S.REJECTED ? 'Laporan duplikat dengan laporan sebelumnya.' : null;
        const submittedAt = new Date(occurredAt.getTime() + int(5, 90) * 60_000);
        const reviewedAt = new Date(submittedAt.getTime() + int(1, 20) * 3_600_000);

        await prisma.report.create({
          data: {
            clientUuid: randomUUID(), nomor: `${PREFIX[cat]}-${polres.kode}-${period}-${String(no).padStart(5, '0')}`,
            category: cat, schemaVersion: version[cat] ?? 1, userId: bhabin.id, unitId: polsek.id, villageId: village.id,
            status, priority, data, occurredAt, lat: pt.lat, lng: pt.lng,
            gpsAccuracyM: Math.round(4 + rnd() * 30), isMockLocation: false, insideVillage: true,
            submittedAt, receivedAt: submittedAt,
            ...(decided && { reviewedById: verifier.id, reviewedAt, reviewNote: note }),
            ...(cat === C.HARGA_PANGAN && {
              items: {
                create: commodities.filter(() => rnd() > 0.3).map((c) => ({
                  commodityId: c.id, harga: price(c.kode, daysAgo), satuan: c.satuanDefault,
                  stok: pick(['AMAN', 'AMAN', 'AMAN', 'MENIPIS'] as StockStatus[]),
                })),
              },
            }),
            history: {
              create: [
                { fromStatus: S.DRAFT, toStatus: S.SUBMITTED, actorId: bhabin.id, at: submittedAt },
                ...(status !== S.SUBMITTED ? [{ fromStatus: S.SUBMITTED, toStatus: S.IN_REVIEW, actorId: verifier.id, at: new Date(reviewedAt.getTime() - 600_000) }] : []),
                ...(decided ? [{ fromStatus: S.IN_REVIEW, toStatus: status, actorId: verifier.id, note, at: reviewedAt }] : []),
              ],
            },
          },
        });
        totalReports++;
      }
      for (const [key, lastNo] of counters) {
        const [category, period] = key.split('-') as [C, string];
        await prisma.reportCounter.create({ data: { unitId: polres.id, category, period, lastNo } });
      }
    }
    process.stdout.write(`\r${prov.nama}: ${kabs.length} kab/kota · total ${totalReports} laporan          `);
  }

  console.log(`\n${totalReports} laporan contoh di ${kabCount} kabupaten/kota (${realVillages} memakai desa asli Kemendagri) dalam ${Math.round((Date.now() - t0) / 1000)} detik.`);
  console.log('Jalankan `npm run aggregates:rebuild` agar ringkasan & kinerja ikut terisi.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
