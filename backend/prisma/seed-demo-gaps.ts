/**
 * Lengkapi data DEMO satu Polres: Polsek yang belum punya laporan jenis tertentu dalam 30 hari terakhir diberi 2–3 laporan contoh,
 * lengkap dengan titik di dalam desa binaan, foto (dipinjam dari laporan sejenis), item harga, dan rekap kesehatan.
 * Hanya untuk server demo/dev. Aman diulang: jenis yang sudah terisi dilewati. Setelah itu jalankan aggregates:rebuild.
 *   npx ts-node prisma/seed-demo-gaps.ts RES-3174
 */
import { Prisma, PrismaClient, ReportCategory as C, ReportStatus as S, StockStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { healthSummary } from '../src/modules/reports/health-summary';
import { dataFor, int, pick, PREFIX, price } from './demo/report-data';

const CATEGORIES = [C.SAMBANG, C.DETEKSI_DINI, C.PROBLEM_SOLVING, C.HARGA_PANGAN, C.MAPPING_KK, C.KETAHANAN_PANGAN];
const DAY = 86_400_000;
const prisma = new PrismaClient();

async function main() {
  const kode = process.argv[2];
  if (!kode) throw new Error('Sebutkan kode Polres, mis. RES-3174');
  const polres = await prisma.unit.findUniqueOrThrow({ where: { kode } });
  const polseks = await prisma.unit.findMany({ where: { parentId: polres.id, level: 'POLSEK', deletedAt: null } });
  const schemas = await prisma.formSchema.findMany({ where: { status: 'ACTIVE' } });
  const version = new Map(schemas.map((s) => [s.category, s.version]));
  const commodities = await prisma.commodity.findMany({ where: { active: true } });
  const since = new Date(Date.now() - 30 * DAY);
  let total = 0;

  for (const polsek of polseks) {
    const bhabin = await prisma.user.findFirst({ where: { unitId: polsek.id, role: 'BHABIN', active: true }, include: { villages: { where: { until: null } } } });
    const villageId = bhabin?.villages[0]?.villageId;
    if (!bhabin || !villageId) {
      console.log(`${polsek.nama}: dilewati, belum ada Bhabin dengan desa binaan.`);
      continue;
    }
    for (const category of CATEGORIES) {
      if (await prisma.report.count({ where: { unitId: polsek.id, category, occurredAt: { gte: since } } })) continue;
      const donor = await prisma.report.findFirst({
        // Hanya foto data demo (storage/demo), bukan gambar kecil sisa test E2E.
        where: { category, schemaVersion: version.get(category), attachments: { some: { objectKey: { startsWith: 'demo/' } } } },
        include: { attachments: { where: { objectKey: { startsWith: 'demo/' } } } },
        orderBy: { occurredAt: 'desc' },
      });
      const days = new Set<number>();
      const count = int(2, 3);
      while (days.size < count) days.add(int(1, 28));

      for (const daysAgo of days) {
        // Jam kerja WIB; hari dihitung mundur dari sekarang sehingga tidak pernah di masa depan.
        const day = new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);
        const occurredAt = new Date(`${day}T${String(int(8, 16)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00+07:00`);
        const submittedAt = new Date(occurredAt.getTime() + int(5, 90) * 60_000);
        const { data, priority = false } = dataFor(category, daysAgo);
        const [point] = await prisma.$queryRaw<{ lat: number; lng: number }[]>`
          SELECT ST_Y(p) AS lat, ST_X(p) AS lng FROM (SELECT (ST_Dump(ST_GeneratePoints(geom, 1))).geom AS p FROM villages WHERE id = ${villageId}::uuid) x`;
        const period = occurredAt.toLocaleDateString('sv-SE', { timeZone: polsek.timezone }).slice(2, 7).replace('-', '');

        await prisma.$transaction(async (tx) => {
          const [{ last_no }] = await tx.$queryRaw<{ last_no: number }[]>`
            INSERT INTO report_counters (unit_id, category, period, last_no) VALUES (${polres.id}::uuid, ${category}::report_category, ${period}, 1)
            ON CONFLICT (unit_id, category, period) DO UPDATE SET last_no = report_counters.last_no + 1
            RETURNING last_no`;
          const report = await tx.report.create({
            data: {
              clientUuid: randomUUID(), nomor: `${PREFIX[category]}-${polres.kode}-${period}-${String(last_no).padStart(5, '0')}`,
              category, schemaVersion: version.get(category) ?? 1, userId: bhabin.id, unitId: polsek.id, villageId,
              status: S.SUBMITTED, priority, data, occurredAt, submittedAt, receivedAt: submittedAt,
              lat: point.lat, lng: point.lng, gpsAccuracyM: int(4, 20), isMockLocation: false, insideVillage: true, distanceM: 0,
              ...(category === C.MAPPING_KK && { health: healthSummary(data as Record<string, unknown>, occurredAt) as unknown as Prisma.InputJsonObject }),
              ...(category === C.HARGA_PANGAN && {
                items: {
                  create: commodities.map((c) => ({
                    commodityId: c.id, harga: price(c.kode, daysAgo), satuan: c.satuanDefault, stok: pick(['AMAN', 'AMAN', 'AMAN', 'MENIPIS'] as StockStatus[]),
                  })),
                },
              }),
              history: { create: [{ fromStatus: S.DRAFT, toStatus: S.SUBMITTED, actorId: bhabin.id, at: submittedAt }] },
              attachments: {
                create: (donor?.attachments ?? []).map((a) => ({
                  fieldKey: a.fieldKey, clientUuid: randomUUID(), objectKey: a.objectKey, thumbKey: a.thumbKey, mime: a.mime, sizeBytes: a.sizeBytes,
                  sha256: a.sha256, source: a.source, capturedAt: occurredAt, watermarked: a.watermarked,
                })),
              },
            },
          });
          return report;
        });
        total++;
      }
      console.log(`${polsek.nama} · ${category}: ${count} laporan`);
    }
  }
  console.log(`Selesai: ${total} laporan contoh ditambahkan. Jalankan: npm run aggregates:rebuild`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
