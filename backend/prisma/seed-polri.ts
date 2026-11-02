/**
 * Muat satuan Polri nasional (Polda/Polres/Polsek) dan cakupan wilayahnya dari prisma/polri/*.csv, dalam satu transaksi.
 * lalu tambahkan yang belum ada ke tabel units (struktur /admin/unit). Unit yang sudah ada tidak diubah, karena akun &
 * laporan merujuk ke sana. Aman diulang. Jalankan setelah seed:wilayah.
 *   npm run seed:polri
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const BATCH = 500;
const WITA = ['51', '52', '53', '63', '64', '65', '71', '72', '73', '74', '75', '76'];
const WIT = ['81', '82', '91', '92', '93', '94', '95', '96'];
const PREFIX: Record<string, string> = { POLDA: 'POLDA', POLRES: 'RES', POLSEK: 'SEK' };

/** Nama untuk dicocokkan; sumber nasional menulis "Polsek Metro Menteng", unit lama "Polsek Menteng". */
const norm = (t: string) => t.toLowerCase().replace(/\bmetro\b/g, '').replace(/[^a-z0-9]/g, '');
const timezoneOf = (kode?: string) => (kode && WIT.includes(kode.slice(0, 2)) ? 'Asia/Jayapura' : kode && WITA.includes(kode.slice(0, 2)) ? 'Asia/Makassar' : 'Asia/Jakarta');

/** CSV sederhana: koma sebagai pemisah, tanda kutip ganda untuk nilai yang mengandung koma/kutip. */
function readCsv(file: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const text = readFileSync(join(__dirname, 'polri', file), 'utf8');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/** Gabungkan satuan nasional ke units: cocokkan dengan unit yang ada (kode wilayah, lalu nama di induk yang sama), sisanya ditambahkan. */
async function mergeIntoUnits(prisma: PrismaClient, units: Record<string, string>[], links: Record<string, string>[]) {
  const existing = await prisma.unit.findMany({ select: { id: true, parentId: true, level: true, kode: true, nama: true, timezone: true } });
  const mabes = existing.find((u) => u.level === 'MABES');
  if (!mabes) throw new Error('Unit Mabes belum ada. Jalankan seed dulu.');
  const byId = new Map(existing.map((u) => [u.id, u]));
  const byKode = new Map(existing.map((u) => [u.kode, u]));
  const areas = new Map<string, Record<string, string>[]>();
  for (const l of links) areas.set(l.unit_id, [...(areas.get(l.unit_id) ?? []), l]);
  const usedKode = new Set(byKode.keys());
  const claimed = new Set<string>();
  const resolved = new Map<string, { id: string; timezone: string }>();
  const rows: Prisma.UnitCreateManyInput[] = [];

  for (const kind of ['POLDA', 'POLRES', 'POLSEK'] as const) {
    for (const u of units.filter((x) => x.kind === kind)) {
      const parent = u.parentId ? resolved.get(u.parentId) : { id: mabes.id, timezone: mabes.timezone };
      if (!parent) continue;
      const known = byId.get(u.id);
      if (known) { resolved.set(u.id, known); continue; }
      const own = (areas.get(u.id) ?? []).filter((a) => a.method !== 'via_polres' && a.method !== 'kawasan' && a.method !== 'via_polsek');
      const digits = own[0]?.kode.replace(/\./g, '');
      const key = digits && `${PREFIX[kind]}-${digits}`;
      const twin = existing.find((e) => e.level === kind && !claimed.has(e.id) && ((key && e.kode === key) || (e.parentId === parent.id && norm(e.nama) === norm(u.name))));
      if (twin) {
        claimed.add(twin.id);
        resolved.set(u.id, twin);
        continue;
      }
      // Kode pendek karena dipakai di nomor laporan; satu wilayah bisa punya beberapa satuan (mis. Polres Pelabuhan).
      const kode = key && !usedKode.has(key) ? key : `${PREFIX[kind]}-${u.id.replace(/-/g, '').slice(-12)}`;
      usedKode.add(kode);
      const timezone = kind === 'POLDA' ? timezoneOf(own[0]?.kode) : parent.timezone;
      rows.push({ id: u.id, parentId: parent.id, level: kind, kode, nama: u.name, timezone });
      resolved.set(u.id, { id: u.id, timezone });
    }
  }
  await prisma.unit.createMany({ data: rows, skipDuplicates: true });
  console.log(`Units: ${claimed.size} unit lama dicocokkan, ${rows.length} unit baru ditambahkan.`);
  return resolved;
}

/**
 * Isi Polsek desa dari kecamatannya, hanya untuk desa yang belum punya Polsek. Kecamatan berisi beberapa Polsek ditentukan oleh
 * Polsek yang titiknya tepat di dalam kecamatan itu; bila tetap tidak tunggal, desanya dibiarkan kosong untuk dipilih manual.
 */
async function assignVillages(prisma: PrismaClient, resolved: Map<string, { id: string }>) {
  const rows = await prisma.$queryRaw<{ kode: string; semua: string[]; dalam: string[] }[]>`
    SELECT m.kode, array_agg(u.id::text) AS semua,
           coalesce(array_agg(u.id::text) FILTER (WHERE u.lat IS NOT NULL AND ST_Intersects(r.geom, ST_SetSRID(ST_MakePoint(u.lng, u.lat), 4326))), '{}') AS dalam
    FROM polri_wilayah m JOIN polri_units u ON u.id = m.unit_id AND u.kind = 'POLSEK' JOIN regions r ON r.kode = m.kode
    GROUP BY m.kode`;
  const picks = rows.flatMap((r) => {
    const only = r.semua.length === 1 ? r.semua[0] : r.dalam.length === 1 ? r.dalam[0] : null;
    const unit = only && resolved.get(only);
    return unit ? [{ kode: r.kode, unit: unit.id }] : [];
  });
  const updated = await prisma.$executeRaw`
    UPDATE villages v SET polsek_id = x.unit::uuid
    FROM unnest(${picks.map((p) => p.kode)}::text[], ${picks.map((p) => p.unit)}::text[]) AS x(kode, unit)
    WHERE v.kecamatan_kode = x.kode AND v.polsek_id IS NULL`;
  console.log(`Desa: ${updated} desa ditetapkan ke Polsek dari ${picks.length} kecamatan (${rows.length - picks.length} kecamatan perlu dipilih manual).`);
}

async function main() {
  const prisma = new PrismaClient();
  const units = readCsv('polri-units.csv').filter((u) => u.kind !== 'SATKER_MABES');
  const known = new Set(units.map((u) => u.id));
  const regions = new Set((await prisma.region.findMany({ select: { kode: true } })).map((r) => r.kode));
  if (!regions.size) throw new Error('Tabel regions kosong. Jalankan seed:wilayah dulu.');
  const links = readCsv('polri-wilayah.csv').filter((l) => known.has(l.unit_id) && regions.has(l.kode));

  await prisma.$transaction(async (tx) => {
    // Penetapan manual dari halaman admin (method 'admin') harus bertahan saat data dimuat ulang.
    const manual = await tx.polriWilayah.findMany({ where: { method: 'admin' } });
    await tx.$executeRaw`TRUNCATE polri_wilayah, polri_units`;
    // Induk dulu (Polda → Polres → Polsek) agar kunci parent_id selalu terpenuhi.
    for (const kind of ['POLDA', 'POLRES', 'POLSEK']) {
      const rows = units.filter((u) => u.kind === kind);
      for (let i = 0; i < rows.length; i += BATCH) {
        await tx.polriUnit.createMany({
          data: rows.slice(i, i + BATCH).map((u) => ({
            id: u.id, parentId: u.parentId || null, kind: u.kind, code: u.code, name: u.name,
            lat: u.lat ? Number(u.lat) : null, lng: u.lng ? Number(u.lng) : null, active: u.active === 'true',
          })),
        });
      }
    }
    for (let i = 0; i < links.length; i += BATCH) {
      await tx.polriWilayah.createMany({ data: links.slice(i, i + BATCH).map((l) => ({ unitId: l.unit_id, kode: l.kode, method: l.method })) });
    }
    const kept = manual.filter((m) => known.has(m.unitId));
    await tx.polriWilayah.createMany({ data: kept, skipDuplicates: true });
    // Titik koordinat Polsek mengisi yang masih kosong: Polsek tanpa wilayah, atau kecamatan tanpa Polsek. Titik harus di kab/kota cakupan Polres-nya.
    await tx.$executeRaw`
      INSERT INTO polri_wilayah (unit_id, kode, method)
      SELECT s.id, r.kode, 'koordinat'
      FROM polri_units s
      JOIN regions r ON r.level = 3 AND ST_Intersects(r.geom, ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326))
      WHERE s.kind = 'POLSEK' AND s.lat IS NOT NULL
        AND EXISTS (SELECT 1 FROM polri_wilayah p WHERE p.unit_id = s.parent_id AND p.kode = left(r.kode, 5))
        AND (NOT EXISTS (SELECT 1 FROM polri_wilayah m WHERE m.unit_id = s.id)
             OR NOT EXISTS (SELECT 1 FROM polri_wilayah m WHERE m.kode = r.kode))
      ON CONFLICT DO NOTHING`;
    const parentOf = new Map(units.map((u) => [u.id, u.parentId]));
    await tx.polriWilayah.createMany({ data: kept.map((m) => ({ unitId: parentOf.get(m.unitId)!, kode: m.kode.slice(0, 5), method: 'via_polsek' })), skipDuplicates: true });
  }, { timeout: 300_000 });
  console.log(`${units.length} satuan, ${links.length} cakupan wilayah dimuat.`);
  await assignVillages(prisma, await mergeIntoUnits(prisma, units, links));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
