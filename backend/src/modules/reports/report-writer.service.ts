import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Report, ReportCategory, ReportStatus, UnitLevel } from '@prisma/client';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { SensitiveDataService } from '../../common/crypto/sensitive-data.service';
import { PrismaService } from '../../prisma/prisma.service';
import { localDate } from '../../common/time';
import { AuditService } from '../audit/audit.service';
import { FormSchemaJson, isPriority, splitSensitive, validateReportData } from './report-validator';
import { UpdateReportDto, UpsertReportDto } from './reports.dto';

const PREFIX: Record<ReportCategory, string> = {
  SAMBANG: 'SB', DETEKSI_DINI: 'DD', PROBLEM_SOLVING: 'PS', PENYULUHAN: 'PY', HARGA_PANGAN: 'HP', MAPPING_KK: 'KK', KETAHANAN_PANGAN: 'KP',
};
/** Laporan boleh dicatat paling lambat 3×24 jam setelah kegiatan. */
const MAX_BACKDATE_MS = 3 * 86_400_000;
/** Toleransi jam perangkat lebih cepat dari server. */
const CLOCK_SKEW_MS = 10 * 60_000;
/** Titik dianggap di dalam desa binaan bila ≤ 200 m dari batasnya. */
const VILLAGE_TOLERANCE_M = 200;

/** Laporan terkirim bersifat final (tanpa verifikasi), tetapi pelapor boleh meralatnya selama jendela ini. */
export const RALAT_MS = Number(process.env.REPORT_RALAT_HOURS ?? 72) * 3_600_000;

/** Draft selalu bisa diubah; laporan terkirim hanya dalam jendela ralat sejak dikirim. */
export const canEdit = (r: { status: ReportStatus; submittedAt: Date | null }) =>
  r.status === ReportStatus.DRAFT || (r.status === ReportStatus.SUBMITTED && !!r.submittedAt && Date.now() - r.submittedAt.getTime() <= RALAT_MS);

/** Pembuatan, perubahan, dan pengiriman laporan oleh Bhabin (aplikasi mobile). */
@Injectable()
export class ReportWriterService {
  constructor(private prisma: PrismaService, private crypto: SensitiveDataService, private audit: AuditService) {}

  private async schemaOf(category: ReportCategory, version: number) {
    const row = await this.prisma.formSchema.findUnique({ where: { category_version: { category, version } } });
    if (!row) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: `Formulir ${category} versi ${version} tidak dikenal` });
    if (row.status === 'RETIRED') {
      // Bedakan modul yang ditunda (tak ada versi aktif) dari versi lama yang sudah diganti.
      const active = await this.prisma.formSchema.count({ where: { category, status: 'ACTIVE' } });
      throw new BadRequestException({
        code: 'SCHEMA_RETIRED',
        message: active ? 'Versi formulir sudah tidak berlaku; perbarui aplikasi' : 'Kategori laporan ini sedang tidak digunakan',
      });
    }
    return row.schema as unknown as FormSchemaJson;
  }

  private async assertVillage(me: AuthUser, villageId: string) {
    const ok = await this.prisma.userVillage.count({ where: { userId: me.id, villageId, until: null } });
    if (!ok) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Desa bukan desa binaan Anda' });
  }

  private assertOccurredAt(iso: string) {
    const t = Date.parse(iso);
    if (t > Date.now() + CLOCK_SKEW_MS) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Waktu kegiatan tidak boleh di masa depan' });
    if (Date.now() - t > MAX_BACKDATE_MS) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Laporan hanya dapat dicatat paling lambat 3×24 jam setelah kegiatan' });
  }

  /** Validasi isian draft (tanpa cek lampiran) agar galat format terlihat sejak awal. */
  private async validateDraft(schema: FormSchemaJson, data: Record<string, unknown>) {
    const commodityIds = new Set((await this.prisma.commodity.findMany({ select: { id: true } })).map((c) => c.id));
    const errors = validateReportData(schema, data, { commodityIds, attachmentCounts: null }).filter((e) => !e.message.endsWith('wajib diisi'));
    if (errors.length) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Isian tidak valid', details: errors.map((e) => e.message) });
  }

  private encryptSecret(existing: Buffer | null, secret: Record<string, unknown>) {
    const merged = { ...(existing ? this.crypto.decrypt(existing) : {}), ...secret };
    return Object.keys(merged).length ? Buffer.from(this.crypto.encrypt(merged)) : null;
  }

  /** Nomor laporan: {KAT}-{KODE_POLRES}-{YYMM}-{urut}, urut per Polres/kategori/bulan. */
  private async nextNumber(tx: Prisma.TransactionClient, unitId: string, category: ReportCategory, at: Date) {
    let unit = await tx.unit.findUniqueOrThrow({ where: { id: unitId } });
    const tz = unit.timezone;
    while (unit.level !== UnitLevel.POLRES && unit.parentId) unit = await tx.unit.findUniqueOrThrow({ where: { id: unit.parentId } });
    const period = localDate(at, tz).slice(2, 7).replace('-', '');
    const [row] = await tx.$queryRaw<{ last_no: number }[]>`
      INSERT INTO report_counters (unit_id, category, period, last_no) VALUES (${unit.id}::uuid, ${category}::report_category, ${period}, 1)
      ON CONFLICT (unit_id, category, period) DO UPDATE SET last_no = report_counters.last_no + 1
      RETURNING last_no`;
    return `${PREFIX[category]}-${unit.kode}-${period}-${String(row.last_no).padStart(5, '0')}`;
  }

  private ownedEditable = async (me: AuthUser, id: string) => {
    const r = await this.prisma.report.findUnique({ where: { id } });
    if (!r || r.userId !== me.id) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (!canEdit(r)) throw new ConflictException({ code: 'RALAT_CLOSED', message: 'Laporan sudah melewati batas ralat 3×24 jam sejak dikirim' });
    return r;
  };

  /** Buat draft, atau kembalikan/perbarui draft yang sama bila clientUuid sudah ada (aman diulang saat sinyal putus). */
  async upsert(me: AuthUser, dto: UpsertReportDto) {
    const existing = await this.prisma.report.findUnique({ where: { clientUuid: dto.clientUuid } });
    if (existing) {
      if (existing.userId !== me.id) throw new ConflictException({ code: 'DUPLICATE', message: 'clientUuid sudah dipakai' });
      if (existing.status !== ReportStatus.DRAFT) return this.summary(existing);
      return this.update(me, existing.id, dto);
    }

    const schema = await this.schemaOf(dto.category, dto.schemaVersion);
    await this.assertVillage(me, dto.villageId);
    this.assertOccurredAt(dto.occurredAt);
    await this.validateDraft(schema, dto.data);
    const { plain, secret } = splitSensitive(schema, dto.data);
    const occurredAt = new Date(dto.occurredAt);

    const report = await this.prisma.$transaction(async (tx) => {
      const nomor = await this.nextNumber(tx, me.unitId, dto.category, occurredAt);
      const r = await tx.report.create({
        data: {
          clientUuid: dto.clientUuid, nomor, category: dto.category, schemaVersion: dto.schemaVersion, userId: me.id, unitId: me.unitId,
          villageId: dto.villageId, status: ReportStatus.DRAFT, data: plain as Prisma.InputJsonObject, sensitive: this.encryptSecret(null, secret),
          occurredAt, lat: dto.location.lat, lng: dto.location.lng, gpsAccuracyM: dto.gpsAccuracyM, isMockLocation: !!dto.isMockLocation,
        },
      });
      await this.audit.log({ actorId: me.id, action: 'REPORT_CREATE', entity: 'report', entityId: r.id }, tx);
      return r;
    });
    return this.summary(report);
  }

  async update(me: AuthUser, id: string, dto: UpdateReportDto) {
    const r = await this.ownedEditable(me, id);
    const schema = await this.schemaOf(r.category, r.schemaVersion);
    if (dto.villageId) await this.assertVillage(me, dto.villageId);
    if (dto.occurredAt) this.assertOccurredAt(dto.occurredAt);

    let data: Prisma.InputJsonObject | undefined;
    let sensitive: Buffer | null | undefined;
    if (dto.data) {
      await this.validateDraft(schema, dto.data);
      const { plain, secret } = splitSensitive(schema, dto.data);
      data = plain as Prisma.InputJsonObject;
      sensitive = this.encryptSecret(r.sensitive ? Buffer.from(r.sensitive) : null, secret);
    }
    // Ralat laporan terkirim: isian baru harus tetap lengkap; prioritas, item harga & cek lokasi dihitung ulang.
    const ralat = r.status === ReportStatus.SUBMITTED;
    const full = ralat ? (dto.data ?? { ...(r.data as Record<string, unknown>), ...(r.sensitive ? this.crypto.decrypt(Buffer.from(r.sensitive)) : {}) }) : null;
    const commodities = ralat ? await this.assertComplete(id, schema, full!) : [];

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.report.update({
        where: { id },
        data: {
          ...(dto.villageId && { villageId: dto.villageId }),
          ...(dto.occurredAt && { occurredAt: new Date(dto.occurredAt) }),
          ...(dto.location && { lat: dto.location.lat, lng: dto.location.lng }),
          ...(dto.gpsAccuracyM != null && { gpsAccuracyM: dto.gpsAccuracyM }),
          ...(dto.isMockLocation != null && { isMockLocation: dto.isMockLocation }),
          ...(data && { data }),
          ...(sensitive !== undefined && { sensitive }),
        },
      });
      if (ralat) await this.finalize(tx, u, schema, full!, commodities);
      await this.audit.log({ actorId: me.id, action: 'REPORT_UPDATE', entity: 'report', entityId: id, meta: { ralat } }, tx);
      return tx.report.findUniqueOrThrow({ where: { id } });
    });
    return this.summary(updated);
  }

  /** Validasi penuh (termasuk jumlah lampiran); mengembalikan daftar komoditas untuk item harga. */
  private async assertComplete(id: string, schema: FormSchemaJson, data: Record<string, unknown>) {
    const [commodities, attachments] = await Promise.all([
      this.prisma.commodity.findMany({ select: { id: true, satuanDefault: true } }),
      this.prisma.attachment.groupBy({ by: ['fieldKey'], where: { reportId: id }, _count: { _all: true } }),
    ]);
    const errors = validateReportData(schema, data, {
      commodityIds: new Set(commodities.map((c) => c.id)),
      attachmentCounts: Object.fromEntries(attachments.map((a) => [a.fieldKey, a._count._all])),
    });
    if (errors.length) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Laporan belum lengkap', details: errors.map((e) => e.message) });
    return commodities;
  }

  /** Item harga, prioritas, dan cek lokasi terhadap desa binaan — saat kirim maupun ralat. */
  private async finalize(tx: Prisma.TransactionClient, r: Report, schema: FormSchemaJson, data: Record<string, unknown>, commodities: { id: number; satuanDefault: string }[]) {
    if (r.category === ReportCategory.HARGA_PANGAN) {
      const satuan = new Map(commodities.map((c) => [c.id, c.satuanDefault]));
      const items = (data.items as { commodityId: number; harga: number; satuan?: string; stok: 'AMAN' | 'MENIPIS' | 'KOSONG' }[]) ?? [];
      await tx.reportItem.deleteMany({ where: { reportId: r.id } });
      await tx.reportItem.createMany({
        data: items.map((i) => ({ reportId: r.id, commodityId: Number(i.commodityId), harga: Number(i.harga), satuan: i.satuan ?? satuan.get(Number(i.commodityId)) ?? 'kg', stok: i.stok })),
        skipDuplicates: true,
      });
    }
    const [{ inside }] = await tx.$queryRaw<{ inside: boolean | null }[]>`
      SELECT CASE WHEN bool_and(v.geom IS NULL) THEN NULL
                  ELSE bool_or(ST_DWithin(v.geom::geography, r.location, ${VILLAGE_TOLERANCE_M})) END AS inside
      FROM reports r JOIN user_villages uv ON uv.user_id = r.user_id AND uv.until IS NULL JOIN villages v ON v.id = uv.village_id
      WHERE r.id = ${r.id}::uuid`;
    await tx.report.update({ where: { id: r.id }, data: { priority: isPriority(schema, data), insideVillage: inside } });
  }

  /** Kirim laporan: validasi penuh lalu langsung final (`SUBMITTED`); tidak ada tahap verifikasi. */
  async submit(me: AuthUser, id: string) {
    const r = await this.ownedEditable(me, id);
    if (r.status !== ReportStatus.DRAFT) return this.summary(r);
    const schema = await this.schemaOf(r.category, r.schemaVersion);
    const secret = r.sensitive ? this.crypto.decrypt(Buffer.from(r.sensitive)) : {};
    const data = { ...(r.data as Record<string, unknown>), ...secret };
    const commodities = await this.assertComplete(id, schema, data);

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.report.updateMany({
        where: { id, status: ReportStatus.DRAFT },
        data: { status: ReportStatus.SUBMITTED, submittedAt: new Date() },
      });
      if (!res.count) throw new ConflictException({ code: 'INVALID_TRANSITION', message: 'Status laporan sudah berubah' });
      await this.finalize(tx, r, schema, data, commodities);
      await tx.reportStatusHistory.create({ data: { reportId: id, fromStatus: ReportStatus.DRAFT, toStatus: ReportStatus.SUBMITTED, actorId: me.id } });
      await this.audit.log({ actorId: me.id, action: 'REPORT_SUBMIT', entity: 'report', entityId: id }, tx);
    });
    return this.summary(await this.prisma.report.findUniqueOrThrow({ where: { id } }));
  }

  private summary(r: Report) {
    return {
      id: r.id, clientUuid: r.clientUuid, nomor: r.nomor, status: r.status, priority: r.priority, insideVillage: r.insideVillage, updatedAt: r.updatedAt,
      editableUntil: r.status === ReportStatus.SUBMITTED && r.submittedAt ? new Date(r.submittedAt.getTime() + RALAT_MS) : null,
    };
  }
}
