/**
 * Data contoh absensi lapangan untuk semua Bhabin aktif yang punya desa binaan (JANGAN di produksi).
 *   npm run seed:demo-absensi            # 14 hari terakhir (lewati hari yang sudah ada)
 *   npm run seed:demo-absensi -- --hapus # hapus semua absensi tanpa swafoto (data contoh)
 * ±88% hadir, sebagian terlambat (> 08.00 setempat), ±5% check-in di luar desa, ±1% lokasi palsu.
 */
import { PrismaClient } from '@prisma/client';
import { int, rnd } from './demo/report-data';

const prisma = new PrismaClient();
const DAYS = 14;
const OFFSET_H: Record<string, number> = { 'Asia/Jakarta': 7, 'Asia/Makassar': 8, 'Asia/Jayapura': 9 };

/** Waktu UTC untuk jam:menit setempat pada tanggal lokal (YYYY-MM-DD). */
const at = (date: string, tz: string, h: number, m: number) => new Date(Date.parse(`${date}T00:00:00Z`) + ((h - (OFFSET_H[tz] ?? 7)) * 60 + m) * 60_000);
const localDate = (d: Date, tz: string) => d.toLocaleDateString('en-CA', { timeZone: tz });

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed demo tidak boleh dijalankan di produksi');
  if (process.argv.includes('--hapus')) {
    const n = await prisma.attendance.deleteMany({ where: { selfieId: null } });
    return console.log(`${n.count} absensi contoh dihapus.`);
  }

  const bhabins = await prisma.$queryRaw<{ id: string; unit_id: string; timezone: string; lat: number; lng: number }[]>`
    SELECT DISTINCT ON (u.id) u.id::text, u.unit_id::text, un.timezone, ST_Y(ST_PointOnSurface(v.geom)) AS lat, ST_X(ST_PointOnSurface(v.geom)) AS lng
    FROM users u JOIN units un ON un.id = u.unit_id
    JOIN user_villages uv ON uv.user_id = u.id AND uv.until IS NULL
    JOIN villages v ON v.id = uv.village_id AND v.geom IS NOT NULL
    WHERE u.role = 'BHABIN' AND u.active
    ORDER BY u.id, ST_Area(v.geom) DESC`;

  const now = new Date();
  const rows: object[] = [];
  for (const b of bhabins) {
    for (let d = DAYS; d >= 0; d--) {
      const date = localDate(new Date(now.getTime() - d * 86_400_000), b.timezone);
      if (rnd() > 0.88) continue; // tidak hadir
      const ci = at(date, b.timezone, int(6, 8), int(0, 59));
      if (ci > now) continue;
      const outside = rnd() < 0.05;
      const mock = rnd() < 0.01;
      const jitter = () => (rnd() - 0.5) * 0.004;
      const pt = outside ? { lat: b.lat + 0.12, lng: b.lng + 0.12 } : { lat: b.lat + jitter(), lng: b.lng + jitter() };
      rows.push({ user_id: b.id, unit_id: b.unit_id, type: 'CHECK_IN', work_date: date, client_time: ci, lat: pt.lat, lng: pt.lng, mock, late: rnd() < 0.04 });
      const co = at(date, b.timezone, int(15, 17), int(0, 59));
      if (co < now && rnd() < 0.92) {
        rows.push({ user_id: b.id, unit_id: b.unit_id, type: 'CHECK_OUT', work_date: date, client_time: co, lat: b.lat + jitter(), lng: b.lng + jitter(), mock: false, late: false });
      }
    }
  }

  // Sisipkan per batch; desa terdekat & jarak dihitung di database seperti endpoint asli (toleransi 200 m).
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    inserted += await prisma.$executeRawUnsafe(
      `INSERT INTO attendances (client_uuid, user_id, unit_id, type, work_date, client_time, server_time, lat, lng, gps_accuracy_m,
                                is_mock_location, inside_village, village_id, distance_m, late_sync)
       SELECT gen_random_uuid(), x.user_id, x.unit_id, x.type::"AttendanceType", x.work_date, x.client_time,
              x.client_time + CASE WHEN x.late THEN interval '5 hours' ELSE interval '20 seconds' END,
              x.lat, x.lng, 5 + random() * 20, x.mock, n.distance_m <= 200, n.village_id, round(n.distance_m), x.late
       FROM jsonb_to_recordset($1::jsonb) AS x(user_id uuid, unit_id uuid, type text, work_date date, client_time timestamptz, lat float8, lng float8, mock boolean, late boolean)
       CROSS JOIN LATERAL (
         SELECT v.id AS village_id, ST_Distance(v.geom::geography, ST_SetSRID(ST_MakePoint(x.lng, x.lat), 4326)::geography) AS distance_m
         FROM user_villages uv JOIN villages v ON v.id = uv.village_id
         WHERE uv.user_id = x.user_id AND uv.until IS NULL AND v.geom IS NOT NULL
         ORDER BY 2 LIMIT 1
       ) n
       ON CONFLICT DO NOTHING`,
      JSON.stringify(rows.slice(i, i + 1000)),
    );
  }
  console.log(`${inserted} absensi contoh untuk ${bhabins.length} Bhabin (${DAYS + 1} hari).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
