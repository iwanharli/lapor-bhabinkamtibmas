/**
 * Data contoh laporan berskala nasional dengan wilayah asli Kemendagri (JANGAN dijalankan di produksi).
 * Perlu batas wilayah + desa: `npm run seed:wilayah -- --desa=all` lebih dulu.
 *
 *   npm run seed:demo-nasional                            # 30 hari, ±0,6 laporan/Bhabin/hari
 *   npm run seed:demo-nasional -- --hari=60 --per-hari=1  # lebih banyak
 *   npm run seed:demo-nasional -- --prov=32,33            # hanya provinsi tertentu
 *   npm run seed:demo-nasional -- --hapus                 # hapus seluruh data contoh nasional
 *
 * Struktur (kode unit berawalan DEMO-): Polda per provinsi (WIB/WITA/WIT) › Polres per kabupaten/kota ›
 * Polsek per kecamatan. 1 Bhabin per kecamatan (NRP 98 + kode kecamatan) dengan 1 desa binaan asli (desa terluas di kecamatannya),
 * 1 pimpinan per Polda (NRP 99 + kode provinsi) dan per Polres (NRP 97 + kode kab/kota). Sandi semua Demo#12345.
 * Laporan langsung final (tanpa verifikasi); titik diacak di dalam batas desa, ±3% di luar desa, ±1% lokasi palsu.
 */
import { Prisma, PrismaClient, ReportCategory as C } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { dataFor, int, pick, PREFIX, price, rnd } from './demo/report-data';

const prisma = new PrismaClient();
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const DAYS = Number(arg('hari') ?? 30);
const PER_DAY = Number(arg('per-hari') ?? 0.6);
const PROVS = arg('prov')?.split(',');
const BATCH = 2000;

const WITA = ['51', '52', '53', '63', '64', '65', '71', '72', '73', '74', '75', '76'];
const WIT = ['81', '82', '91', '92', '93', '94', '95', '96'];
const tzOf = (prov: string) => (WIT.includes(prov) ? 'Asia/Jayapura' : WITA.includes(prov) ? 'Asia/Makassar' : 'Asia/Jakarta');
const OFFSET_H: Record<string, number> = { 'Asia/Jakarta': 7, 'Asia/Makassar': 8, 'Asia/Jayapura': 9 };

const NAMA_DEPAN = ['Agus', 'Budi', 'Dedi', 'Eko', 'Fajar', 'Hendra', 'Iwan', 'Joko', 'Rahmat', 'Yusuf', 'Rina', 'Sari', 'Dewi', 'Made', 'Nyoman', 'Andi', 'La Ode', 'Frans', 'Yohanes', 'Teuku', 'Ketut', 'Arif', 'Bayu', 'Rudi'];
const NAMA_BELAKANG = ['Saputra', 'Wijaya', 'Siregar', 'Nasution', 'Pratama', 'Hidayat', 'Kurniawan', 'Wibowo', 'Sinaga', 'Pangaribuan', 'Mahendra', 'Rumbiak', 'Kambu', 'Lestari', 'Rahman', 'Tanjung', 'Harahap', 'Manurung', 'Sitompul', 'Gultom'];
const PANGKAT = ['Brigpol', 'Bripka', 'Aipda', 'Aiptu'];
// Penyuluhan ditunda (skema RETIRED), tidak dibuat.
const CATS: C[] = [C.SAMBANG, C.SAMBANG, C.SAMBANG, C.HARGA_PANGAN, C.HARGA_PANGAN, C.DETEKSI_DINI, C.DETEKSI_DINI, C.MAPPING_KK, C.KETAHANAN_PANGAN, C.PROBLEM_SOLVING];

const digits = (kode: string) => kode.replace(/\./g, '');
const shortName = (nama: string) => nama.replace(/^Kabupaten (Administrasi )?/, '').replace(/^Kota (Administrasi )?/, 'Kota ');

/** Hapus seluruh data contoh nasional (unit DEMO-*, penggunanya, laporan & absensinya). Desa asli hanya dilepas dari Polsek. */
async function hapus() {
  const units = (await prisma.unit.findMany({ where: { kode: { startsWith: 'DEMO-' } }, select: { id: true } })).map((u) => u.id);
  if (!units.length) return console.log('Tidak ada data contoh nasional.');
  const q = (sql: string) => prisma.$executeRawUnsafe(sql, units);
  const t0 = Date.now();
  await q(`DELETE FROM report_status_history WHERE report_id IN (SELECT id FROM reports WHERE unit_id = ANY($1::uuid[]))`);
  await q(`DELETE FROM report_items WHERE report_id IN (SELECT id FROM reports WHERE unit_id = ANY($1::uuid[]))`);
  await q(`DELETE FROM attachments WHERE report_id IN (SELECT id FROM reports WHERE unit_id = ANY($1::uuid[]))`);
  const reports = await q(`DELETE FROM reports WHERE unit_id = ANY($1::uuid[])`);
  await q(`DELETE FROM report_counters WHERE unit_id = ANY($1::uuid[])`);
  await q(`DELETE FROM attendances WHERE unit_id = ANY($1::uuid[])`);
  for (const t of ['user_villages', 'refresh_tokens', 'devices', 'export_jobs']) {
    await q(`DELETE FROM ${t} WHERE user_id IN (SELECT id FROM users WHERE unit_id = ANY($1::uuid[]))`);
  }
  // Audit log tidak bisa dihapus (append-only): pengguna contoh yang pernah tercatat cukup dinonaktifkan.
  await q(`UPDATE users SET active = false WHERE unit_id = ANY($1::uuid[]) AND id IN (SELECT actor_id FROM audit_logs WHERE actor_id IS NOT NULL)`);
  const users = await q(`DELETE FROM users WHERE unit_id = ANY($1::uuid[]) AND active`);
  await q(`UPDATE villages SET polsek_id = NULL WHERE polsek_id = ANY($1::uuid[])`);
  await prisma.village.deleteMany({ where: { kodeWilayah: { startsWith: '98.' } } });
  for (const t of ['agg_unit_daily', 'agg_user_daily', 'agg_price_daily']) await q(`DELETE FROM ${t} WHERE unit_id = ANY($1::uuid[])`);
  // Unit yang masih dipakai pengguna nonaktif tetap ada; sisanya dihapus dari Polsek ke atas.
  for (const level of ['POLSEK', 'POLRES', 'POLDA']) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM units u WHERE u.id = ANY($1::uuid[]) AND u.level = '${level}'
         AND NOT EXISTS (SELECT 1 FROM users x WHERE x.unit_id = u.id) AND NOT EXISTS (SELECT 1 FROM units c WHERE c.parent_id = u.id)`,
      units,
    );
  }
  console.log(`Dihapus: ${reports.toLocaleString('id-ID')} laporan, ${users.toLocaleString('id-ID')} pengguna contoh (${Math.round((Date.now() - t0) / 1000)} detik).`);
}

/** Sisipkan baris lewat jsonb_to_recordset per batch; `sql` memakai $1 sebagai jsonb. */
async function bulk<T>(rows: T[], sql: string, label: string) {
  let n = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    n += await prisma.$executeRawUnsafe(sql, JSON.stringify(rows.slice(i, i + BATCH)));
    if (rows.length > BATCH) process.stdout.write(`\r${label}: ${Math.min(i + BATCH, rows.length).toLocaleString('id-ID')}/${rows.length.toLocaleString('id-ID')}   `);
  }
  if (rows.length > BATCH) process.stdout.write('\n');
  return n;
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed demo tidak boleh dijalankan di produksi');
  if (process.argv.includes('--hapus')) return hapus();
  if (await prisma.unit.count({ where: { kode: { startsWith: 'DEMO-SEK-' } } })) {
    console.log('Data contoh nasional sudah ada. Jalankan dengan --hapus dulu untuk membuat ulang.');
    return;
  }
  const t0 = Date.now();
  const mabes = await prisma.unit.findFirstOrThrow({ where: { level: 'MABES' } });
  const hash = await argon2.hash('Demo#12345', { type: argon2.argon2id });

  // Kecamatan yang punya minimal 1 desa ber-batas dan belum dibina Polsek lain.
  const kecs = await prisma.$queryRaw<{ kode: string; nama: string; kab: string; kab_nama: string; prov: string; prov_nama: string; desa: number }[]>`
    SELECT k.kode, k.nama, kb.kode AS kab, kb.nama AS kab_nama, p.kode AS prov, p.nama AS prov_nama,
           (SELECT count(*) FROM villages v WHERE v.kecamatan_kode = k.kode AND v.geom IS NOT NULL AND v.polsek_id IS NULL)::int AS desa
    FROM regions k JOIN regions kb ON kb.kode = k.parent_kode JOIN regions p ON p.kode = kb.parent_kode
    WHERE k.level = 3 ${PROVS ? Prisma.sql`AND p.kode = ANY(${PROVS}::text[])` : Prisma.empty}
    ORDER BY k.kode`;
  const usable = kecs.filter((k) => k.desa > 0);
  if (!usable.length) throw new Error('Belum ada desa ber-batas. Jalankan `npm run seed:wilayah -- --desa=all` dulu.');
  console.log(`${usable.length.toLocaleString('id-ID')} dari ${kecs.length.toLocaleString('id-ID')} kecamatan punya data desa.`);

  // 1. Unit: Polda, Polres, Polsek (sekali sisip per level).
  const provs = [...new Map(usable.map((k) => [k.prov, k.prov_nama])).entries()];
  const kabs = [...new Map(usable.map((k) => [k.kab, { prov: k.prov, nama: k.kab_nama }])).entries()];
  const insertUnits = (rows: { kode: string; nama: string; level: string; parent: string; tz: string }[]) =>
    prisma.$queryRawUnsafe<{ id: string; kode: string }[]>(
      `INSERT INTO units (kode, nama, level, parent_id, timezone)
       SELECT x.kode, x.nama, x.level::unit_level, x.parent::uuid, x.tz FROM jsonb_to_recordset($1::jsonb) AS x(kode text, nama text, level text, parent text, tz text)
       ON CONFLICT (kode) DO UPDATE SET nama = excluded.nama, level = excluded.level, parent_id = excluded.parent_id, timezone = excluded.timezone, deleted_at = NULL
       RETURNING id::text, kode`,
      JSON.stringify(rows),
    );
  const polda = new Map((await insertUnits(provs.map(([kode, nama]) => ({ kode: `DEMO-POLDA-${kode}`, nama: `Polda ${nama}`, level: 'POLDA', parent: mabes.id, tz: tzOf(kode) })))).map((u) => [u.kode, u.id]));
  const polres = new Map((await insertUnits(kabs.map(([kode, k]) => ({
    kode: `DEMO-RES-${digits(kode)}`, nama: `Polres ${shortName(k.nama)}`, level: 'POLRES', parent: polda.get(`DEMO-POLDA-${k.prov}`)!, tz: tzOf(k.prov),
  })))).map((u) => [u.kode, u.id]));
  const polsek = new Map<string, string>();
  for (let i = 0; i < usable.length; i += BATCH) {
    const rows = await insertUnits(usable.slice(i, i + BATCH).map((k) => ({
      kode: `DEMO-SEK-${digits(k.kode)}`, nama: `Polsek ${k.nama}`, level: 'POLSEK', parent: polres.get(`DEMO-RES-${digits(k.kab)}`)!, tz: tzOf(k.prov),
    })));
    rows.forEach((u) => polsek.set(u.kode, u.id));
  }
  console.log(`Unit: ${polda.size} Polda, ${polres.size} Polres, ${polsek.size.toLocaleString('id-ID')} Polsek`);

  // 2. Pengguna: pimpinan per Polda & Polres, Bhabin per kecamatan.
  const users = [
    ...provs.map(([kode, nama]) => ({ nrp: `99${kode.padStart(6, '0')}`, nama: `Pimpinan ${nama}`, pangkat: 'Kombes Pol', role: 'PIMPINAN', unit: polda.get(`DEMO-POLDA-${kode}`)! })),
    ...kabs.map(([kode, k]) => ({ nrp: `97${digits(kode).padStart(6, '0')}`, nama: `Pimpinan Polres ${shortName(k.nama)}`, pangkat: 'AKBP', role: 'PIMPINAN', unit: polres.get(`DEMO-RES-${digits(kode)}`)! })),
    ...usable.map((k) => ({ nrp: `98${digits(k.kode)}`, nama: `${pick(NAMA_DEPAN)} ${pick(NAMA_BELAKANG)}`, pangkat: pick(PANGKAT), role: 'BHABIN', unit: polsek.get(`DEMO-SEK-${digits(k.kode)}`)! })),
  ];
  await bulk(users, `
    INSERT INTO users (nrp, nama, pangkat, role, unit_id, password_hash, must_change_password, updated_at)
    SELECT x.nrp, x.nama, x.pangkat, x.role::user_role, x.unit::uuid, '${hash}', false, now()
    FROM jsonb_to_recordset($1::jsonb) AS x(nrp text, nama text, pangkat text, role text, unit text)
    -- Akun contoh lama yang tertahan audit log dipakai ulang & diaktifkan kembali.
    ON CONFLICT (nrp) DO UPDATE SET nama = excluded.nama, pangkat = excluded.pangkat, role = excluded.role, unit_id = excluded.unit_id,
      password_hash = excluded.password_hash, active = true, must_change_password = false, updated_at = now()`, 'Pengguna');

  // 3. Desa binaan: 1 desa (terluas) per kecamatan ditetapkan ke Polsek & Bhabin-nya.
  await prisma.$executeRawUnsafe(`
    WITH pick AS (
      SELECT v.id, v.kecamatan_kode, row_number() OVER (PARTITION BY v.kecamatan_kode ORDER BY ST_Area(v.geom) DESC) AS rn
      FROM villages v WHERE v.geom IS NOT NULL AND v.polsek_id IS NULL AND v.kecamatan_kode IS NOT NULL
    ), sel AS (
      SELECT p.id AS village_id, s.id AS polsek_id, b.id AS user_id
      FROM pick p
      JOIN units s ON s.kode = 'DEMO-SEK-' || replace(p.kecamatan_kode, '.', '')
      JOIN users b ON b.unit_id = s.id AND b.role = 'BHABIN'
      WHERE p.rn <= 1
    ), upd AS (UPDATE villages v SET polsek_id = sel.polsek_id FROM sel WHERE v.id = sel.village_id)
    INSERT INTO user_villages (user_id, village_id, since) SELECT user_id, village_id, '2026-01-01' FROM sel`);

  // 4. Laporan: isian & nomor dibuat di sini, titik diacak di dalam batas desa oleh PostGIS.
  const bhabins = await prisma.$queryRaw<{ id: string; unit_id: string; polres_kode: string; timezone: string; villages: string[] }[]>`
    SELECT u.id::text, u.unit_id::text, r.kode AS polres_kode, s.timezone, array_agg(uv.village_id::text) AS villages
    FROM users u JOIN units s ON s.id = u.unit_id JOIN units r ON r.id = s.parent_id
    JOIN user_villages uv ON uv.user_id = u.id AND uv.until IS NULL
    WHERE u.role = 'BHABIN' AND s.kode LIKE 'DEMO-SEK-%'
    GROUP BY u.id, u.unit_id, r.kode, s.timezone`;
  const schemas = await prisma.formSchema.findMany({ where: { status: 'ACTIVE' } });
  const version = Object.fromEntries(schemas.map((s) => [s.category, s.version]));
  const commodities = await prisma.commodity.findMany({ where: { active: true } });
  const counters = new Map<string, number>();
  const now = Date.now();
  const reports: object[] = [];
  const items: object[] = [];

  for (const b of bhabins) {
    for (let d = DAYS; d >= 0; d--) {
      // Jumlah laporan per hari ~ Poisson(PER_DAY).
      let n = 0;
      for (let p = rnd(), l = Math.exp(-PER_DAY); p > l; p *= rnd()) n++;
      for (let k = 0; k < n; k++) {
        const day = new Date(now - d * 86_400_000);
        const occurredAt = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), int(7, 17) - (OFFSET_H[b.timezone] ?? 7), int(0, 59)));
        if (occurredAt.getTime() > now - 10 * 60_000) continue;
        const cat = pick(CATS);
        const period = `${String(occurredAt.getUTCFullYear()).slice(2)}${String(occurredAt.getUTCMonth() + 1).padStart(2, '0')}`;
        const key = `${b.polres_kode}|${cat}|${period}`;
        const no = (counters.get(key) ?? 0) + 1;
        counters.set(key, no);
        const { data, priority = false } = dataFor(cat, d);
        const clientUuid = randomUUID();
        const r = rnd();
        reports.push({
          client_uuid: clientUuid, nomor: `${PREFIX[cat]}-${b.polres_kode}-${period}-${String(no).padStart(5, '0')}`, category: cat, version: version[cat] ?? 1,
          user_id: b.id, unit_id: b.unit_id, village_id: pick(b.villages), priority, data, occurred_at: occurredAt,
          submitted_at: new Date(occurredAt.getTime() + int(5, 120) * 60_000), outside: r < 0.03, mock: r >= 0.03 && r < 0.04, gps: Math.round(4 + rnd() * 30),
        });
        if (cat === C.HARGA_PANGAN) {
          for (const c of commodities) {
            if (rnd() > 0.7) continue;
            items.push({ client_uuid: clientUuid, commodity_id: c.id, harga: price(c.kode, d), satuan: c.satuanDefault, stok: pick(['AMAN', 'AMAN', 'AMAN', 'MENIPIS', 'KOSONG'] as const) });
          }
        }
      }
    }
  }

  const inserted = await bulk(reports, `
    INSERT INTO reports (client_uuid, nomor, category, schema_version, user_id, unit_id, village_id, status, priority, data,
                         occurred_at, lat, lng, gps_accuracy_m, is_mock_location, inside_village, submitted_at, received_at, created_at, updated_at)
    SELECT x.client_uuid, x.nomor, x.category::report_category, x.version, x.user_id, x.unit_id, x.village_id, 'SUBMITTED', x.priority, x.data,
           x.occurred_at, ST_Y(pt.g) + CASE WHEN x.outside THEN 0.08 ELSE 0 END, ST_X(pt.g) + CASE WHEN x.outside THEN 0.08 ELSE 0 END,
           x.gps, x.mock, NOT x.outside, x.submitted_at, x.submitted_at, x.submitted_at, x.submitted_at
    FROM jsonb_to_recordset($1::jsonb) AS x(client_uuid uuid, nomor text, category text, version int, user_id uuid, unit_id uuid, village_id uuid,
                                           priority boolean, data jsonb, occurred_at timestamptz, submitted_at timestamptz, outside boolean, mock boolean, gps int)
    JOIN villages v ON v.id = x.village_id
    -- Desa pulau-pulau kecil: ST_GeneratePoints bisa kosong, pakai titik di permukaan agar laporan tidak hilang.
    CROSS JOIN LATERAL (SELECT coalesce((SELECT (ST_Dump(ST_GeneratePoints(v.geom, 1))).geom LIMIT 1), ST_PointOnSurface(v.geom)) AS g) pt`, 'Laporan');

  await bulk(items, `
    INSERT INTO report_items (report_id, commodity_id, harga, satuan, stok)
    SELECT r.id, x.commodity_id, x.harga, x.satuan, x.stok::stock_status
    FROM jsonb_to_recordset($1::jsonb) AS x(client_uuid uuid, commodity_id int, harga int, satuan text, stok text)
    JOIN reports r ON r.client_uuid = x.client_uuid`, 'Item harga');

  // Jarak titik ke batas desa (label "Di luar desa" bila > 200 m).
  await prisma.$executeRawUnsafe(`UPDATE reports r SET distance_m = round(ST_Distance(v.geom::geography, r.location))::real,
       inside_village = ST_Distance(v.geom::geography, r.location) <= 200
FROM villages v WHERE v.id = r.village_id AND v.geom IS NOT NULL AND r.location IS NOT NULL AND r.distance_m IS NULL`);

  await prisma.$executeRawUnsafe(`
    INSERT INTO report_status_history (report_id, from_status, to_status, actor_id, at)
    SELECT r.id, 'DRAFT', 'SUBMITTED', r.user_id, r.submitted_at FROM reports r JOIN units u ON u.id = r.unit_id WHERE u.kode LIKE 'DEMO-%'`);

  await bulk([...counters].map(([key, last]) => {
    const [kode, category, period] = key.split('|');
    return { unit: polres.get(kode), category, period, last };
  }), `
    INSERT INTO report_counters (unit_id, category, period, last_no)
    SELECT x.unit::uuid, x.category::report_category, x.period, x.last FROM jsonb_to_recordset($1::jsonb) AS x(unit text, category text, period text, last int)`, 'Penomoran');

  console.log(`${inserted.toLocaleString('id-ID')} laporan · ${items.length.toLocaleString('id-ID')} item harga · ${bhabins.length.toLocaleString('id-ID')} Bhabin di ${provs.length} provinsi (${Math.round((Date.now() - t0) / 1000)} detik).`);
  console.log('Lanjutkan: `npm run aggregates:rebuild`, lalu (opsional) `npm run seed:demo-absensi`.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
