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

  async overview(me: AuthUser, { unitId, from, to }: Range) {
    const scope = await this.scopeSql(me, unitId);
    const base = Prisma.sql`FROM reports r WHERE ${scope} AND ${COUNTED} AND r.occurred_at BETWEEN ${from} AND ${to}`;

    const [byCategory, byStatus, daily, totals, bhabin] = await Promise.all([
      this.prisma.$queryRaw<{ category: string; jumlah: number }[]>`
        SELECT r.category::text, count(*)::int AS jumlah ${base} GROUP BY 1 ORDER BY 2 DESC`,
      this.prisma.$queryRaw<{ status: string; jumlah: number }[]>`
        SELECT r.status::text, count(*)::int AS jumlah ${base} GROUP BY 1`,
      this.prisma.$queryRaw<{ hari: string; category: string; jumlah: number }[]>`
        SELECT to_char(r.occurred_at AT TIME ZONE ru.timezone, 'YYYY-MM-DD') AS hari, r.category::text, count(*)::int AS jumlah
        FROM reports r JOIN units ru ON ru.id = r.unit_id
        WHERE ${scope} AND ${COUNTED} AND r.occurred_at BETWEEN ${from} AND ${to}
        GROUP BY 1, 2 ORDER BY 1`,
      this.prisma.$queryRaw<{ total: number; disetujui: number; menunggu: number; prioritas_terbuka: number; lokasi_janggal: number }[]>`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE r.status = 'APPROVED')::int AS disetujui,
               count(*) FILTER (WHERE r.status IN ('SUBMITTED','IN_REVIEW'))::int AS menunggu,
               count(*) FILTER (WHERE r.priority AND r.status IN ('SUBMITTED','IN_REVIEW'))::int AS prioritas_terbuka,
               count(*) FILTER (WHERE r.is_mock_location OR r.inside_village = false)::int AS lokasi_janggal
        ${base}`,
      this.prisma.$queryRaw<{ aktif: number }[]>`SELECT count(DISTINCT r.user_id)::int AS aktif ${base}`,
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

    // Periode pembanding dengan panjang yang sama, tepat sebelum periode terpilih.
    const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    const userScope = await this.scopeSql(me, unitId, Prisma.sql`u.unit_id`);
    const [prev, participation] = await Promise.all([
      this.prisma.$queryRaw<{ total: number; disetujui: number; bhabin_aktif: number }[]>`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE r.status = 'APPROVED')::int AS disetujui,
               count(DISTINCT r.user_id)::int AS bhabin_aktif
        FROM reports r WHERE ${scope} AND ${COUNTED} AND r.occurred_at >= ${prevFrom} AND r.occurred_at < ${from}`,
      this.prisma.$queryRaw<{ total_bhabin: number; tidak_aktif_7: number }[]>`
        SELECT count(*)::int AS total_bhabin,
               count(*) FILTER (WHERE NOT EXISTS (
                 SELECT 1 FROM reports r
                 WHERE r.user_id = u.id AND ${COUNTED} AND r.occurred_at >= now() - interval '7 days'
               ))::int AS tidak_aktif_7
        FROM users u WHERE u.role = 'BHABIN' AND u.active AND ${userScope}`,
    ]);

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

  /** Rekap kinerja tiap Bhabin aktif dalam cakupan pada rentang waktu. */
  async bhabinPerformance(me: AuthUser, { unitId, from, to }: Range) {
    const userScope = await this.scopeSql(me, unitId, Prisma.sql`u.unit_id`);
    return this.prisma.$queryRaw<BhabinPerformanceRow[]>`
      SELECT u.id, u.nrp, u.nama, u.pangkat, un.nama AS unit, un.timezone,
             (SELECT count(*) FROM user_villages uv WHERE uv.user_id = u.id AND uv.until IS NULL)::int AS desa,
             count(r.id)::int AS total,
             count(r.id) FILTER (WHERE r.status = 'APPROVED')::int AS disetujui,
             count(r.id) FILTER (WHERE r.status IN ('SUBMITTED','IN_REVIEW'))::int AS menunggu,
             count(r.id) FILTER (WHERE r.status = 'NEEDS_REVISION')::int AS revisi,
             count(r.id) FILTER (WHERE r.status = 'REJECTED')::int AS ditolak,
             count(r.id) FILTER (WHERE r.is_mock_location OR r.inside_village = false)::int AS lokasi_janggal,
             count(DISTINCT (r.occurred_at AT TIME ZONE un.timezone)::date)::int AS hari_aktif,
             max(r.occurred_at) AS terakhir,
             (SELECT max(r2.occurred_at) FROM reports r2 WHERE r2.user_id = u.id AND r2.status <> 'DRAFT') AS terakhir_sepanjang,
             count(r.id) FILTER (WHERE r.category = 'SAMBANG')::int AS sambang,
             count(r.id) FILTER (WHERE r.category = 'DETEKSI_DINI')::int AS deteksi_dini,
             count(r.id) FILTER (WHERE r.category = 'PROBLEM_SOLVING')::int AS problem_solving,
             count(r.id) FILTER (WHERE r.category = 'PENYULUHAN')::int AS penyuluhan,
             count(r.id) FILTER (WHERE r.category = 'HARGA_PANGAN')::int AS harga_pangan,
             count(r.id) FILTER (WHERE r.category = 'MAPPING_KK')::int AS mapping_kk,
             count(r.id) FILTER (WHERE r.category = 'KETAHANAN_PANGAN')::int AS ketahanan_pangan
      FROM users u
      JOIN units un ON un.id = u.unit_id
      LEFT JOIN reports r ON r.user_id = u.id AND ${COUNTED} AND r.occurred_at BETWEEN ${from} AND ${to}
      WHERE u.role = 'BHABIN' AND u.active AND ${userScope}
      GROUP BY u.id, un.nama, un.timezone
      ORDER BY total DESC, u.nama`;
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

  /** Harga terbaru (7 hari) per komoditas dan perubahan dibanding 7 hari sebelumnya. */
  async latestPrices(me: AuthUser, unitId?: string) {
    const scope = await this.scopeSql(me, unitId);
    return this.prisma.$queryRaw<
      { commodity_id: number; nama: string; satuan: string; rata2: number; minimum: number; maksimum: number; sampel: number; rata2_sebelumnya: number | null; stok_menipis: number; stok_kosong: number }[]
    >`
      WITH x AS (
        SELECT i.commodity_id, i.harga, i.stok,
               r.occurred_at >= now() - interval '7 days' AS kini
        FROM report_items i JOIN reports r ON r.id = i.report_id
        WHERE ${scope} AND ${PRICE_VALID} AND r.occurred_at >= now() - interval '14 days'
      )
      SELECT c.id AS commodity_id, c.nama, c.satuan_default AS satuan,
             round(avg(x.harga) FILTER (WHERE x.kini))::int AS rata2,
             min(x.harga) FILTER (WHERE x.kini)::int AS minimum,
             max(x.harga) FILTER (WHERE x.kini)::int AS maksimum,
             count(*) FILTER (WHERE x.kini)::int AS sampel,
             round(avg(x.harga) FILTER (WHERE NOT x.kini))::int AS rata2_sebelumnya,
             count(*) FILTER (WHERE x.kini AND x.stok = 'MENIPIS')::int AS stok_menipis,
             count(*) FILTER (WHERE x.kini AND x.stok = 'KOSONG')::int AS stok_kosong
      FROM commodities c LEFT JOIN x ON x.commodity_id = c.id
      WHERE c.active
      GROUP BY c.id ORDER BY c.urutan`;
  }

  /** Tren harga harian per komoditas. */
  async priceTrend(me: AuthUser, { unitId, from, to }: Range, commodityId?: number) {
    const scope = await this.scopeSql(me, unitId);
    return this.prisma.$queryRaw<{ hari: string; commodity_id: number; rata2: number; sampel: number }[]>`
      SELECT to_char(r.occurred_at AT TIME ZONE ru.timezone, 'YYYY-MM-DD') AS hari, i.commodity_id,
             round(avg(i.harga))::int AS rata2, count(*)::int AS sampel
      FROM report_items i JOIN reports r ON r.id = i.report_id JOIN units ru ON ru.id = r.unit_id
      WHERE ${scope} AND ${PRICE_VALID} AND r.occurred_at BETWEEN ${from} AND ${to}
        ${commodityId ? Prisma.sql`AND i.commodity_id = ${commodityId}` : Prisma.empty}
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
