import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { UnitsService } from '../units/units.service';

/** Status yang dihitung sebagai laporan masuk (draft tidak termasuk). */
/** Laporan terkirim (tanpa verifikasi, laporan langsung final). */
const COUNTED = Prisma.sql`r.status = 'SUBMITTED'`;
const PRICE_VALID = COUNTED;

export interface BhabinPerformanceRow {
  id: string;
  nrp: string;
  nama: string;
  pangkat: string | null;
  unit: string;
  timezone: string;
  desa: number;
  total: number;
  lokasi_janggal: number;
  hari_aktif: number;
  terakhir: Date | null;
  terakhir_sepanjang: Date | null;
  sambang: number;
  deteksi_dini: number;
  problem_solving: number;
  penyuluhan: number;
  harga_pangan: number;
  mapping_kk: number;
  ketahanan_pangan: number;
}

/** Di atas jumlah ini peta menerima gugus, bukan titik. */
const MAP_POINT_LIMIT = Number(process.env.MAP_POINT_LIMIT ?? 1500);

export interface MapFilter {
  category?: string;
  status?: string;
  priority?: boolean;
  bbox?: [number, number, number, number];
  zoom?: number;
  regionCode?: string;
  regionLevel?: number;
}

interface MapPointRow {
  id: string; nomor: string; category: string; status: string; priority: boolean; lat: number; lng: number;
  occurred_at: Date; desa: string; bhabin: string; flagged: boolean; timezone: string;
}

export interface PerformanceQuery {
  q?: string;
  sort?: 'total' | 'hari' | 'nama';
  page?: number;
  limit?: number;
}

export interface Range {
  unitId?: string;
  from: Date;
  to: Date;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService, private units: UnitsService) {}

  /** Filter cakupan unit untuk kolom tertentu (default laporan `r.unit_id`). */
  private async scopeSql(me: AuthUser, unitId?: string, column = Prisma.sql`r.unit_id`) {
    if (unitId) await this.units.assertInScope(me.unitId, unitId);
    if (!unitId && me.role === UserRole.SUPERADMIN) return Prisma.sql`TRUE`;
    return Prisma.sql`${column} IN (SELECT unit_subtree(${unitId ?? me.unitId}::uuid))`;
  }

  /** Filter agregat: cakupan unit + rentang hari lokal (zona unit). */
  private async aggWhere(me: AuthUser, unitId: string | undefined, from: Date, to: Date, alias = Prisma.sql`a`) {
    const scope = await this.scopeSql(me, unitId, Prisma.sql`${alias}.unit_id`);
    return Prisma.sql`${scope} AND ${alias}.hari BETWEEN (${from}::timestamptz AT TIME ZONE u.timezone)::date AND (${to}::timestamptz AT TIME ZONE u.timezone)::date`;
  }

  /** Ringkasan dashboard dari agregat harian (docs/teknis/12 §4.1); daftar prioritas tetap dari tabel laporan. */
  async overview(me: AuthUser, { unitId, from, to }: Range) {
    const where = await this.aggWhere(me, unitId, from, to);
    const fromUnitAgg = Prisma.sql`FROM agg_unit_daily a JOIN units u ON u.id = a.unit_id WHERE ${where}`;
    const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    const prevTo = new Date(from.getTime() - 1);
    const prevWhere = await this.aggWhere(me, unitId, prevFrom, prevTo);
    const userScope = await this.scopeSql(me, unitId, Prisma.sql`u.unit_id`);

    const [byCategory, daily, totals, bhabin, prev, participation] = await Promise.all([
      this.prisma.$queryRaw<{ category: string; jumlah: number }[]>`
        SELECT a.category::text, sum(a.jumlah)::int AS jumlah ${fromUnitAgg} GROUP BY 1 ORDER BY 2 DESC`,
      this.prisma.$queryRaw<{ hari: string; category: string; jumlah: number }[]>`
        SELECT to_char(a.hari, 'YYYY-MM-DD') AS hari, a.category::text, sum(a.jumlah)::int AS jumlah ${fromUnitAgg} GROUP BY 1, 2 ORDER BY 1`,
      this.prisma.$queryRaw<{ total: number; prioritas: number; lokasi_janggal: number }[]>`
        SELECT coalesce(sum(a.jumlah), 0)::int AS total,
               coalesce(sum(a.prioritas), 0)::int AS prioritas,
               coalesce(sum(a.lokasi_janggal), 0)::int AS lokasi_janggal
        ${fromUnitAgg}`,
      this.prisma.$queryRaw<{ aktif: number }[]>`
        SELECT count(DISTINCT a.user_id)::int AS aktif FROM agg_user_daily a JOIN units u ON u.id = a.unit_id WHERE ${where} AND a.total > 0`,
      this.prisma.$queryRaw<{ total: number; bhabin_aktif: number }[]>`
        SELECT coalesce(sum(a.total), 0)::int AS total, count(DISTINCT a.user_id)::int AS bhabin_aktif
        FROM agg_user_daily a JOIN units u ON u.id = a.unit_id WHERE ${prevWhere} AND a.total > 0`,
      this.prisma.$queryRaw<{ total_bhabin: number; tidak_aktif_7: number }[]>`
        SELECT count(*)::int AS total_bhabin,
               count(*) FILTER (WHERE NOT EXISTS (
                 SELECT 1 FROM agg_user_daily x
                 WHERE x.user_id = u.id AND x.total > 0 AND x.hari > (now() AT TIME ZONE un.timezone)::date - 7
               ))::int AS tidak_aktif_7
        FROM users u JOIN units un ON un.id = u.unit_id WHERE u.role = 'BHABIN' AND u.active AND ${userScope}`,
    ]);

    const priority = await this.prisma.report.findMany({
      where: {
        priority: true,
        status: 'SUBMITTED',
        occurredAt: { gte: from, lte: to },
        ...(me.role !== UserRole.SUPERADMIN || unitId ? { unitId: { in: await this.units.descendantIds(unitId ?? me.unitId) } } : {}),
      },
      select: { id: true, nomor: true, occurredAt: true, data: true, village: { select: { nama: true } }, user: { select: { nama: true } }, unit: { select: { timezone: true } } },
      orderBy: { occurredAt: 'desc' },
      take: 8,
    });

    return {
      range: { from, to, days: Math.round((to.getTime() - from.getTime()) / 86_400_000) },
      totals: { ...totals[0], bhabinAktif: bhabin[0].aktif, totalBhabin: participation[0].total_bhabin, tidakAktif7: participation[0].tidak_aktif_7 },
      previous: { total: prev[0].total, bhabinAktif: prev[0].bhabin_aktif },
      byCategory,
      daily,
      priority,
    };
  }

  /**
   * Rekap kinerja Bhabin aktif dalam cakupan dari agregat harian, dengan paginasi, pencarian & urutan.
   * `summary` dihitung atas seluruh Bhabin dalam filter (bukan hanya halaman ini).
   */
  async bhabinPerformance(me: AuthUser, { unitId, from, to }: Range, opts: PerformanceQuery = {}) {
    const page = Math.max(opts.page ?? 1, 1);
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100_000);
    const span = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    const userScope = await this.scopeSql(me, unitId, Prisma.sql`u.unit_id`);
    const where = await this.aggWhere(me, unitId, from, to, Prisma.sql`g`);
    const search = opts.q ? Prisma.sql`AND (u.nama ILIKE ${'%' + opts.q + '%'} OR u.nrp LIKE ${opts.q + '%'})` : Prisma.empty;
    const order = {
      total: Prisma.sql`total DESC, u.nama`,
      hari: Prisma.sql`hari_aktif DESC, total DESC, u.nama`,
      nama: Prisma.sql`u.nama`,
    }[opts.sort ?? 'total'];

    const agg = Prisma.sql`
      SELECT g.user_id, sum(g.total)::int AS total, sum(g.lokasi_janggal)::int AS lokasi_janggal,
             count(*) FILTER (WHERE g.total > 0)::int AS hari_aktif, max(g.last_at) AS terakhir,
             sum(g.sambang)::int AS sambang, sum(g.deteksi_dini)::int AS deteksi_dini, sum(g.problem_solving)::int AS problem_solving,
             sum(g.penyuluhan)::int AS penyuluhan, sum(g.harga_pangan)::int AS harga_pangan, sum(g.mapping_kk)::int AS mapping_kk,
             sum(g.ketahanan_pangan)::int AS ketahanan_pangan
      FROM agg_user_daily g JOIN units u ON u.id = g.unit_id WHERE ${where} GROUP BY g.user_id`;
    const base = Prisma.sql`FROM users u JOIN units un ON un.id = u.unit_id LEFT JOIN (${agg}) a ON a.user_id = u.id
      WHERE u.role = 'BHABIN' AND u.active AND ${userScope} ${search}`;

    const [data, [summary]] = await Promise.all([
      this.prisma.$queryRaw<BhabinPerformanceRow[]>`
        SELECT u.id, u.nrp, u.nama, u.pangkat, un.nama AS unit, un.timezone,
               (SELECT count(*) FROM user_villages uv WHERE uv.user_id = u.id AND uv.until IS NULL)::int AS desa,
               coalesce(a.total, 0) AS total, coalesce(a.lokasi_janggal, 0) AS lokasi_janggal,
               coalesce(a.hari_aktif, 0) AS hari_aktif, a.terakhir,
               (SELECT max(x.last_at) FROM agg_user_daily x WHERE x.user_id = u.id) AS terakhir_sepanjang,
               coalesce(a.sambang, 0) AS sambang, coalesce(a.deteksi_dini, 0) AS deteksi_dini, coalesce(a.problem_solving, 0) AS problem_solving,
               coalesce(a.penyuluhan, 0) AS penyuluhan, coalesce(a.harga_pangan, 0) AS harga_pangan, coalesce(a.mapping_kk, 0) AS mapping_kk,
               coalesce(a.ketahanan_pangan, 0) AS ketahanan_pangan
        ${base}
        ORDER BY ${order}
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      this.prisma.$queryRaw<{ bhabin: number; melapor: number; total: number; rata_hari: number; kurang: number }[]>`
        SELECT count(*)::int AS bhabin, count(*) FILTER (WHERE coalesce(a.total, 0) > 0)::int AS melapor,
               coalesce(sum(a.total), 0)::int AS total, coalesce(avg(coalesce(a.hari_aktif, 0)), 0)::float AS rata_hari,
               count(*) FILTER (WHERE coalesce(a.hari_aktif, 0) < ${span} * 0.4)::int AS kurang
        ${base}`,
    ]);
    return { data, meta: { page, limit, total: summary.bhabin }, summary: { ...summary, hari: span } };
  }

  /** Filter laporan untuk peta: cakupan, periode, kategori/status/prioritas, dan bbox (w,s,e,n). */
  private async mapWhere(me: AuthUser, { unitId, from, to }: Range, f: MapFilter) {
    const scope = await this.scopeSql(me, unitId);
    const b = f.bbox;
    return Prisma.sql`${scope} AND ${COUNTED} AND r.occurred_at BETWEEN ${from} AND ${to}
      ${f.category ? Prisma.sql`AND r.category::text = ${f.category}` : Prisma.empty}
      ${f.status ? Prisma.sql`AND r.status::text = ${f.status}` : Prisma.empty}
      ${f.priority ? Prisma.sql`AND r.priority` : Prisma.empty}
      ${f.regionCode && f.regionLevel ? Prisma.sql`AND r.village_id IN (
        -- Tidak berkorelasi: daftar desa wilayah dihitung sekali (bukan per laporan) lalu di-hash.
        WITH RECURSIVE selected_regions AS (
          SELECT kode FROM regions WHERE kode = ${f.regionCode} AND level = ${f.regionLevel}
          UNION ALL
          SELECT child.kode FROM regions child JOIN selected_regions parent ON child.parent_kode = parent.kode
        )
        SELECT v_region.id FROM villages v_region JOIN selected_regions sr ON sr.kode = v_region.kecamatan_kode
      )` : Prisma.empty}
      ${b ? Prisma.sql`AND r.location && ST_MakeEnvelope(${b[0]}, ${b[1]}, ${b[2]}, ${b[3]}, 4326)::geography` : Prisma.empty}`;
  }

  /**
   * Isi peta untuk area tampilan (docs/teknis/12 §4.2): titik apa adanya bila sedikit,
   * selain itu gugus per sel grid yang ukurannya mengikuti zoom (±64 px per sel).
   */
  async mapView(me: AuthUser, range: Range, f: MapFilter) {
    const where = await this.mapWhere(me, range, f);
    const [{ total }] = await this.prisma.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM reports r WHERE ${where}`;

    // Zoom sangat dekat: selalu titik (dibatasi), gugus tidak lagi berguna.
    if (total <= MAP_POINT_LIMIT || (f.zoom ?? 0) >= 15) {
      const points = await this.prisma.$queryRaw<MapPointRow[]>`
        SELECT r.id, r.nomor, r.category::text, r.status::text, r.priority, r.lat, r.lng, r.occurred_at,
               v.nama AS desa, u.nama AS bhabin, (r.is_mock_location OR r.inside_village = false) AS flagged, ru.timezone
        FROM reports r JOIN villages v ON v.id = r.village_id JOIN users u ON u.id = r.user_id JOIN units ru ON ru.id = r.unit_id
        WHERE ${where}
        ORDER BY r.occurred_at DESC
        LIMIT 5000`;
      return { mode: 'points' as const, total, points };
    }

    // Sel ±128 px pada zoom ini, agar gugus tidak saling menumpuk.
    const cell = 180 / 2 ** Math.min(Math.max(f.zoom ?? 5, 3), 18);
    const clusters = await this.prisma.$queryRaw<{ lat: number; lng: number; jumlah: number; prioritas: number; category: string }[]>`
      SELECT avg(r.lat)::float AS lat, avg(r.lng)::float AS lng, count(*)::int AS jumlah,
             count(*) FILTER (WHERE r.priority)::int AS prioritas, mode() WITHIN GROUP (ORDER BY r.category)::text AS category
      FROM reports r WHERE ${where}
      GROUP BY floor(r.lng / ${cell}), floor(r.lat / ${cell})`;
    return { mode: 'clusters' as const, total, clusters };
  }

  /** Ringkasan panel peta: jumlah per kategori, lokasi janggal, dan 20 laporan prioritas terbaru (strip prioritas). */
  async mapSummary(me: AuthUser, range: Range, f: MapFilter) {
    const where = await this.mapWhere(me, range, { priority: f.priority, regionCode: f.regionCode, regionLevel: f.regionLevel });
    const [byCategory, [flags], priority] = await Promise.all([
      this.prisma.$queryRaw<{ category: string; jumlah: number }[]>`
        SELECT r.category::text, count(*)::int AS jumlah FROM reports r WHERE ${where} GROUP BY 1`,
      this.prisma.$queryRaw<{ flagged: number }[]>`
        SELECT count(*) FILTER (WHERE r.is_mock_location OR r.inside_village = false)::int AS flagged
        FROM reports r WHERE ${where} ${f.category ? Prisma.sql`AND r.category::text = ${f.category}` : Prisma.empty}`,
      this.prisma.$queryRaw<MapPointRow[]>`
        SELECT r.id, r.nomor, r.category::text, r.status::text, r.priority, r.lat, r.lng, r.occurred_at,
               v.nama AS desa, u.nama AS bhabin, (r.is_mock_location OR r.inside_village = false) AS flagged, ru.timezone
        FROM reports r JOIN villages v ON v.id = r.village_id JOIN users u ON u.id = r.user_id JOIN units ru ON ru.id = r.unit_id
        WHERE ${where} AND r.priority ${f.category ? Prisma.sql`AND r.category::text = ${f.category}` : Prisma.empty}
        ORDER BY r.occurred_at DESC LIMIT 20`,
    ]);
    return {
      total: byCategory.reduce((n, c) => n + c.jumlah, 0),
      byCategory: Object.fromEntries(byCategory.map((c) => [c.category, c.jumlah])),
      flagged: flags.flagged,
      priority,
    };
  }

  /** Harga rata-rata 7 hari terakhir per komoditas dan perubahan dibanding 7 hari sebelumnya (dari agregat). */
  async latestPrices(me: AuthUser, unitId?: string) {
    const scope = await this.scopeSql(me, unitId, Prisma.sql`a.unit_id`);
    return this.prisma.$queryRaw<
      { commodity_id: number; nama: string; satuan: string; rata2: number; minimum: number; maksimum: number; sampel: number; rata2_sebelumnya: number | null; stok_menipis: number; stok_kosong: number }[]
    >`
      WITH x AS (
        SELECT a.*, a.hari > (now() AT TIME ZONE u.timezone)::date - 7 AS kini
        FROM agg_price_daily a JOIN units u ON u.id = a.unit_id
        WHERE ${scope} AND a.hari > (now() AT TIME ZONE u.timezone)::date - 14
      )
      SELECT c.id AS commodity_id, c.nama, c.satuan_default AS satuan,
             round(sum(x.jumlah_harga) FILTER (WHERE x.kini)::numeric / nullif(sum(x.sampel) FILTER (WHERE x.kini), 0))::int AS rata2,
             min(x.minimum) FILTER (WHERE x.kini) AS minimum,
             max(x.maksimum) FILTER (WHERE x.kini) AS maksimum,
             coalesce(sum(x.sampel) FILTER (WHERE x.kini), 0)::int AS sampel,
             round(sum(x.jumlah_harga) FILTER (WHERE NOT x.kini)::numeric / nullif(sum(x.sampel) FILTER (WHERE NOT x.kini), 0))::int AS rata2_sebelumnya,
             coalesce(sum(x.menipis) FILTER (WHERE x.kini), 0)::int AS stok_menipis,
             coalesce(sum(x.kosong) FILTER (WHERE x.kini), 0)::int AS stok_kosong
      FROM commodities c LEFT JOIN x ON x.commodity_id = c.id
      WHERE c.active
      GROUP BY c.id ORDER BY c.urutan`;
  }

  /** Tren harga harian per komoditas (dari agregat). */
  async priceTrend(me: AuthUser, { unitId, from, to }: Range, commodityId?: number) {
    const where = await this.aggWhere(me, unitId, from, to);
    return this.prisma.$queryRaw<{ hari: string; commodity_id: number; rata2: number; sampel: number }[]>`
      SELECT to_char(a.hari, 'YYYY-MM-DD') AS hari, a.commodity_id,
             round(sum(a.jumlah_harga)::numeric / nullif(sum(a.sampel), 0))::int AS rata2, sum(a.sampel)::int AS sampel
      FROM agg_price_daily a JOIN units u ON u.id = a.unit_id
      WHERE ${where} ${commodityId ? Prisma.sql`AND a.commodity_id = ${commodityId}` : Prisma.empty}
      GROUP BY 1, 2 ORDER BY 1`;
  }

  /** Harga terbaru per wilayah (kecamatan) untuk satu komoditas. */
  async pricesByArea(me: AuthUser, commodityId: number, unitId?: string) {
    const scope = await this.scopeSql(me, unitId);
    return this.prisma.$queryRaw<{ id: string; kabupaten: string; kecamatan: string; desa: string; rata2: number; sampel: number; terakhir: Date }[]>`
      SELECT v.id, v.kabupaten, v.kecamatan, v.nama AS desa, round(avg(i.harga))::int AS rata2, count(*)::int AS sampel, max(r.occurred_at) AS terakhir
      FROM report_items i JOIN reports r ON r.id = i.report_id JOIN villages v ON v.id = r.village_id
      WHERE ${scope} AND ${PRICE_VALID} AND i.commodity_id = ${commodityId} AND r.occurred_at >= now() - interval '7 days'
      GROUP BY v.id ORDER BY rata2 DESC`;
  }

  /**
   * Rekap keluarga & stunting dari laporan Mapping Data Keluarga v2 terkirim, per desa.
   * Angka kesehatan dari kolom ringkasan `health` (dihitung saat kirim, umur pada waktu kegiatan) sehingga isian per orang tetap terenkripsi.
   * KK yang dilaporkan lebih dari sekali (No. KK sama, lewat sidik `kk_hash`) hanya dihitung dari laporan terbarunya.
   */
  async stunting(me: AuthUser, unitId?: string) {
    const scope = await this.scopeSql(me, unitId);
    const rows = await this.prisma.$queryRaw<Record<string, number | string>[]>`
      WITH k AS (
        -- Satu KK dihitung sekali: laporan terbaru per sidik No. KK (laporan tanpa No. KK berdiri sendiri).
        SELECT DISTINCT ON (coalesce(r.kk_hash, r.id::text)) r.village_id, r.data, r.health FROM reports r
        WHERE ${scope} AND r.category = 'MAPPING_KK' AND r.status = 'SUBMITTED' AND r.schema_version = 2
        ORDER BY coalesce(r.kk_hash, r.id::text), r.submitted_at DESC
      ), kv AS (
        SELECT village_id, count(*)::int AS kk,
          coalesce(sum((health->>'balita')::int), 0)::int AS balita,
          coalesce(sum((health->>'stunting')::int), 0)::int AS stunting,
          coalesce(sum((health->>'berisiko')::int), 0)::int AS berisiko,
          coalesce(sum((health->>'belum_ditangani')::int), 0)::int AS belum_ditangani,
          coalesce(sum((health->>'belum_diketahui')::int), 0)::int AS belum_diketahui,
          coalesce(sum((health->>'ibu_hamil')::int), 0)::int AS ibu_hamil,
          coalesce(sum((health->>'ibu_kek')::int), 0)::int AS ibu_kek,
          coalesce(sum((health->>'remaja_anemia')::int), 0)::int AS remaja_anemia,
          coalesce(sum((SELECT count(*) FROM jsonb_array_elements(coalesce(data->'anggota', '[]'::jsonb)) a WHERE a->>'calon_pengantin' = 'Ya')), 0)::int AS catin,
          count(*) FILTER (WHERE data ? 'jamban' AND data->>'jamban' <> 'Jamban sendiri dengan septic tank')::int AS jamban_tidak_layak,
          count(*) FILTER (WHERE data->>'jamban' = 'Tidak ada (BAB sembarangan)')::int AS bab_sembarangan,
          count(*) FILTER (WHERE data->>'sumber_air_minum' IN ('Sumur/mata air tidak terlindung', 'Sungai/danau/irigasi'))::int AS air_tidak_layak,
          count(*) FILTER (WHERE data->>'perokok_dalam_rumah' = 'Ada')::int AS perokok,
          count(*) FILTER (WHERE data ? 'sumber_air_minum')::int AS kk_sanitasi
        FROM k GROUP BY village_id
      )
      SELECT v.id, v.nama AS desa, v.kecamatan, v.kabupaten, kv.*
      FROM kv JOIN villages v ON v.id = kv.village_id
      ORDER BY kv.belum_ditangani DESC, kv.stunting + kv.berisiko DESC, kv.kk DESC`;
    const keys = ['kk', 'kk_sanitasi', 'balita', 'stunting', 'berisiko', 'belum_ditangani', 'belum_diketahui', 'ibu_hamil', 'ibu_kek', 'remaja_anemia', 'catin', 'jamban_tidak_layak', 'bab_sembarangan', 'air_tidak_layak', 'perokok'] as const;
    const total = Object.fromEntries(keys.map((k) => [k, rows.reduce((n, r) => n + Number(r[k] ?? 0), 0)]));
    const [{ laporan }] = await this.prisma.$queryRaw<{ laporan: number }[]>`
      SELECT count(*)::int AS laporan FROM reports r WHERE ${scope} AND r.category = 'MAPPING_KK' AND r.status = 'SUBMITTED' AND r.schema_version = 2`;
    return { total, desa: rows.length, laporan, villages: rows.slice(0, 300) };
  }

  /**
   * Peta tematik stunting: angka keluarga per wilayah (provinsi/kabupaten/kecamatan/desa sesuai zoom) di dalam bbox.
   * Hanya wilayah yang punya data Mapping; tanpa titik rumah agar keluarga tidak bisa ditunjuk.
   */
  async stuntingMap(me: AuthUser, level: 1 | 2 | 3 | 4, bbox: [number, number, number, number], unitId?: string, withExtent = false) {
    const scope = await this.scopeSql(me, unitId);
    const env = Prisma.sql`ST_MakeEnvelope(${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}, 4326)`;
    const key = level === 4 ? Prisma.sql`v.id::text` : level === 3 ? Prisma.sql`v.kecamatan_kode` : level === 2 ? Prisma.sql`left(v.kecamatan_kode, 5)` : Prisma.sql`left(v.kecamatan_kode, 2)`;
    const H = (k: string) => Prisma.raw(`coalesce(sum((k.health->>'${k}')::int), 0)::int AS ${k}`);
    const metrics = Prisma.sql`
      count(*)::int AS kk, ${H('balita')}, ${H('stunting')}, ${H('berisiko')}, ${H('belum_ditangani')},
      count(*) FILTER (WHERE k.data ? 'jamban' AND k.data->>'jamban' <> 'Jamban sendiri dengan septic tank')::int AS jamban_tidak_layak,
      count(*) FILTER (WHERE k.data->>'sumber_air_minum' IN ('Sumur/mata air tidak terlindung', 'Sungai/danau/irigasi'))::int AS air_tidak_layak,
      count(*) FILTER (WHERE k.data ? 'sumber_air_minum')::int AS kk_sanitasi`;
    const kk = Prisma.sql`
      SELECT DISTINCT ON (coalesce(r.kk_hash, r.id::text)) r.village_id, r.data, r.health FROM reports r
      WHERE ${scope} AND r.category = 'MAPPING_KK' AND r.status = 'SUBMITTED' AND r.schema_version = 2
        ${level >= 3 ? Prisma.sql`AND r.village_id IN (SELECT id FROM villages WHERE geom && ${env})` : Prisma.empty}
      ORDER BY coalesce(r.kk_hash, r.id::text), r.submitted_at DESC`;
    const rows = level === 4
      ? await this.prisma.$queryRaw<Record<string, unknown>[]>`
          WITH k AS (${kk}), agg AS (
            SELECT v.id::text AS kode, ${metrics} FROM k JOIN villages v ON v.id = k.village_id
            WHERE v.geom && ${env} GROUP BY v.id)
          SELECT agg.*, v.nama, concat_ws(' › ', v.provinsi, v.kabupaten, v.kecamatan) AS chain,
                 ST_AsGeoJSON(ST_SimplifyPreserveTopology(v.geom, 0.0001), 5) AS geometry
          FROM agg JOIN villages v ON v.id::text = agg.kode LIMIT 3001`
      : await this.prisma.$queryRaw<Record<string, unknown>[]>`
          WITH k AS (${kk}), agg AS (
            SELECT ${key} AS kode, ${metrics} FROM k JOIN villages v ON v.id = k.village_id
            WHERE v.kecamatan_kode IS NOT NULL GROUP BY 1)
          SELECT agg.*, rg.nama, rg.chain, ST_AsGeoJSON(rg.geom_s, 5) AS geometry
          FROM agg JOIN regions rg ON rg.kode = agg.kode AND rg.level = ${level}
          WHERE rg.geom_s && ${env} LIMIT 3001`;
    // Muatan pertama: batas desa berdata di cakupan pengguna agar peta langsung mengarah ke wilayahnya.
    const [extent] = withExtent ? await this.prisma.$queryRaw<{ w: number | null; s: number | null; e: number | null; n: number | null }[]>`
      SELECT ST_XMin(x)::float w, ST_YMin(x)::float s, ST_XMax(x)::float e, ST_YMax(x)::float n FROM (
        SELECT ST_Extent(v.geom) x FROM villages v
        WHERE v.id IN (SELECT r.village_id FROM reports r WHERE ${scope} AND r.category = 'MAPPING_KK' AND r.status = 'SUBMITTED')) t` : [];
    return {
      type: 'FeatureCollection' as const,
      level,
      extent: extent?.w != null ? [extent.w, extent.s, extent.e, extent.n] : null,
      truncated: rows.length > 3000,
      features: rows.slice(0, 3000).map(({ geometry, ...props }) => ({ type: 'Feature' as const, properties: { ...props, level }, geometry: JSON.parse(geometry as string) })),
    };
  }
}
