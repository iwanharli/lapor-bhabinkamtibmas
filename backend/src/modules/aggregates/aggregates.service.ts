import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Kunci advisory lock agar hanya satu instance yang menyegarkan agregat pada satu waktu. */
const LOCK_KEY = 72_707_412;
const WATERMARK = 'reports_watermark';

/** Hari lokal laporan menurut zona unit pelapor. */
const LOCAL_DAY = Prisma.sql`(r.occurred_at AT TIME ZONE u.timezone)::date`;

/**
 * Tabel agregat harian untuk dashboard (docs/teknis/12-skala-nasional.md §4.1).
 * Penyegaran inkremental: hanya pasangan (unit, hari lokal) yang laporannya berubah sejak penyegaran
 * terakhir yang dihitung ulang. Dashboard dapat tertinggal hingga satu interval.
 */
@Injectable()
export class AggregatesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AggregatesService.name);

  constructor(private prisma: PrismaService, private config: ConfigService, private scheduler: SchedulerRegistry) {}

  onApplicationBootstrap() {
    const seconds = Number(this.config.get('AGG_REFRESH_SECONDS', 60));
    if (seconds <= 0) return; // 0 = nonaktif (mis. instance yang hanya melayani API)
    const timer = setInterval(() => this.refresh().catch((e) => this.logger.error(e)), seconds * 1000);
    this.scheduler.addInterval('aggregates-refresh', timer);
    void this.refresh().catch((e) => this.logger.error(e));
  }

  /** Penyegaran inkremental. Mengembalikan jumlah pasangan (unit, hari) yang dihitung ulang. */
  async refresh(): Promise<number> {
    return this.withLock(async (tx) => {
      const state = await tx.aggState.findUnique({ where: { key: WATERMARK } });
      const since = state?.value ?? new Date(0);
      const runStart = new Date();
      const pairs = await tx.$queryRaw<{ unit_id: string; hari: Date }[]>`
        SELECT DISTINCT r.unit_id, ${LOCAL_DAY} AS hari
        FROM reports r JOIN units u ON u.id = r.unit_id
        WHERE r.updated_at > ${since} AND r.updated_at <= ${runStart}`;
      if (pairs.length) await this.recompute(tx, pairs);
      await tx.aggState.upsert({ where: { key: WATERMARK }, create: { key: WATERMARK, value: runStart }, update: { value: runStart } });
      if (pairs.length) this.logger.log(`Agregat diperbarui: ${pairs.length} pasangan unit-hari`);
      return pairs.length;
    });
  }

  /** Bangun ulang seluruh agregat (atau unit tertentu, mis. setelah zona waktunya berubah). */
  async rebuild(unitIds?: string[]): Promise<number> {
    return this.withLock(async (tx) => {
      const pairs = await tx.$queryRaw<{ unit_id: string; hari: Date }[]>`
        SELECT DISTINCT r.unit_id, ${LOCAL_DAY} AS hari
        FROM reports r JOIN units u ON u.id = r.unit_id
        ${unitIds ? Prisma.sql`WHERE r.unit_id = ANY(${unitIds}::uuid[])` : Prisma.empty}`;
      const unitFilter = unitIds ? Prisma.sql`WHERE unit_id = ANY(${unitIds}::uuid[])` : Prisma.empty;
      await tx.$executeRaw`DELETE FROM agg_unit_daily ${unitFilter}`;
      await tx.$executeRaw`DELETE FROM agg_user_daily ${unitFilter}`;
      await tx.$executeRaw`DELETE FROM agg_price_daily ${unitFilter}`;
      if (pairs.length) await this.recompute(tx, pairs);
      this.logger.log(`Agregat dibangun ulang: ${pairs.length} pasangan unit-hari`);
      return pairs.length;
    }, 600_000, true);
  }

  /** `wait`: tunggu kunci (bangun ulang tidak boleh terlewat diam-diam); tanpa itu, lewati bila instance lain sedang menyegarkan. */
  private async withLock<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, timeout = 120_000, wait = false): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        if (wait) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
          return fn(tx);
        }
        const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${LOCK_KEY}) AS locked`;
        if (!locked) return 0 as T; // instance lain sedang menyegarkan
        return fn(tx);
      },
      { timeout },
    );
  }

  /** Hapus & hitung ulang agregat untuk pasangan (unit, hari lokal). */
  private async recompute(tx: Prisma.TransactionClient, pairs: { unit_id: string; hari: Date }[]) {
    const units = pairs.map((p) => p.unit_id);
    const days = pairs.map((p) => p.hari.toISOString().slice(0, 10));
    const target = Prisma.sql`(SELECT * FROM unnest(${units}::uuid[], ${days}::date[]) AS t(unit_id, hari))`;
    const inTarget = Prisma.sql`(r.unit_id, ${LOCAL_DAY}) IN (SELECT unit_id, hari FROM ${target} x)`;

    await tx.$executeRaw`DELETE FROM agg_unit_daily a USING ${target} t WHERE a.unit_id = t.unit_id AND a.hari = t.hari`;
    await tx.$executeRaw`DELETE FROM agg_user_daily a USING ${target} t WHERE a.unit_id = t.unit_id AND a.hari = t.hari`;
    await tx.$executeRaw`DELETE FROM agg_price_daily a USING ${target} t WHERE a.unit_id = t.unit_id AND a.hari = t.hari`;

    await tx.$executeRaw`
      INSERT INTO agg_unit_daily (hari, unit_id, category, status, jumlah, prioritas, lokasi_janggal)
      SELECT ${LOCAL_DAY}, r.unit_id, r.category, r.status, count(*)::int,
             count(*) FILTER (WHERE r.priority)::int,
             count(*) FILTER (WHERE r.is_mock_location OR r.inside_village = false)::int
      FROM reports r JOIN units u ON u.id = r.unit_id
      WHERE r.status <> 'DRAFT' AND ${inTarget}
      GROUP BY 1, 2, 3, 4`;

    await tx.$executeRaw`
      INSERT INTO agg_user_daily (hari, user_id, unit_id, total, disetujui, menunggu, revisi, ditolak, lokasi_janggal,
        sambang, deteksi_dini, problem_solving, penyuluhan, harga_pangan, mapping_kk, ketahanan_pangan, last_at)
      SELECT ${LOCAL_DAY}, r.user_id, r.unit_id, count(*)::int,
             count(*) FILTER (WHERE r.status = 'APPROVED')::int,
             count(*) FILTER (WHERE r.status IN ('SUBMITTED','IN_REVIEW'))::int,
             count(*) FILTER (WHERE r.status = 'NEEDS_REVISION')::int,
             count(*) FILTER (WHERE r.status = 'REJECTED')::int,
             count(*) FILTER (WHERE r.is_mock_location OR r.inside_village = false)::int,
             count(*) FILTER (WHERE r.category = 'SAMBANG')::int,
             count(*) FILTER (WHERE r.category = 'DETEKSI_DINI')::int,
             count(*) FILTER (WHERE r.category = 'PROBLEM_SOLVING')::int,
             count(*) FILTER (WHERE r.category = 'PENYULUHAN')::int,
             count(*) FILTER (WHERE r.category = 'HARGA_PANGAN')::int,
             count(*) FILTER (WHERE r.category = 'MAPPING_KK')::int,
             count(*) FILTER (WHERE r.category = 'KETAHANAN_PANGAN')::int,
             max(r.occurred_at)
      FROM reports r JOIN units u ON u.id = r.unit_id
      WHERE r.status <> 'DRAFT' AND ${inTarget}
      GROUP BY 1, 2, 3`;

    await tx.$executeRaw`
      INSERT INTO agg_price_daily (hari, unit_id, commodity_id, kabupaten, jumlah_harga, sampel, minimum, maksimum, menipis, kosong)
      SELECT ${LOCAL_DAY}, r.unit_id, i.commodity_id, v.kabupaten, sum(i.harga)::bigint, count(*)::int, min(i.harga), max(i.harga),
             count(*) FILTER (WHERE i.stok = 'MENIPIS')::int, count(*) FILTER (WHERE i.stok = 'KOSONG')::int
      FROM report_items i JOIN reports r ON r.id = i.report_id JOIN units u ON u.id = r.unit_id JOIN villages v ON v.id = r.village_id
      WHERE r.status IN ('SUBMITTED','IN_REVIEW','APPROVED') AND ${inTarget}
      GROUP BY 1, 2, 3, 4`;
  }
}
