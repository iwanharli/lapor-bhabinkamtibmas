import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportStatus, UserRole } from '@prisma/client';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UnitsService } from '../units/units.service';
import { canReview, NOTE_REQUIRED } from './report-status';
import { ListReportsQuery, TransitionDto } from './reports.dto';

const LIST_SELECT = {
  id: true, nomor: true, category: true, status: true, priority: true, occurredAt: true,
  insideVillage: true, isMockLocation: true, submittedAt: true,
  user: { select: { id: true, nrp: true, nama: true, pangkat: true } },
  village: { select: { id: true, nama: true, kecamatan: true } },
  unit: { select: { id: true, nama: true } },
  _count: { select: { attachments: true } },
} satisfies Prisma.ReportSelect;

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService, private units: UnitsService, private audit: AuditService) {}

  /** Filter cakupan: Bhabin hanya laporannya sendiri, peran lain sebatas unit & turunannya. */
  async scopeWhere(me: AuthUser): Promise<Prisma.ReportWhereInput> {
    if (me.role === UserRole.BHABIN) return { userId: me.id };
    if (me.role === UserRole.SUPERADMIN) return {};
    return { unitId: { in: await this.units.descendantIds(me.unitId) } };
  }

  /** Kondisi pencarian laporan sesuai cakupan & filter. `ignoreStatus` dipakai untuk menghitung jumlah per status. */
  private async buildWhere(me: AuthUser, q: ListReportsQuery, ignoreStatus = false): Promise<Prisma.ReportWhereInput> {
    const scope = await this.scopeWhere(me);
    if (q.unitId) await this.units.assertInScope(me.unitId, q.unitId);
    return {
      AND: [
        scope,
        // Draft hanya terlihat oleh pembuatnya.
        me.role === UserRole.BHABIN ? {} : { status: { not: ReportStatus.DRAFT } },
        {
          ...(q.category && { category: q.category }),
          ...(q.status && !ignoreStatus && { status: q.status }),
          ...(q.unitId && { unitId: { in: await this.units.descendantIds(q.unitId) } }),
          ...(q.villageId && { villageId: q.villageId }),
          ...(q.userId && { userId: q.userId }),
          ...(q.priority !== undefined && { priority: q.priority }),
          ...((q.from || q.to) && { occurredAt: { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: new Date(q.to) }) } }),
          ...(q.q && {
            OR: [
              { nomor: { contains: q.q, mode: 'insensitive' } },
              { user: { nama: { contains: q.q, mode: 'insensitive' } } },
              { village: { nama: { contains: q.q, mode: 'insensitive' } } },
            ],
          }),
        },
      ],
    };
  }

  async list(me: AuthUser, q: ListReportsQuery) {
    const where = await this.buildWhere(me, q);
    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where, select: LIST_SELECT, orderBy: [{ occurredAt: 'desc' }], take: q.limit, skip: (q.page - 1) * q.limit,
      }),
      this.prisma.report.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }

  /** Jumlah laporan per status untuk filter yang sama (tanpa filter status), untuk tab status. */
  async statusCounts(me: AuthUser, q: ListReportsQuery) {
    const rows = await this.prisma.report.groupBy({ by: ['status'], where: await this.buildWhere(me, q, true), _count: { _all: true } });
    const counts = Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<ReportStatus, number>>;
    return { total: rows.reduce((n, r) => n + r._count._all, 0), counts };
  }

  /** Melempar 404 bila laporan tidak boleh dilihat pengguna ini. */
  async assertCanView(me: AuthUser, id: string) {
    await this.findInScope(me, id);
  }

  private async findInScope(me: AuthUser, id: string) {
    const r = await this.prisma.report.findFirst({ where: { AND: [{ id }, await this.scopeWhere(me)] } });
    if (!r || (r.status === ReportStatus.DRAFT && r.userId !== me.id)) throw new NotFoundException({ code: 'NOT_FOUND' });
    return r;
  }

  async get(me: AuthUser, id: string) {
    const r = await this.findInScope(me, id);

    // Verifikator membuka laporan baru → otomatis "Ditinjau".
    if (me.role === UserRole.VERIFIKATOR && r.status === ReportStatus.SUBMITTED) {
      await this.changeStatus(me, r.id, r.status, ReportStatus.IN_REVIEW);
    }

    const report = await this.prisma.report.findUniqueOrThrow({
      where: { id },
      select: {
        ...LIST_SELECT,
        schemaVersion: true, data: true, lat: true, lng: true, gpsAccuracyM: true, receivedAt: true,
        reviewNote: true, reviewedAt: true, createdAt: true,
        reviewedBy: { select: { nama: true, pangkat: true } },
        items: { select: { harga: true, satuan: true, stok: true, commodity: { select: { id: true, nama: true } } }, orderBy: { commodity: { urutan: 'asc' } } },
        attachments: { select: { id: true, fieldKey: true, mime: true, sizeBytes: true, source: true, capturedAt: true, watermarked: true, thumbKey: true }, orderBy: { createdAt: 'asc' } },
        history: { select: { fromStatus: true, toStatus: true, note: true, at: true, actor: { select: { nama: true, pangkat: true, role: true } } }, orderBy: { at: 'asc' } },
      },
    });
    const schema = await this.prisma.formSchema.findUnique({
      where: { category_version: { category: report.category, version: report.schemaVersion } },
      select: { schema: true },
    });
    // Path penyimpanan tidak dikirim ke klien; cukup penanda ada/tidaknya thumbnail.
    const attachments = report.attachments.map(({ thumbKey, ...att }) => ({ ...att, hasThumb: !!thumbKey }));
    return { ...report, attachments, schema: schema?.schema ?? null, canReview: me.role === UserRole.VERIFIKATOR };
  }

  async transition(me: AuthUser, id: string, dto: TransitionDto) {
    const r = await this.findInScope(me, id);
    if (!canReview(r.status, dto.to)) {
      throw new ConflictException({ code: 'INVALID_TRANSITION', message: `Status ${r.status} tidak dapat diubah menjadi ${dto.to}` });
    }
    if (NOTE_REQUIRED.includes(dto.to) && !dto.note?.trim()) {
      throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Catatan wajib diisi untuk revisi atau penolakan' });
    }
    await this.changeStatus(me, r.id, r.status, dto.to, dto.note?.trim());
    return this.prisma.report.findUniqueOrThrow({ where: { id }, select: { id: true, status: true, reviewNote: true, reviewedAt: true } });
  }

  private changeStatus(me: AuthUser, id: string, from: ReportStatus, to: ReportStatus, note?: string) {
    const isDecision = to !== ReportStatus.IN_REVIEW;
    return this.prisma.$transaction(async (tx) => {
      // Optimistic check: gagal bila status sudah diubah verifikator lain.
      const res = await tx.report.updateMany({
        where: { id, status: from },
        data: { status: to, ...(isDecision && { reviewedById: me.id, reviewedAt: new Date(), reviewNote: note ?? null }) },
      });
      if (res.count === 0) throw new ConflictException({ code: 'INVALID_TRANSITION', message: 'Status laporan sudah berubah, muat ulang halaman' });
      await tx.reportStatusHistory.create({ data: { reportId: id, fromStatus: from, toStatus: to, actorId: me.id, note } });
      await this.audit.log({ actorId: me.id, action: `REPORT_${to}`, entity: 'report', entityId: id, ...(note && { meta: { note } }) }, tx);
    });
  }
}
