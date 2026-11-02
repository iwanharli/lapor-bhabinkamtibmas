/**
 * Muat titik pasar dari CSV (pemisah titik koma) ke tabel markets. Desa dihitung dari koordinat; titik di luar poligon dan
 * nama kembar dalam satu desa dilewati. Minimarket tidak ikut. Hanya nama, kategori, alamat, dan koordinat yang disimpan. Aman diulang.
 *   npm run seed:pasar -- ../docs/pasar_lokasi.csv
 *   npm run seed:pasar -- ../docs/pasar_lokasi.csv --demo=RES-3174   # + nama pasar laporan harga contoh Polres itu memakai pasar sungguhan sekecamatan
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const KATEGORI = ['pasar_tradisional', 'pasar_modern'];
const BATCH = 500;
const prisma = new PrismaClient();

function readCsv(file: string): Record<string, string>[] {
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/** Laporan harga contoh: nama pasar diganti pasar tradisional sungguhan sekecamatan; GPS & harga tetap. */
async function relabelDemo(kode: string) {
  const n = await prisma.$executeRaw`
    WITH pilihan AS (
      SELECT left(village_kode, 8) AS kec, nama, row_number() OVER (PARTITION BY left(village_kode, 8) ORDER BY nama) - 1 AS i,
             count(*) OVER (PARTITION BY left(village_kode, 8)) AS n
      FROM markets WHERE kategori = 'pasar_tradisional'
    ), t AS (
      SELECT r.id, p.nama FROM reports r JOIN villages v ON v.id = r.village_id
      JOIN pilihan p ON p.kec = v.kecamatan_kode AND p.i = abs(hashtext(r.id::text || 'p')) % least(p.n, 3)
      WHERE r.category = 'HARGA_PANGAN' AND r.unit_id IN (SELECT id FROM units WHERE parent_id = (SELECT id FROM units WHERE kode = ${kode}))
    )
    UPDATE reports r SET data = r.data || jsonb_build_object('nama_pasar', t.nama, 'jenis_lokasi', 'Pasar Tradisional') FROM t WHERE t.id = r.id`;
  console.log(`Demo ${kode}: ${n} laporan harga memakai nama pasar sungguhan.`);
}

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!file) throw new Error('Sebutkan berkas CSV titik pasar.');
  const rows = readCsv(file).filter((r) => KATEGORI.includes(r.kategori) && r.place_id && r.nama.trim() && Number(r.lat) && Number(r.lng));
  const data = rows.map((r) => ({ id: r.place_id.slice(0, 64), kategori: r.kategori, nama: r.nama.trim().slice(0, 200), alamat: r.alamat.trim().slice(0, 300) || null, lat: Number(r.lat), lng: Number(r.lng) }));

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`CREATE TEMP TABLE m_in (id text, kategori text, nama text, alamat text, lat float8, lng float8) ON COMMIT DROP`;
    for (let i = 0; i < data.length; i += BATCH) {
      await tx.$executeRaw`INSERT INTO m_in SELECT * FROM jsonb_to_recordset(${JSON.stringify(data.slice(i, i + BATCH))}::jsonb) AS x(id text, kategori text, nama text, alamat text, lat float8, lng float8)`;
    }
    await tx.$executeRaw`TRUNCATE markets`;
    await tx.$executeRaw`
      INSERT INTO markets (id, kategori, nama, alamat, lat, lng, village_kode)
      SELECT DISTINCT ON (d.kode, lower(m.nama)) m.id, m.kategori, m.nama, m.alamat, m.lat, m.lng, d.kode
      FROM m_in m CROSS JOIN LATERAL (
        SELECT v.kode_wilayah AS kode FROM villages v
        WHERE v.geom && ST_SetSRID(ST_MakePoint(m.lng, m.lat), 4326) AND ST_Intersects(v.geom, ST_SetSRID(ST_MakePoint(m.lng, m.lat), 4326)) LIMIT 1
      ) d
      ON CONFLICT (id) DO NOTHING`;
  }, { timeout: 300_000 });
  console.log(`${await prisma.market.count()} pasar dimuat dari ${data.length} baris.`);
  const demo = process.argv.find((a) => a.startsWith('--demo='))?.slice(7);
  if (demo) await relabelDemo(demo);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
