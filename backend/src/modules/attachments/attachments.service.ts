import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttachmentSource, ReportStatus, UserRole } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import sharp from 'sharp';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReportsService } from '../reports/reports.service';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED: Record<string, { ext: string; image: boolean; max: number }> = {
  'image/jpeg': { ext: 'jpg', image: true, max: 8 * 1024 * 1024 },
  'image/png': { ext: 'png', image: true, max: 8 * 1024 * 1024 },
  'image/webp': { ext: 'webp', image: true, max: 8 * 1024 * 1024 },
  'application/pdf': { ext: 'pdf', image: false, max: 10 * 1024 * 1024 },
  'video/mp4': { ext: 'mp4', image: false, max: MAX_UPLOAD_BYTES },
};

/** Cek "magic bytes" agar tipe file tidak hanya dipercaya dari header. */
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buf.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (buf.subarray(4, 8).toString() === 'ftyp') return 'video/mp4';
  return null;
}

export interface UploadMeta {
  fieldKey: string;
  clientUuid?: string;
  capturedAt?: string;
  source?: AttachmentSource;
  watermarked?: boolean;
  sha256?: string;
}

@Injectable()
export class AttachmentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private reports: ReportsService,
    private audit: AuditService,
  ) {}

  async upload(me: AuthUser, reportId: string, file: Express.Multer.File | undefined, meta: UploadMeta) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'File wajib diunggah' });
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report || report.userId !== me.id) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (!([ReportStatus.DRAFT, ReportStatus.NEEDS_REVISION, ReportStatus.SUBMITTED] as ReportStatus[]).includes(report.status)) {
      throw new ForbiddenException({ code: 'INVALID_TRANSITION', message: 'Lampiran tidak dapat ditambahkan pada laporan yang sudah diputuskan' });
    }

    const mime = sniff(file.buffer);
    const rule = mime ? ALLOWED[mime] : undefined;
    if (!rule) throw new BadRequestException({ code: 'UNSUPPORTED_FILE', message: 'Format harus JPG, PNG, WEBP, PDF, atau MP4' });
    if (file.size > rule.max) throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: `Ukuran maksimal ${rule.max / 1024 / 1024} MB` });

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    if (meta.sha256 && meta.sha256 !== sha256) throw new BadRequestException({ code: 'CHECKSUM_MISMATCH', message: 'File rusak saat dikirim, ulangi unggahan' });

    // Idempoten: unggahan ulang dengan client_uuid yang sama mengembalikan lampiran yang sudah ada.
    const clientUuid = meta.clientUuid ?? randomUUID();
    const existing = await this.prisma.attachment.findUnique({ where: { clientUuid } });
    if (existing) return this.toDto(existing);

    const now = new Date();
    const base = StorageService.key('reports', String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'), clientUuid);
    const objectKey = `${base}.${rule.ext}`;
    await this.storage.put(objectKey, file.buffer);

    let thumbKey: string | undefined;
    if (rule.image) {
      thumbKey = `${base}.thumb.webp`;
      // Thumbnail tanpa metadata EXIF (koordinat tetap tersimpan di database).
      await this.storage.put(thumbKey, await sharp(file.buffer).rotate().resize(480, 480, { fit: 'cover' }).webp({ quality: 72 }).toBuffer());
    }

    const att = await this.prisma.attachment.create({
      data: {
        reportId, fieldKey: meta.fieldKey, clientUuid, objectKey, thumbKey, mime: mime!, sizeBytes: file.size, sha256,
        source: meta.source ?? AttachmentSource.CAMERA, capturedAt: meta.capturedAt ? new Date(meta.capturedAt) : null,
        watermarked: !!meta.watermarked,
      },
    });
    await this.audit.log({ actorId: me.id, action: 'ATTACHMENT_UPLOAD', entity: 'attachment', entityId: att.id, meta: { reportId } });
    return this.toDto(att);
  }

  /** File (atau thumbnail) untuk pengguna yang berhak melihat laporannya. */
  async open(me: AuthUser, id: string, thumb: boolean) {
    const att = await this.prisma.attachment.findUnique({ where: { id } });
    if (!att?.reportId) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.reports.assertCanView(me, att.reportId);
    const key = thumb && att.thumbKey ? att.thumbKey : att.objectKey;
    if (!(await this.storage.exists(key))) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Berkas tidak ditemukan di penyimpanan' });
    if (!thumb && me.role !== UserRole.BHABIN) {
      await this.audit.log({ actorId: me.id, action: 'ATTACHMENT_DOWNLOAD', entity: 'attachment', entityId: id });
    }
    return { stream: this.storage.read(key), mime: thumb && att.thumbKey ? 'image/webp' : att.mime, size: att.sizeBytes, name: key.split('/').pop()! };
  }

  private toDto(a: { id: string; fieldKey: string; mime: string; sizeBytes: number; capturedAt: Date | null; thumbKey: string | null }) {
    return { id: a.id, fieldKey: a.fieldKey, mime: a.mime, sizeBytes: a.sizeBytes, capturedAt: a.capturedAt, hasThumb: !!a.thumbKey };
  }
}
