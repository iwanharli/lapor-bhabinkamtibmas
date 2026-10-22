import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { UnitsService } from '../units/units.service';

/** Status yang dihitung sebagai laporan masuk (draft tidak termasuk). */
const COUNTED = Prisma.sql`r.status IN ('SUBMITTED','IN_REVIEW','NEEDS_REVISION','APPROVED','REJECTED')`;
/** Data harga dari laporan yang ditolak tidak dipakai. */
const PRICE_VALID = Prisma.sql`r.status IN ('SUBMITTED','IN_REVIEW','APPROVED')`;

export interface BhabinPerformanceRow {
  id: string;
  nrp: string;
  nama: string;
  pangkat: string | null;
  unit: string;
  timezone: string;
  desa: number;
  total: number;
  disetujui: number;
  menunggu: number;
  revisi: number;
  ditolak: number;
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

export interface PerformanceQuery {
  q?: string;
  sort?: 'total' | 'hari' | 'setuju' | 'nama';
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
    const ids = await this.units.descendantIds(unitId ?? me.unitId);
    return Prisma.sql`${column} = ANY(${ids}::uuid[])`;
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

    const [byCategory, byStatus, daily, totals, bhabin, prev, participation] = await Promise.all([
      this.prisma.$queryRaw<{ category: string; jumlah: number }[]>`
        SELECT a.category::text, sum(a.jumlah)::int AS jumlah ${fromUnitAgg} GROUP BY 1 ORDER BY 2 DESC`,
      this.prisma.$queryRaw<{ status: string; jumlah: number }[]>`
        SELECT a.status::text, sum(a.jumlah)::int AS jumlah ${fromUnitAgg} GROUP BY 1`,
      this.prisma.$queryRaw<{ hari: string; category: string; jumlah: number }[]>`
        SELECT to_char(a.hari, 'YYYY-MM-DD') AS hari, a.category::text, sum(a.jumlah)::int AS jumlah ${fromUnitAgg} GROUP BY 1, 2 ORDER BY 1`,
      this.prisma.$queryRaw<{ total: number; disetujui: number; menunggu: number; prioritas_terbuka: number; lokasi_janggal: number }[]>`
        SELECT coalesce(sum(a.jumlah), 0)::int AS total,
               coalesce(sum(a.jumlah) FILTER (WHERE a.status = 'APPROVED'), 0)::int AS disetujui,
               coalesce(sum(a.jumlah) FILTER (WHERE a.status IN ('SUBMITTED','IN_REVIEW')), 0)::int AS menunggu,
               coalesce(sum(a.prioritas) FILTER (WHERE a.status IN ('SUBMITTED','IN_REVIEW')), 0)::int AS prioritas_terbuka,
               coalesce(sum(a.lokasi_janggal), 0)::int AS lokasi_janggal
        ${fromUnitAgg}`,
      this.prisma.$queryRaw<{ aktif: number }[]>`
        SELECT count(DISTINCT a.user_id)::int AS aktif FROM agg_user_daily a JOIN units u ON u.id = a.unit_id WHERE ${where} AND a.total > 0`,
      this.prisma.$queryRaw<{ total: number; disetujui: number; bhabin_aktif: number }[]>`
        SELECT coalesce(sum(a.total), 0)::int AS total, coalesce(sum(a.disetujui), 0)::int AS disetujui, count(DISTINCT a.user_id)::int AS bhabin_aktif
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
        status: { in: ['SUBMITTED', 'IN_REVIEW'] },
        ...(me.role !== UserRole.SUPERADMIN || unitId ? { unitId: { in: await this.units.descendantIds(unitId ?? me.unitId) } } : {}),
      },
      select: { id: true, nomor: true, occurredAt: true, data: true, village: { select: { nama: true } }, user: { select: { nama: true } }, unit: { select: { timezone: true } } },
      orderBy: { occurredAt: 'desc' },
      take: 8,
    });

    return {
      range: { from, to, days: Math.round((to.getTime() - from.getTime()) / 86_400_000) },
      totals: { ...totals[0], bhabinAktif: bhabin[0].aktif, totalBhabin: participation[0].total_bhabin, tidakAktif7: participation[0].tidak_aktif_7 },
      previous: { total: prev[0].total, disetujui: prev[0].disetujui, bhabinAktif: prev[0].bhabin_aktif },
      byCategory,
      byStatus,
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
      setuju: Prisma.sql`(CASE WHEN coalesce(a.disetujui + a.revisi + a.ditolak, 0) = 0 THEN -1 ELSE a.disetujui::float / (a.disetujui + a.revisi + a.ditolak) END) DESC, u.nama`,
      nama: Prisma.sql`u.nama`,
    }[opts.sort ?? 'total'];

    const agg = Prisma.sql`
      SELECT g.user_id, sum(g.total)::int AS total, sum(g.disetujui)::int AS disetujui, sum(g.menunggu)::int AS menunggu,
             sum(g.revisi)::int AS revisi, sum(g.ditolak)::int AS ditolak, sum(g.lokasi_janggal)::int AS lokasi_janggal,
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
               coalesce(a.total, 0) AS total, coalesce(a.disetujui, 0) AS disetujui, coalesce(a.menunggu, 0) AS menunggu,
               coalesce(a.revisi, 0) AS revisi, coalesce(a.ditolak, 0) AS ditolak, coalesce(a.lokasi_janggal, 0) AS lokasi_janggal,
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

  /** Titik laporan untuk peta (maks. 5.000 titik terbaru dalam rentang). */
  async mapPoints(me: AuthUser, { unitId, from, to }: Range, f: { category?: string; status?: string; priority?: boolean }) {
    const scope = await this.scopeSql(me, unitId);
    return this.prisma.$queryRaw<
      { id: string; nomor: string; category: string; status: string; priority: boolean; lat: number; lng: number; occurred_at: Date; desa: string; bhabin: string; flagged: boolean }[]
    >`
      SELECT r.id, r.nomor, r.category::text, r.status::text, r.priority, r.lat, r.lng, r.occurred_at,
             v.nama AS desa, u.nama AS bhabin, (r.is_mock_location OR r.inside_village = false) AS flagged, ru.timezone
      FROM reports r JOIN villages v ON v.id = r.village_id JOIN users u ON u.id = r.user_id JOIN units ru ON ru.id = r.unit_id
      WHERE ${scope} AND ${COUNTED} AND r.occurred_at BETWEEN ${from} AND ${to}
        ${f.category ? Prisma.sql`AND r.category::text = ${f.category}` : Prisma.empty}
        ${f.status ? Prisma.sql`AND r.status::text = ${f.status}` : Prisma.empty}
        ${f.priority ? Prisma.sql`AND r.priority` : Prisma.empty}
      ORDER BY r.occurred_at DESC
      LIMIT 5000`;
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
    return this.prisma.$queryRaw<{ kecamatan: string; desa: string; rata2: number; sampel: number; terakhir: Date }[]>`
      SELECT v.kecamatan, v.nama AS desa, round(avg(i.harga))::int AS rata2, count(*)::int AS sampel, max(r.occurred_at) AS terakhir
      FROM report_items i JOIN reports r ON r.id = i.report_id JOIN villages v ON v.id = r.village_id
      WHERE ${scope} AND ${PRICE_VALID} AND i.commodity_id = ${commodityId} AND r.occurred_at >= now() - interval '7 days'
      GROUP BY 1, 2 ORDER BY 3 DESC`;
  }
}
