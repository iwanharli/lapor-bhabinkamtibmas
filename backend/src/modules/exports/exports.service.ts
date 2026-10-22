import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { exportName, toCsv, waktu } from '../../common/csv';
import { localDate } from '../../common/time';
import { PrismaService } from '../../prisma/prisma.service';
import { range } from '../analytics/analytics.controller';
import { AnalyticsService } from '../analytics/analytics.service';
import { ListReportsQuery } from '../reports/reports.dto';
import { ReportsService } from '../reports/reports.service';
import { UnitsService } from '../units/units.service';

/** Batas baris ekspor; ekspor lewat antrean tidak menahan request sehingga bisa lebih besar. */
export const MAX_ROWS = Number(process.env.EXPORT_MAX_ROWS ?? 200_000);

const CATEGORY: Record<string, string> = {
  SAMBANG: 'Sambang / DDS', DETEKSI_DINI: 'Deteksi Dini', PROBLEM_SOLVING: 'Problem Solving', PENYULUHAN: 'Penyuluhan',
  HARGA_PANGAN: 'Harga Pangan', MAPPING_KK: 'Mapping KK', KETAHANAN_PANGAN: 'Ketahanan Pangan',
};
const STATUS: Record<string, string> = {
  DRAFT: 'Draft', SUBMITTED: 'Terkirim', IN_REVIEW: 'Ditinjau', NEEDS_REVISION: 'Perlu Revisi', APPROVED: 'Disetujui', REJECTED: 'Ditolak',
};
const ROLE: Record<string, string> = {
  BHABIN: 'Bhabinkamtibmas', VERIFIKATOR: 'Verifikator', PIMPINAN: 'Pimpinan', ADMIN_UNIT: 'Admin Unit', SUPERADMIN: 'Superadmin', AUDITOR: 'Auditor', INTEGRASI: 'Integrasi',
};

const VIEWERS: UserRole[] = [UserRole.VERIFIKATOR, UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR];
/** Jenis ekspor beserta peran yang boleh membuatnya. */
export const EXPORT_KINDS = {
  reports: VIEWERS,
  prices: VIEWERS,
  performance: VIEWERS,
  users: [UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR],
} satisfies Record<string, UserRole[]>;
export type ExportKind = keyof typeof EXPORT_KINDS;

type SchemaJson = { fields: { key: string; label: string; type: string; sensitive?: boolean }[] };
type Params = Record<string, string | undefined>;
export interface ExportResult { name: string; csv: string; rows: number }

@Injectable()
export class ExportsService {
  constructor(
    private prisma: PrismaService,
    private reports: ReportsService,
    private analytics: AnalyticsService,
    private units: UnitsService,
  ) {}

  assertAllowed(me: AuthUser, kind: string): asserts kind is ExportKind {
    const roles = EXPORT_KINDS[kind as ExportKind] as UserRole[] | undefined;
    if (!roles) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Jenis ekspor tidak dikenal' });
    if (!roles.includes(me.role)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Anda tidak berhak membuat ekspor ini' });
  }

  build(me: AuthUser, kind: ExportKind, params: Params): Promise<ExportResult> {
    switch (kind) {
      case 'reports': return this.reportsCsv(me, params);
      case 'prices': return this.pricesCsv(me);
      case 'performance': return this.performanceCsv(me, params);
      case 'users': return this.usersCsv(me, params);
    }
  }

  /** Laporan sesuai filter daftar laporan. Field bertanda sensitif di skema tidak diekspor. */
  private async reportsCsv(me: AuthUser, params: Params): Promise<ExportResult> {
    // Filter dari query string atau antrean: validasi & konversi sama seperti daftar laporan.
    const q = plainToInstance(ListReportsQuery, params);
    const errors = await validate(q, { whitelist: true });
    if (errors.length) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Filter ekspor tidak valid', details: errors.flatMap((e) => Object.values(e.constraints ?? {})) });
    const where = await this.reports.buildWhere(me, q);
    const [rows, schemas] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: MAX_ROWS,
        include: {
          user: { select: { nama: true, pangkat: true, nrp: true } },
          unit: { select: { nama: true, timezone: true } },
          village: { select: { nama: true, kecamatan: true, kabupaten: true } },
          reviewedBy: { select: { nama: true, pangkat: true } },
          items: { include: { commodity: { select: { nama: true } } } },
          _count: { select: { attachments: true } },
        },
      }),
      this.prisma.formSchema.findMany(),
    ]);
    const schemaOf = new Map(schemas.map((s) => [`${s.category}:${s.version}`, s.schema as unknown as SchemaJson]));

    const isian = (r: (typeof rows)[number]) => {
      const fields = schemaOf.get(`${r.category}:${r.schemaVersion}`)?.fields ?? [];
      const data = r.data as Record<string, unknown>;
      const parts = fields
        .filter((f) => !f.sensitive && !['photo', 'file', 'repeater'].includes(f.type) && data[f.key] != null && data[f.key] !== '')
        .map((f) => `${f.label}: ${Array.isArray(data[f.key]) ? (data[f.key] as unknown[]).join(', ') : data[f.key]}`);
      const items = r.items.map((i) => `${i.commodity.nama} Rp${i.harga}/${i.satuan} (${i.stok.toLowerCase()})`);
      return [...parts, ...(items.length ? [`Harga: ${items.join(', ')}`] : [])].join(' | ');
    };
    const person = (p?: { nama: string; pangkat: string | null } | null) => (p ? [p.pangkat, p.nama].filter(Boolean).join(' ') : '');

    const csv = toCsv(
      ['Nomor', 'Kategori', 'Status', 'Prioritas', 'Waktu kegiatan (setempat)', 'Bhabin', 'NRP', 'Unit', 'Desa', 'Kecamatan', 'Kabupaten',
        'Lintang', 'Bujur', 'Akurasi GPS (m)', 'Di dalam desa binaan', 'Lokasi palsu', 'Lampiran', 'Diverifikasi oleh', 'Waktu verifikasi (setempat)', 'Catatan verifikator', 'Isian'],
      rows.map((r) => [
        r.nomor, CATEGORY[r.category], STATUS[r.status], r.priority, waktu(r.occurredAt, r.unit.timezone), person(r.user), r.user.nrp, r.unit.nama,
        r.village.nama, r.village.kecamatan, r.village.kabupaten, r.lat.toFixed(6), r.lng.toFixed(6), r.gpsAccuracyM != null ? Math.round(r.gpsAccuracyM) : '',
        r.insideVillage, r.isMockLocation, r._count.attachments, person(r.reviewedBy), waktu(r.reviewedAt, r.unit.timezone), r.reviewNote, isian(r),
      ]),
    );
    return { name: exportName('laporan', await this.units.timezoneOf(me.unitId)), csv, rows: rows.length };
  }

  private async pricesCsv(me: AuthUser): Promise<ExportResult> {
    const rows = await this.analytics.latestPrices(me);
    const csv = toCsv(
      ['Komoditas', 'Satuan', 'Rata-rata 7 hari (Rp)', 'Rata-rata 7 hari sebelumnya (Rp)', 'Perubahan (%)', 'Terendah (Rp)', 'Tertinggi (Rp)', 'Sampel', 'Stok menipis', 'Stok kosong'],
      rows.map((p) => [
        p.nama, p.satuan, p.rata2, p.rata2_sebelumnya,
        p.rata2 && p.rata2_sebelumnya ? (Math.round(((p.rata2 - p.rata2_sebelumnya) / p.rata2_sebelumnya) * 1000) / 10).toString().replace('.', ',') : '',
        p.minimum, p.maksimum, p.sampel, p.stok_menipis, p.stok_kosong,
      ]),
    );
    return { name: exportName('harga_pangan', await this.units.timezoneOf(me.unitId)), csv, rows: rows.length };
  }

  private async performanceCsv(me: AuthUser, q: Params): Promise<ExportResult> {
    const r = range(q, 30);
    const { data: rows } = await this.analytics.bhabinPerformance(me, r, { q: q.q || undefined, limit: MAX_ROWS });
    // Jumlah tanggal kalender (zona pengekspor) yang tercakup rentang, termasuk hari pertama & terakhir.
    const tz = await this.units.timezoneOf(me.unitId);
    const day = (d: Date) => Date.parse(localDate(d, tz));
    const days = Math.round((day(r.to) - day(r.from)) / 86_400_000) + 1;
    const csv = toCsv(
      ['NRP', 'Nama', 'Pangkat', 'Unit', 'Desa binaan', 'Total laporan', 'Hari aktif', `Hari aktif (%) dari ${days} hari`, 'Disetujui', 'Menunggu', 'Revisi', 'Ditolak', 'Lokasi perlu dicek',
        'Sambang', 'Deteksi Dini', 'Problem Solving', 'Penyuluhan', 'Harga Pangan', 'Mapping KK', 'Ketahanan Pangan', 'Laporan terakhir (setempat)'],
      rows.map((b) => [
        b.nrp, b.nama, b.pangkat, b.unit, b.desa, b.total, b.hari_aktif, Math.min(Math.round((b.hari_aktif / days) * 100), 100), b.disetujui, b.menunggu, b.revisi, b.ditolak, b.lokasi_janggal,
        b.sambang, b.deteksi_dini, b.problem_solving, b.penyuluhan, b.harga_pangan, b.mapping_kk, b.ketahanan_pangan, waktu(b.terakhir_sepanjang, b.timezone),
      ]),
    );
    return { name: exportName('kinerja_bhabin', tz), csv, rows: rows.length };
  }

  private async usersCsv(me: AuthUser, q: Params): Promise<ExportResult> {
    if (q.unitId) await this.units.assertInScope(me.unitId, q.unitId);
    const rows = await this.prisma.user.findMany({
      where: {
        unitId: { in: await this.units.descendantIds(q.unitId || me.unitId) },
        ...(q.role && { role: q.role as UserRole }),
        ...(q.active && { active: q.active === 'true' }),
      },
      orderBy: [{ unit: { nama: 'asc' } }, { nama: 'asc' }],
      take: MAX_ROWS,
      include: { unit: { select: { nama: true, kode: true, timezone: true } }, villages: { where: { until: null }, include: { village: { select: { nama: true, kodeWilayah: true } } } } },
    });
    const csv = toCsv(
      ['NRP', 'Nama', 'Pangkat', 'Jabatan', 'Peran', 'Kode unit', 'Unit', 'No. HP', 'Status', 'Login terakhir (setempat)', 'Desa binaan'],
      rows.map((u) => [
        u.nrp, u.nama, u.pangkat, u.jabatan, ROLE[u.role], u.unit.kode, u.unit.nama, u.phone, u.active ? 'Aktif' : 'Nonaktif', waktu(u.lastLoginAt, u.unit.timezone),
        u.villages.map((v) => v.village.nama).join(', '),
      ]),
    );
    return { name: exportName('pengguna', await this.units.timezoneOf(me.unitId)), csv, rows: rows.length };
  }
}
