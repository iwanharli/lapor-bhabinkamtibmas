import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SensitiveDataService } from '../../common/crypto/sensitive-data.service';
import { Prisma, ReportStatus, UserRole } from '@prisma/client';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UnitsService } from '../units/units.service';
import { RALAT_MS } from './report-writer.service';
import { ListReportsQuery } from './reports.dto';

/** Peran yang boleh membuka isi field sensitif (selain pembuat laporan). */
/** Pemantau yang boleh membuka field sensitif (dengan alasan, tercatat di audit), selain pelapornya sendiri. */
const SENSITIVE_READERS: UserRole[] = [UserRole.PIMPINAN, UserRole.AUDITOR];

const LIST_SELECT = {
  id: true, nomor: true, category: true, status: true, priority: true, occurredAt: true,
  insideVillage: true, distanceM: true, isMockLocation: true, submittedAt: true,
  user: { select: { id: true, nrp: true, nama: true, pangkat: true } },
  village: { select: { id: true, nama: true, kecamatan: true } },
  unit: { select: { id: true, nama: true, timezone: true } },
  _count: { select: { attachments: true } },
} satisfies Prisma.ReportSelect;

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService, private units: UnitsService, private audit: AuditService, private crypto: SensitiveDataService) {}

  /** Filter cakupan: Bhabin hanya laporannya sendiri, peran lain sebatas unit & turunannya. */
  async scopeWhere(me: AuthUser): Promise<Prisma.ReportWhereInput> {
    if (me.role === UserRole.BHABIN) return { userId: me.id };
    if (me.role === UserRole.SUPERADMIN) return {};
    return { unitId: { in: await this.units.descendantIds(me.unitId) } };
  }

  /** Kondisi pencarian laporan sesuai cakupan & filter. `ignoreStatus` dipakai untuk menghitung jumlah per status. */
  async buildWhere(me: AuthUser, q: ListReportsQuery): Promise<Prisma.ReportWhereInput> {
    const scope = await this.scopeWhere(me);
    if (q.unitId) await this.units.assertInScope(me.unitId, q.unitId);
    return {
      AND: [
        scope,
        // Draft hanya terlihat oleh pembuatnya.
        me.role === UserRole.BHABIN ? {} : { status: { not: ReportStatus.DRAFT } },
        {
          ...(q.category && { category: q.category }),
          ...(q.status && { status: q.status }),
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

    const report = await this.prisma.report.findUniqueOrThrow({
      where: { id },
      select: {
        ...LIST_SELECT,
        schemaVersion: true, data: true, lat: true, lng: true, gpsAccuracyM: true, receivedAt: true, submittedAt: true, updatedAt: true, createdAt: true,
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
    // Isi field sensitif tidak dikirim; hanya nama field yang terisi (dibuka lewat reveal-sensitive).
    const sensitiveFilled = r.sensitive ? Object.keys(this.crypto.decrypt(Buffer.from(r.sensitive))) : [];
    return {
      ...report, attachments, sensitiveFilled, schema: schema?.schema ?? null,
      // Batas pelapor boleh meralat laporan terkirim.
      editableUntil: r.status === ReportStatus.SUBMITTED && r.submittedAt ? new Date(r.submittedAt.getTime() + RALAT_MS) : null,
      canRevealSensitive: SENSITIVE_READERS.includes(me.role) || r.userId === me.id,
    };
  }

  /** Buka field sensitif dengan alasan; selalu tercatat di audit. */
  async revealSensitive(me: AuthUser, id: string, reason: string) {
    const r = await this.findInScope(me, id);
    if (!SENSITIVE_READERS.includes(me.role) && r.userId !== me.id) throw new ForbiddenException({ code: 'FORBIDDEN' });
    await this.audit.log({ actorId: me.id, action: 'SENSITIVE_READ', entity: 'report', entityId: id, meta: { reason } });
    return r.sensitive ? this.crypto.decrypt(Buffer.from(r.sensitive)) : {};
  }
}
