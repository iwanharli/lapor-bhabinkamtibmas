import { Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ExportJobStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExportKind, ExportsService } from './exports.service';

/** Selang pemeriksaan antrean (ms); 0 mematikan worker di proses ini. */
const POLL_MS = Number(process.env.EXPORT_POLL_MS ?? 2000);
/** Lama berkas ekspor disimpan sebelum dihapus. */
const KEEP_HOURS = Number(process.env.EXPORT_KEEP_HOURS ?? 24);
/** Pekerjaan RUNNING lebih lama dari ini dianggap macet (proses mati) dan diantrekan ulang. */
const STALE_MS = 15 * 60_000;
const MAX_ATTEMPTS = 3;

/**
 * Antrean ekspor CSV berbasis tabel `export_jobs` — tanpa Redis. Worker berjalan di setiap proses API
 * dan mengambil pekerjaan dengan `FOR UPDATE SKIP LOCKED`, jadi aman bila API berjalan beberapa instance.
 * Ekspor dibuat atas nama pembuatnya dengan peran & cakupan unit terkini.
 */
@Injectable()
export class ExportJobsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ExportJobsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private exports: ExportsService,
    private audit: AuditService,
  ) {}

  onApplicationBootstrap() {
    if (POLL_MS > 0) this.timer = setInterval(() => void this.tick(), POLL_MS);
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  async create(me: AuthUser, kind: string, params: Record<string, string | undefined>) {
    this.exports.assertAllowed(me, kind);
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => typeof v === 'string' && v !== '')) as Prisma.InputJsonObject;
    const job = await this.prisma.exportJob.create({ data: { userId: me.id, kind, params: clean } });
    setImmediate(() => void this.tick());
    return this.toDto(job);
  }

  async list(me: AuthUser) {
    const jobs = await this.prisma.exportJob.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 20 });
    return jobs.map((j) => this.toDto(j));
  }

  async get(me: AuthUser, id: string) {
    const job = await this.prisma.exportJob.findFirst({ where: { id, userId: me.id } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND' });
    return this.toDto(job);
  }

  /** Berkas hasil ekspor — hanya untuk pembuatnya, sebelum kedaluwarsa. */
  async file(me: AuthUser, id: string) {
    const job = await this.prisma.exportJob.findFirst({ where: { id, userId: me.id, status: ExportJobStatus.DONE } });
    if (!job?.fileKey || (job.expiresAt && job.expiresAt < new Date()) || !(await this.storage.exists(job.fileKey))) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Berkas ekspor tidak tersedia atau sudah kedaluwarsa' });
    }
    await this.audit.log({ actorId: me.id, action: 'EXPORT_DOWNLOAD', entity: 'export_job', entityId: id });
    return { stream: this.storage.read(job.fileKey), name: job.fileName ?? `${job.kind}.csv`, size: job.sizeBytes ?? undefined };
  }

  /** Satu putaran worker: bersihkan yang kedaluwarsa/macet, lalu kerjakan antrean sampai kosong. */
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.cleanup();
      for (let job = await this.claim(); job; job = await this.claim()) await this.run(job);
    } catch (e) {
      this.logger.error(e);
    } finally {
      this.busy = false;
    }
  }

  private async claim() {
    const [job] = await this.prisma.$queryRaw<{ id: string; user_id: string; kind: string; params: Record<string, string>; attempts: number }[]>`
      UPDATE export_jobs SET status = 'RUNNING', started_at = now(), attempts = attempts + 1
      WHERE id = (
        SELECT id FROM export_jobs WHERE status = 'QUEUED' ORDER BY created_at
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      RETURNING id::text, user_id::text, kind, params, attempts`;
    return job;
  }

  private async run(job: { id: string; user_id: string; kind: string; params: Record<string, string>; attempts: number }) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: job.user_id } });
      if (!user?.active) throw new Error('Akun pembuat ekspor tidak aktif');
      const me: AuthUser = { id: user.id, nrp: user.nrp, role: user.role, unitId: user.unitId };
      this.exports.assertAllowed(me, job.kind);
      const t0 = Date.now();
      const out = await this.exports.build(me, job.kind as ExportKind, job.params);
      const data = Buffer.from(out.csv, 'utf8');
      const fileKey = StorageService.key('exports', `${job.id}.csv`);
      await this.storage.put(fileKey, data);
      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: {
          status: ExportJobStatus.DONE, fileKey, fileName: out.name, rows: out.rows, sizeBytes: data.length, error: null,
          finishedAt: new Date(), expiresAt: new Date(Date.now() + KEEP_HOURS * 3_600_000),
        },
      });
      await this.audit.log({ actorId: me.id, action: 'EXPORT_CREATE', entity: job.kind, entityId: job.id, meta: { rows: out.rows, filters: job.params, ms: Date.now() - t0 } });
    } catch (e) {
      const message = (e as { response?: { message?: string } }).response?.message ?? (e as Error).message;
      this.logger.warn(`Ekspor ${job.id} gagal: ${message}`);
      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: { status: ExportJobStatus.FAILED, error: message.slice(0, 500), finishedAt: new Date() },
      });
    }
  }

  private async cleanup() {
    const expired = await this.prisma.exportJob.findMany({ where: { expiresAt: { lt: new Date() }, fileKey: { not: null } }, select: { id: true, fileKey: true } });
    for (const j of expired) {
      await this.storage.remove(j.fileKey!).catch(() => undefined);
      await this.prisma.exportJob.update({ where: { id: j.id }, data: { fileKey: null } });
    }
    // Pekerjaan macet (proses mati saat RUNNING): antrekan ulang, atau gagalkan setelah MAX_ATTEMPTS.
    await this.prisma.$executeRaw`
      UPDATE export_jobs SET status = CASE WHEN attempts >= ${MAX_ATTEMPTS} THEN 'FAILED'::"ExportJobStatus" ELSE 'QUEUED'::"ExportJobStatus" END,
             error = CASE WHEN attempts >= ${MAX_ATTEMPTS} THEN 'Pemrosesan terhenti berulang kali' ELSE error END
      WHERE status = 'RUNNING' AND started_at < ${new Date(Date.now() - STALE_MS)}`;
  }

  private toDto(j: { id: string; kind: string; status: ExportJobStatus; fileName: string | null; rows: number | null; sizeBytes: number | null; error: string | null; createdAt: Date; finishedAt: Date | null; expiresAt: Date | null; fileKey: string | null }) {
    return {
      id: j.id, kind: j.kind, status: j.status, fileName: j.fileName, rows: j.rows, sizeBytes: j.sizeBytes, error: j.error,
      createdAt: j.createdAt, finishedAt: j.finishedAt, expiresAt: j.expiresAt, downloadable: j.status === 'DONE' && !!j.fileKey,
    };
  }
}
