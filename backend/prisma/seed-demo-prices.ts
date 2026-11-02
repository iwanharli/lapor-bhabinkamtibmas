/**
 * Tambah laporan contoh Harga Pangan untuk DEMO satu Polres: tiap Polsek melapor 2 kali seminggu selama 30 hari terakhir,
 * seluruh komoditas terisi, foto dipinjam dari laporan demo sejenis. Hanya untuk server demo/dev.
 * Aman diulang: tanggal yang sudah punya laporan harga dilewati. Setelah itu jalankan aggregates:rebuild.
 *   npx ts-node prisma/seed-demo-prices.ts RES-3174
 */
import { PrismaClient, ReportCategory as C, ReportStatus as S, StockStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { dataFor, int, pick, PREFIX, price } from './demo/report-data';

const DAYS = 30;
const DAY = 86_400_000;
const prisma = new PrismaClient();

async function main() {
  const kode = process.argv[2];
  if (!kode) throw new Error('Sebutkan kode Polres, mis. RES-3174');
  const polres = await prisma.unit.findUniqueOrThrow({ where: { kode } });
  const polseks = await prisma.unit.findMany({ where: { parentId: polres.id, level: 'POLSEK', deletedAt: null }, orderBy: { kode: 'asc' } });
  const version = (await prisma.formSchema.findFirstOrThrow({ where: { category: C.HARGA_PANGAN, status: 'ACTIVE' } })).version;
  const commodities = await prisma.commodity.findMany({ where: { active: true } });
  const donor = await prisma.report.findFirst({
    where: { category: C.HARGA_PANGAN, attachments: { some: { objectKey: { startsWith: 'demo/' } } } },
    include: { attachments: { where: { objectKey: { startsWith: 'demo/' } } } },
    orderBy: { occurredAt: 'desc' },
  });
  let total = 0;

  for (const [index, polsek] of polseks.entries()) {
    const bhabin = await prisma.user.findFirst({ where: { unitId: polsek.id, role: 'BHABIN', active: true }, include: { villages: { where: { until: null } } } });
    const villageId = bhabin?.villages[0]?.villageId;
    if (!bhabin || !villageId) {
      console.log(`${polsek.nama}: dilewati, belum ada Bhabin dengan desa binaan.`);
      continue;
    }
    let added = 0;
    for (let daysAgo = DAYS; daysAgo >= 1; daysAgo--) {
      const day = new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);
      // Dua hari tetap per minggu, berbeda antar-Polsek agar laporan tersebar sepanjang minggu.
      const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
      if (weekday !== 1 + (index % 3) && weekday !== 4 + (index % 2)) continue;
      const from = new Date(`${day}T00:00:00+07:00`);
      const exists = await prisma.report.count({ where: { unitId: polsek.id, category: C.HARGA_PANGAN, occurredAt: { gte: from, lt: new Date(from.getTime() + DAY) } } });
      if (exists) continue;

      const occurredAt = new Date(`${day}T${String(int(7, 11)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00+07:00`);
      const submittedAt = new Date(occurredAt.getTime() + int(5, 60) * 60_000);
      const items = commodities.map((c) => ({
        commodityId: c.id, harga: price(c.kode, daysAgo), satuan: c.satuanDefault,
        stok: (c.kode.startsWith('CABAI') && daysAgo < 5 ? pick(['MENIPIS', 'MENIPIS', 'AMAN']) : pick(['AMAN', 'AMAN', 'AMAN', 'AMAN', 'MENIPIS'])) as StockStatus,
      }));
      const { data } = dataFor(C.HARGA_PANGAN, daysAgo);
      const [point] = await prisma.$queryRaw<{ lat: number; lng: number }[]>`
        SELECT ST_Y(p) AS lat, ST_X(p) AS lng FROM (SELECT (ST_Dump(ST_GeneratePoints(geom, 1))).geom AS p FROM villages WHERE id = ${villageId}::uuid) x`;
      const period = occurredAt.toLocaleDateString('sv-SE', { timeZone: polsek.timezone }).slice(2, 7).replace('-', '');

      await prisma.$transaction(async (tx) => {
        const [{ last_no }] = await tx.$queryRaw<{ last_no: number }[]>`
          INSERT INTO report_counters (unit_id, category, period, last_no) VALUES (${polres.id}::uuid, ${C.HARGA_PANGAN}::report_category, ${period}, 1)
          ON CONFLICT (unit_id, category, period) DO UPDATE SET last_no = report_counters.last_no + 1
          RETURNING last_no`;
        await tx.report.create({
          data: {
            clientUuid: randomUUID(), nomor: `${PREFIX[C.HARGA_PANGAN]}-${polres.kode}-${period}-${String(last_no).padStart(5, '0')}`,
            category: C.HARGA_PANGAN, schemaVersion: version, userId: bhabin.id, unitId: polsek.id, villageId,
            status: S.SUBMITTED, data: { ...(data as object), items: items.map(({ commodityId, harga, satuan, stok }) => ({ commodityId, harga, satuan, stok })) },
            occurredAt, submittedAt, receivedAt: submittedAt, lat: point.lat, lng: point.lng, gpsAccuracyM: int(4, 20), isMockLocation: false, insideVillage: true, distanceM: 0,
            items: { create: items },
            history: { create: [{ fromStatus: S.DRAFT, toStatus: S.SUBMITTED, actorId: bhabin.id, at: submittedAt }] },
            attachments: {
              create: (donor?.attachments ?? []).map((a) => ({
                fieldKey: a.fieldKey, clientUuid: randomUUID(), objectKey: a.objectKey, thumbKey: a.thumbKey, mime: a.mime, sizeBytes: a.sizeBytes,
                sha256: a.sha256, source: a.source, capturedAt: occurredAt, watermarked: a.watermarked,
              })),
            },
          },
        });
      });
      added++;
    }
    total += added;
    console.log(`${polsek.nama}: ${added} laporan harga`);
  }
  console.log(`Selesai: ${total} laporan harga ditambahkan. Jalankan: npm run aggregates:rebuild`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
