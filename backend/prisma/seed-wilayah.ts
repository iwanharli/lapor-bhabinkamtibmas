/**
 * Seeder batas wilayah administrasi Indonesia (Kepmendagri No 300.2.2-2430 Tahun 2025)
 * dari https://github.com/cahyadsn/wilayah_boundaries (MIT).
 *
 *   npm run seed:wilayah                     # provinsi, kabupaten/kota, kecamatan seluruh Indonesia
 *   npm run seed:wilayah -- --desa=34,33     # + desa/kelurahan untuk provinsi 34 & 33
 *   npm run seed:wilayah -- --desa=all       # + seluruh desa (±83.000, unduhan besar)
 *   npm run seed:wilayah -- --desa=34 --timpa  # timpa geometri desa yang sudah ada
 *
 * Berkas sumber di-cache di storage/wilayah-cache. Provinsi–kecamatan masuk ke `regions`;
 * desa masuk ke `villages` (kode_wilayah = kode Kemendagri) tanpa mengubah Polsek pembinanya.
 */
import { PrismaClient } from '@prisma/client';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

const BASE = process.env.WILAYAH_SOURCE_URL ?? 'https://raw.githubusercontent.com/cahyadsn/wilayah_boundaries/main/db';
const CACHE = join(__dirname, '..', 'storage', 'wilayah-cache');
const BATCH = 200;
/**
 * Geometri tampilan (geom_s) per level: toleransi penyederhanaan dan luas minimum pulau (derajat²).
 * Pulau lebih kecil dibuang agar peta nasional ringan (provinsi ±250 KB); bagian terbesar selalu dipertahankan.
 */
const DISPLAY: Record<number, { tol: number; minArea: number }> = {
  1: { tol: 0.02, minArea: 0.002 },
  2: { tol: 0.003, minArea: 0.0001 },
  3: { tol: 0.0008, minArea: 0.00001 },
};

/** 38 provinsi (Kepmendagri 2025); dipakai bila poligon provinsi tidak tersedia di sumber. */
const PROVINSI: Record<string, string> = {
  '11': 'Aceh', '12': 'Sumatera Utara', '13': 'Sumatera Barat', '14': 'Riau', '15': 'Jambi', '16': 'Sumatera Selatan',
  '17': 'Bengkulu', '18': 'Lampung', '19': 'Kepulauan Bangka Belitung', '21': 'Kepulauan Riau', '31': 'Daerah Khusus Ibukota Jakarta',
  '32': 'Jawa Barat', '33': 'Jawa Tengah', '34': 'Daerah Istimewa Yogyakarta', '35': 'Jawa Timur', '36': 'Banten', '51': 'Bali',
  '52': 'Nusa Tenggara Barat', '53': 'Nusa Tenggara Timur', '61': 'Kalimantan Barat', '62': 'Kalimantan Tengah',
  '63': 'Kalimantan Selatan', '64': 'Kalimantan Timur', '65': 'Kalimantan Utara', '71': 'Sulawesi Utara', '72': 'Sulawesi Tengah',
  '73': 'Sulawesi Selatan', '74': 'Sulawesi Tenggara', '75': 'Gorontalo', '76': 'Sulawesi Barat', '81': 'Maluku', '82': 'Maluku Utara',
  '91': 'Papua', '92': 'Papua Barat', '93': 'Papua Selatan', '94': 'Papua Tengah', '95': 'Papua Pegunungan', '96': 'Papua Barat Daya',
};

const prisma = new PrismaClient();
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}`))?.split('=')[1] ?? (process.argv.includes(`--${name}`) ? 'true' : undefined);

interface Row { kode: string; nama: string; lat: number | null; lng: number | null; g: string }

/** Unduh (atau baca cache) satu berkas SQL; null bila tidak ada (404). */
async function source(path: string): Promise<string | null> {
  const file = join(CACHE, path);
  if (existsSync(file)) return readFile(file, 'utf8');
  const res = await fetch(`${BASE}/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Gagal mengunduh ${path}: HTTP ${res.status}`);
  const text = await res.text();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
  return text;
}

const ROW = /\(\s*'([\d.]+)'\s*,\s*'((?:[^'\\]|\\.|'')*)'\s*,\s*(-?[\d.]+|NULL)\s*,\s*(-?[\d.]+|NULL)\s*,\s*'(\[[^']*\])'\s*\)/g;
const depth = (a: unknown): number => (Array.isArray(a) ? 1 + depth(a[0]) : 0);
/** [lat,lng] → [lng,lat] di semua tingkat. */
const swap = (a: any): any => (typeof a[0] === 'number' ? [a[1], a[0]] : a.map(swap));

/** Ubah isi SQL sumber menjadi baris dengan geometri GeoJSON (MultiPolygon). */
function parse(sql: string): Row[] {
  const rows: Row[] = [];
  for (const m of sql.matchAll(ROW)) {
    const path = JSON.parse(m[5]);
    if (!path.length) continue;
    const coordinates = depth(path) === 3 ? [swap(path)] : swap(path);
    rows.push({
      kode: m[1],
      nama: m[2].replace(/\\(.)/g, '$1').replace(/''/g, "'").trim(),
      lat: m[3] === 'NULL' ? null : Number(m[3]),
      lng: m[4] === 'NULL' ? null : Number(m[4]),
      g: JSON.stringify({ type: 'MultiPolygon', coordinates }),
    });
  }
  return rows;
}

const GEOM = `ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(x.g), 4326)), 3))`;

async function upsertRegions(level: number, rows: Row[], parentOf: (kode: string) => string | null, chainOf: (kode: string) => string) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => ({ ...r, parent: parentOf(r.kode), chain: chainOf(r.kode) }));
    await prisma.$executeRawUnsafe(
      `INSERT INTO regions (kode, nama, level, parent_kode, chain, lat, lng, geom, updated_at)
       SELECT x.kode, x.nama, $2, x.parent, x.chain, x.lat, x.lng, g.geom, now()
       FROM jsonb_to_recordset($1::jsonb) AS x(kode text, nama text, parent text, chain text, lat float8, lng float8, g text)
       CROSS JOIN LATERAL (SELECT ${GEOM} AS geom) g
       ON CONFLICT (kode) DO UPDATE SET nama = excluded.nama, level = excluded.level, parent_kode = excluded.parent_kode,
         chain = excluded.chain, lat = excluded.lat, lng = excluded.lng, geom = excluded.geom, updated_at = now()`,
      JSON.stringify(batch),
      level,
    );
  }
}

/** Hitung ulang geometri tampilan satu level: buang pulau kecil, lalu sederhanakan. */
async function refreshDisplay(level: number) {
  const { tol, minArea } = DISPLAY[level];
  await prisma.$executeRaw`
    UPDATE regions r SET geom_s = s.g
    FROM (
      SELECT p.kode, ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SimplifyPreserveTopology(ST_Collect(p.g), ${tol})), 3)) AS g
      FROM (
        SELECT x.kode, d.geom AS g, ST_Area(d.geom) AS a, max(ST_Area(d.geom)) OVER (PARTITION BY x.kode) AS mx
        FROM regions x, ST_Dump(x.geom) d WHERE x.level = ${level}
      ) p
      WHERE p.a >= ${minArea} OR p.a = p.mx
      GROUP BY p.kode
    ) s
    WHERE r.kode = s.kode`;
}

async function upsertVillages(rows: Row[], names: Map<string, string>, overwrite: boolean) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => {
      const [p, k, c] = r.kode.split('.');
      return { ...r, kec: `${p}.${k}.${c}`, kecamatan: names.get(`${p}.${k}.${c}`) ?? '-', kabupaten: names.get(`${p}.${k}`) ?? '-', provinsi: names.get(p) ?? '-' };
    });
    const geom = overwrite ? 'excluded.geom' : 'coalesce(villages.geom, excluded.geom)';
    const centroid = overwrite ? 'excluded.centroid' : 'coalesce(villages.centroid, excluded.centroid)';
    await prisma.$executeRawUnsafe(
      `INSERT INTO villages (kode_wilayah, nama, kecamatan, kabupaten, provinsi, kecamatan_kode, geom, centroid)
       SELECT x.kode, x.nama, x.kecamatan, x.kabupaten, x.provinsi, x.kec, g.geom, ST_PointOnSurface(g.geom)::geography
       FROM jsonb_to_recordset($1::jsonb) AS x(kode text, nama text, kec text, kecamatan text, kabupaten text, provinsi text, g text)
       CROSS JOIN LATERAL (SELECT ${GEOM} AS geom) g
       WHERE NOT ST_IsEmpty(g.geom)
       ON CONFLICT (kode_wilayah) DO UPDATE SET nama = excluded.nama, kecamatan = excluded.kecamatan, kabupaten = excluded.kabupaten,
         provinsi = excluded.provinsi, kecamatan_kode = excluded.kecamatan_kode, geom = ${geom}, centroid = ${centroid}`,
      JSON.stringify(batch),
    );
  }
}

/** Jalankan fn untuk tiap item dengan konkurensi terbatas (unduhan paralel). */
async function each<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => {
    for (let it = queue.shift(); it !== undefined; it = queue.shift()) await fn(it);
  }));
}

async function main() {
  const t0 = Date.now();
  const names = new Map<string, string>();
  const chainOf = (kode: string) => {
    const parts = kode.split('.');
    return parts.slice(1).map((_, i) => names.get(parts.slice(0, i + 1).join('.'))).filter(Boolean).join(' › ');
  };

  // 1. Provinsi (berkas prov_1..n)
  const provinces: Row[] = [];
  for (let i = 1; ; i++) {
    const sql = await source(`prov/wilayah_boundaries_prov_${i}.sql`);
    if (!sql) break;
    provinces.push(...parse(sql));
  }
  if (!provinces.length) throw new Error('Data provinsi tidak ditemukan; periksa WILAYAH_SOURCE_URL / koneksi.');
  provinces.forEach((r) => names.set(r.kode, r.nama));
  await upsertRegions(1, provinces, () => null, () => '');
  // Provinsi tanpa poligon di sumber: buat dulu tanpa geometri, lalu gabungkan dari kabupaten/kotanya (langkah 2).
  const derived = Object.keys(PROVINSI).filter((k) => !names.has(k));
  for (const k of derived) {
    names.set(k, PROVINSI[k]);
    await prisma.$executeRaw`INSERT INTO regions (kode, nama, level, chain) VALUES (${k}, ${PROVINSI[k]}, 1, '') ON CONFLICT (kode) DO NOTHING`;
  }
  console.log(`Provinsi: ${provinces.length}${derived.length ? ` (+${derived.length} dibentuk dari kabupaten: ${derived.join(', ')})` : ''}`);

  // 2–3. Kabupaten/kota & kecamatan per provinsi
  const kab: Row[] = [];
  const kec: Row[] = [];
  await each(Object.keys(PROVINSI), 6, async (p) => {
    kab.push(...parse((await source(`kab/wilayah_boundaries_kab_${p}.sql`)) ?? ''));
    kec.push(...parse((await source(`kec/wilayah_boundaries_kec_${p}.sql`)) ?? ''));
  });
  kab.forEach((r) => names.set(r.kode, r.nama));
  kec.forEach((r) => names.set(r.kode, r.nama));
  const parent = (kode: string) => kode.split('.').slice(0, -1).join('.');
  await upsertRegions(2, kab.filter((r) => names.has(parent(r.kode))), parent, chainOf);
  console.log(`Kabupaten/kota: ${kab.length}`);
  for (const k of derived) {
    await prisma.$executeRaw`
      UPDATE regions p SET geom = u.geom,
             lat = ST_Y(ST_PointOnSurface(u.geom)), lng = ST_X(ST_PointOnSurface(u.geom)), updated_at = now()
      FROM (SELECT ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Union(geom)), 3)) AS geom FROM regions WHERE parent_kode = ${k}) u
      WHERE p.kode = ${k} AND u.geom IS NOT NULL`;
  }
  await upsertRegions(3, kec.filter((r) => names.has(parent(r.kode))), parent, chainOf);
  console.log(`Kecamatan: ${kec.length}`);
  for (const level of [1, 2, 3]) await refreshDisplay(level);

  // 4. Desa/kelurahan untuk provinsi terpilih (berkas per kabupaten)
  const desaArg = arg('desa');
  if (desaArg) {
    const provSet = desaArg === 'all' ? null : new Set(desaArg.split(',').map((s) => s.trim()));
    const targets = kab.filter((k) => !provSet || provSet.has(k.kode.split('.')[0])).map((k) => k.kode).sort();
    const overwrite = arg('timpa') === 'true';
    let total = 0;
    await each(targets, 6, async (k) => {
      const rows = parse((await source(`kel/${k.split('.')[0]}/wilayah_boundaries_kel_${k}.sql`)) ?? '');
      await upsertVillages(rows, names, overwrite);
      total += rows.length;
      process.stdout.write(`\rDesa/kelurahan: ${total} (${k})   `);
    });
    console.log(`\rDesa/kelurahan: ${total} dari ${targets.length} kabupaten/kota`);
  }

  console.log(`Selesai dalam ${Math.round((Date.now() - t0) / 1000)} detik.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
