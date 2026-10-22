import { Controller, Get, Query, Res } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { Response } from 'express';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { exportName, toCsv, wib } from '../../common/csv';
import { PrismaService } from '../../prisma/prisma.service';
import { range } from '../analytics/analytics.controller';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuditService } from '../audit/audit.service';
import { ListReportsQuery } from '../reports/reports.dto';
import { ReportsService } from '../reports/reports.service';
import { UnitsService } from '../units/units.service';

const MAX_ROWS = 50_000;

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

type SchemaJson = { fields: { key: string; label: string; type: string; sensitive?: boolean }[] };

@Controller('exports')
export class ExportsController {
  constructor(
    private prisma: PrismaService,
    private reports: ReportsService,
    private analytics: AnalyticsService,
    private units: UnitsService,
    private audit: AuditService,
  ) {}

  private send(res: Response, name: string, csv: string) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  }

  /** Laporan sesuai filter daftar laporan. Field bertanda sensitif di skema tidak diekspor. */
  @Get('reports.csv')
  @Roles(UserRole.VERIFIKATOR, UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR)
  async reportsCsv(@CurrentUser() me: AuthUser, @Query() q: ListReportsQuery, @Res() res: Response) {
    const where = await this.reports.buildWhere(me, q);
    const [rows, schemas] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: MAX_ROWS,
        include: {
          user: { select: { nama: true, pangkat: true, nrp: true } },
          unit: { select: { nama: true } },
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
      ['Nomor', 'Kategori', 'Status', 'Prioritas', 'Waktu kegiatan (WIB)', 'Bhabin', 'NRP', 'Unit', 'Desa', 'Kecamatan', 'Kabupaten',
        'Lintang', 'Bujur', 'Akurasi GPS (m)', 'Di dalam desa binaan', 'Lokasi palsu', 'Lampiran', 'Diverifikasi oleh', 'Waktu verifikasi (WIB)', 'Catatan verifikator', 'Isian'],
      rows.map((r) => [
        r.nomor, CATEGORY[r.category], STATUS[r.status], r.priority, wib(r.occurredAt), person(r.user), r.user.nrp, r.unit.nama,
        r.village.nama, r.village.kecamatan, r.village.kabupaten, r.lat.toFixed(6), r.lng.toFixed(6), r.gpsAccuracyM != null ? Math.round(r.gpsAccuracyM) : '',
        r.insideVillage, r.isMockLocation, r._count.attachments, person(r.reviewedBy), wib(r.reviewedAt), r.reviewNote, isian(r),
      ]),
    );
    await this.audit.log({ actorId: me.id, action: 'EXPORT_CREATE', entity: 'reports', meta: { rows: rows.length, filters: { ...q } } as Prisma.InputJsonValue });
    this.send(res, exportName('laporan'), csv);
  }

  @Get('prices.csv')
  @Roles(UserRole.VERIFIKATOR, UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR)
  async pricesCsv(@CurrentUser() me: AuthUser, @Res() res: Response) {
    const rows = await this.analytics.latestPrices(me);
    const csv = toCsv(
      ['Komoditas', 'Satuan', 'Rata-rata 7 hari (Rp)', 'Rata-rata 7 hari sebelumnya (Rp)', 'Perubahan (%)', 'Terendah (Rp)', 'Tertinggi (Rp)', 'Sampel', 'Stok menipis', 'Stok kosong'],
      rows.map((p) => [
        p.nama, p.satuan, p.rata2, p.rata2_sebelumnya,
        p.rata2 && p.rata2_sebelumnya ? (Math.round(((p.rata2 - p.rata2_sebelumnya) / p.rata2_sebelumnya) * 1000) / 10).toString().replace('.', ',') : '',
        p.minimum, p.maksimum, p.sampel, p.stok_menipis, p.stok_kosong,
      ]),
    );
    await this.audit.log({ actorId: me.id, action: 'EXPORT_CREATE', entity: 'prices', meta: { rows: rows.length } });
    this.send(res, exportName('harga_pangan'), csv);
  }

  @Get('performance.csv')
  @Roles(UserRole.VERIFIKATOR, UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR)
  async performanceCsv(@CurrentUser() me: AuthUser, @Query() q: { unitId?: string; from?: string; to?: string }, @Res() res: Response) {
    const r = range(q, 30);
    const rows = await this.analytics.bhabinPerformance(me, r);
    // Jumlah tanggal kalender (WIB) yang tercakup rentang, termasuk hari pertama & terakhir.
    const wibDay = (d: Date) => Date.parse(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }));
    const days = Math.round((wibDay(r.to) - wibDay(r.from)) / 86_400_000) + 1;
    const csv = toCsv(
      ['NRP', 'Nama', 'Pangkat', 'Unit', 'Desa binaan', 'Total laporan', 'Hari aktif', `Hari aktif (%) dari ${days} hari`, 'Disetujui', 'Menunggu', 'Revisi', 'Ditolak', 'Lokasi perlu dicek',
        'Sambang', 'Deteksi Dini', 'Problem Solving', 'Penyuluhan', 'Harga Pangan', 'Mapping KK', 'Ketahanan Pangan', 'Laporan terakhir (WIB)'],
      rows.map((b) => [
        b.nrp, b.nama, b.pangkat, b.unit, b.desa, b.total, b.hari_aktif, Math.min(Math.round((b.hari_aktif / days) * 100), 100), b.disetujui, b.menunggu, b.revisi, b.ditolak, b.lokasi_janggal,
        b.sambang, b.deteksi_dini, b.problem_solving, b.penyuluhan, b.harga_pangan, b.mapping_kk, b.ketahanan_pangan, wib(b.terakhir_sepanjang),
      ]),
    );
    await this.audit.log({ actorId: me.id, action: 'EXPORT_CREATE', entity: 'performance', meta: { rows: rows.length } });
    this.send(res, exportName('kinerja_bhabin'), csv);
  }

  @Get('users.csv')
  @Roles(UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR)
  async usersCsv(@CurrentUser() me: AuthUser, @Query('role') role: string | undefined, @Query('active') active: string | undefined, @Res() res: Response) {
    const rows = await this.prisma.user.findMany({
      where: {
        unitId: { in: await this.units.descendantIds(me.unitId) },
        ...(role && { role: role as UserRole }),
        ...(active && { active: active === 'true' }),
      },
      orderBy: [{ unit: { nama: 'asc' } }, { nama: 'asc' }],
      take: MAX_ROWS,
      include: { unit: { select: { nama: true, kode: true } }, villages: { where: { until: null }, include: { village: { select: { nama: true, kodeWilayah: true } } } } },
    });
    const csv = toCsv(
      ['NRP', 'Nama', 'Pangkat', 'Jabatan', 'Peran', 'Kode unit', 'Unit', 'No. HP', 'Status', 'Login terakhir (WIB)', 'Desa binaan'],
      rows.map((u) => [
        u.nrp, u.nama, u.pangkat, u.jabatan, ROLE[u.role], u.unit.kode, u.unit.nama, u.phone, u.active ? 'Aktif' : 'Nonaktif', wib(u.lastLoginAt),
        u.villages.map((v) => v.village.nama).join(', '),
      ]),
    );
    await this.audit.log({ actorId: me.id, action: 'EXPORT_CREATE', entity: 'users', meta: { rows: rows.length } });
    this.send(res, exportName('pengguna'), csv);
  }
}
