import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AttachmentSource, AttendanceType, Prisma, UserRole } from '@prisma/client';
import { createHash } from 'crypto';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { compressPhoto, thumbnail } from '../../common/storage/image';
import { StorageService } from '../../common/storage/storage.service';
import { localDate } from '../../common/time';
import { PrismaService } from '../../prisma/prisma.service';
import { sniff } from '../attachments/attachments.service';
import { AuditService } from '../audit/audit.service';
import { UnitsService } from '../units/units.service';

/** Toleransi jarak ke batas desa binaan (m). */
const VILLAGE_TOLERANCE_M = 200;
/** Absensi offline diterima bila client_time dalam rentang ini. */
const MAX_OFFLINE_MS = 24 * 3_600_000;
/** Dikirim lebih lambat dari ini setelah client_time → late_sync. */
const LATE_SYNC_MS = 15 * 60_000;
/** Jam masuk (waktu setempat); check-in setelahnya ditandai terlambat. */
export const LATE_AFTER = process.env.ATTENDANCE_LATE_AFTER ?? '08:00';
const MAX_SELFIE_BYTES = 8 * 1024 * 1024;

export interface CheckInput {
  clientUuid: string;
  type: AttendanceType;
  clientTime: string;
  lat: number;
  lng: number;
  gpsAccuracyM?: number;
  isMockLocation?: boolean;
}

export interface DailyQuery { date?: string; unitId?: string; q?: string; status?: string; page: number; limit: number }

@Injectable()
export class AttendancesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private units: UnitsService,
    private audit: AuditService,
  ) {}

  /** Check-in / check-out Bhabin. Idempoten per clientUuid; maks. satu per jenis per hari kerja. */
  async record(me: AuthUser, dto: CheckInput, selfie: Express.Multer.File | undefined) {
    const existing = await this.prisma.attendance.findUnique({ where: { clientUuid: dto.clientUuid } });
    if (existing) return this.toDto(existing);

    const clientTime = new Date(dto.clientTime);
    const now = Date.now();
    if (clientTime.getTime() > now + 5 * 60_000) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Waktu perangkat di masa depan; periksa jam HP' });
    if (now - clientTime.getTime() > MAX_OFFLINE_MS) throw new BadRequestException({ code: 'TOO_LATE', message: 'Absensi lebih dari 24 jam lalu tidak dapat dikirim' });

    const tz = await this.units.timezoneOf(me.unitId);
    const workDate = localDate(clientTime, tz);
    if (dto.type === AttendanceType.CHECK_OUT) {
      const checkIn = await this.prisma.attendance.findFirst({ where: { userId: me.id, workDate: new Date(workDate), type: AttendanceType.CHECK_IN } });
      if (!checkIn) throw new ConflictException({ code: 'CHECK_IN_REQUIRED', message: 'Check-in belum dilakukan hari ini' });
    }
    const dup = await this.prisma.attendance.findFirst({ where: { userId: me.id, workDate: new Date(workDate), type: dto.type } });
    if (dup) throw new ConflictException({ code: 'ALREADY_RECORDED', message: dto.type === 'CHECK_IN' ? 'Sudah check-in hari ini' : 'Sudah check-out hari ini' });

    const selfieId = selfie ? await this.saveSelfie(me, dto.clientUuid, selfie, clientTime) : null;

    // Desa binaan aktif terdekat; di dalam bila jarak ke poligon ≤ toleransi.
    const [near] = await this.prisma.$queryRaw<{ village_id: string; distance_m: number }[]>`
      SELECT v.id::text AS village_id, ST_Distance(v.geom::geography, ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)::geography)::float AS distance_m
      FROM user_villages uv JOIN villages v ON v.id = uv.village_id
      WHERE uv.user_id = ${me.id}::uuid AND uv.until IS NULL AND v.geom IS NOT NULL
      ORDER BY 2 LIMIT 1`;

    const att = await this.prisma.attendance.create({
      data: {
        clientUuid: dto.clientUuid, userId: me.id, unitId: me.unitId, type: dto.type, workDate: new Date(workDate), clientTime,
        lat: dto.lat, lng: dto.lng, gpsAccuracyM: dto.gpsAccuracyM, isMockLocation: !!dto.isMockLocation,
        insideVillage: near ? near.distance_m <= VILLAGE_TOLERANCE_M : null, villageId: near?.village_id, distanceM: near ? Math.round(near.distance_m) : null,
        selfieId, lateSync: now - clientTime.getTime() > LATE_SYNC_MS,
      },
    });
    await this.audit.log({ actorId: me.id, action: 'ATTENDANCE_RECORD', entity: 'attendance', entityId: att.id, meta: { type: dto.type, insideVillage: att.insideVillage } });
    const village = att.villageId ? await this.prisma.village.findUnique({ where: { id: att.villageId }, select: { nama: true } }) : null;
    return { ...this.toDto(att), villageName: village?.nama ?? null };
  }

  private async saveSelfie(me: AuthUser, clientUuid: string, file: Express.Multer.File, capturedAt: Date) {
    const mime = sniff(file.buffer);
    if (!mime?.startsWith('image/')) throw new BadRequestException({ code: 'UNSUPPORTED_FILE', message: 'Swafoto harus berupa foto JPG/PNG/WEBP' });
    if (file.size > MAX_SELFIE_BYTES) throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'Ukuran swafoto maksimal 8 MB' });
    const out = await compressPhoto(file.buffer, mime).catch(() => null);
    if (!out) throw new BadRequestException({ code: 'UNSUPPORTED_FILE', message: 'Swafoto tidak dapat dibaca' });
    const base = StorageService.key('attendances', String(capturedAt.getFullYear()), String(capturedAt.getMonth() + 1).padStart(2, '0'), clientUuid);
    const objectKey = `${base}.${out.ext}`;
    const thumbKey = `${base}.thumb.webp`;
    await this.storage.put(objectKey, out.data);
    await this.storage.put(thumbKey, await thumbnail(out.data));
    const att = await this.prisma.attachment.create({
      data: {
        fieldKey: 'selfie', clientUuid, objectKey, thumbKey, mime: out.mime, sizeBytes: out.data.length,
        sha256: createHash('sha256').update(file.buffer).digest('hex'), source: AttachmentSource.CAMERA, capturedAt,
      },
    });
    return att.id;
  }

  /** Riwayat absensi Bhabin sendiri. */
  async mine(me: AuthUser, days = 31) {
    const rows = await this.prisma.attendance.findMany({
      where: { userId: me.id, workDate: { gte: new Date(Date.now() - days * 86_400_000) } },
      orderBy: [{ workDate: 'desc' }, { type: 'asc' }],
      include: { village: { select: { nama: true } } },
    });
    return rows.map((a) => ({ ...this.toDto(a), villageName: a.village?.nama ?? null }));
  }

  /**
   * Rekap kehadiran satu hari untuk seluruh Bhabin aktif dalam cakupan:
   * check-in/out, lokasi, terlambat, dan ringkasan (dihitung atas seluruh filter, bukan halaman).
   */
  async daily(me: AuthUser, q: DailyQuery) {
    if (q.unitId) await this.units.assertInScope(me.unitId, q.unitId);
    const date = q.date ?? localDate(new Date(), await this.units.timezoneOf(me.unitId));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Tanggal harus YYYY-MM-DD' });
    const scopeRoot = q.unitId ?? me.unitId;

    const base = Prisma.sql`
      FROM users u
      JOIN units un ON un.id = u.unit_id
      LEFT JOIN attendances ci ON ci.user_id = u.id AND ci.work_date = ${date}::date AND ci.type = 'CHECK_IN'
      LEFT JOIN attendances co ON co.user_id = u.id AND co.work_date = ${date}::date AND co.type = 'CHECK_OUT'
      WHERE u.role = 'BHABIN' AND u.active AND u.unit_id IN (SELECT unit_subtree(${scopeRoot}::uuid))
        ${q.q ? Prisma.sql`AND (u.nama ILIKE ${'%' + q.q + '%'} OR u.nrp LIKE ${q.q + '%'})` : Prisma.empty}`;
    const late = Prisma.sql`((ci.client_time AT TIME ZONE un.timezone)::time > ${LATE_AFTER}::time)`;
    const status = {
      hadir: Prisma.sql`AND ci.id IS NOT NULL`,
      belum: Prisma.sql`AND ci.id IS NULL`,
      terlambat: Prisma.sql`AND ci.id IS NOT NULL AND ${late}`,
      luar: Prisma.sql`AND (ci.inside_village = false OR co.inside_village = false OR ci.is_mock_location OR co.is_mock_location)`,
    }[q.status ?? ''] ?? Prisma.empty;

    const [data, [summary]] = await Promise.all([
      this.prisma.$queryRaw<DailyRow[]>`
        SELECT u.id AS user_id, u.nrp, u.nama, u.pangkat, un.nama AS unit, un.timezone,
               ci.id AS ci_id, ci.client_time AS ci_time, ci.inside_village AS ci_inside, ci.distance_m AS ci_distance, ci.is_mock_location AS ci_mock,
               ci.late_sync AS ci_late_sync, ci.selfie_id AS ci_selfie, ci.lat AS ci_lat, ci.lng AS ci_lng,
               (SELECT nama FROM villages WHERE id = ci.village_id) AS ci_desa, coalesce(${late}, false) AS terlambat,
               co.id AS co_id, co.client_time AS co_time, co.inside_village AS co_inside, co.is_mock_location AS co_mock, co.selfie_id AS co_selfie,
               round(extract(epoch FROM co.client_time - ci.client_time) / 60)::int AS durasi_menit
        ${base} ${status}
        ORDER BY u.nama, u.nrp
        LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
      this.prisma.$queryRaw<{ bhabin: number; hadir: number; terlambat: number; luar: number; palsu: number; pulang: number; filtered: number }[]>`
        SELECT count(*)::int AS bhabin,
               count(ci.id)::int AS hadir,
               count(*) FILTER (WHERE ${late})::int AS terlambat,
               count(*) FILTER (WHERE ci.inside_village = false OR co.inside_village = false)::int AS luar,
               count(*) FILTER (WHERE ci.is_mock_location OR co.is_mock_location)::int AS palsu,
               count(co.id)::int AS pulang,
               count(*) FILTER (WHERE TRUE ${status})::int AS filtered
        ${base}`,
    ]);
    // Sebaran jam masuk (waktu setempat) & unit dengan kehadiran terendah — untuk grafik ringkasan.
    const [hours, units] = await Promise.all([
      this.prisma.$queryRaw<{ jam: number; jumlah: number }[]>`
        SELECT extract(hour FROM ci.client_time AT TIME ZONE un.timezone)::int AS jam, count(*)::int AS jumlah
        ${base} AND ci.id IS NOT NULL GROUP BY 1 ORDER BY 1`,
      // Bandingkan per Polres bila cakupan berisi lebih dari satu Polres, selain itu per Polsek.
      this.prisma.$queryRaw<{ unit_id: string; unit: string; bhabin: number; hadir: number }[]>`
        WITH b AS (
          SELECT u.id, un.id AS sek_id, un.nama AS sek, p.id AS res_id, p.nama AS res
          FROM users u JOIN units un ON un.id = u.unit_id LEFT JOIN units p ON p.id = un.parent_id
          WHERE u.role = 'BHABIN' AND u.active AND u.unit_id IN (SELECT unit_subtree(${scopeRoot}::uuid))
        ), multi AS (SELECT count(DISTINCT res_id) > 1 AS by_res FROM b),
        x AS (
          SELECT CASE WHEN multi.by_res THEN b.res_id ELSE b.sek_id END AS gid,
                 CASE WHEN multi.by_res THEN b.res ELSE b.sek END AS gnama,
                 ci.id AS ci_id
          FROM b CROSS JOIN multi
          LEFT JOIN attendances ci ON ci.user_id = b.id AND ci.work_date = ${date}::date AND ci.type = 'CHECK_IN'
        )
        SELECT gid::text AS unit_id, gnama AS unit, count(*)::int AS bhabin, count(ci_id)::int AS hadir
        FROM x GROUP BY gid, gnama
        ORDER BY count(ci_id)::float / count(*), count(*) DESC, gnama LIMIT 5`,
    ]);
    return {
      date, lateAfter: LATE_AFTER, data, meta: { page: q.page, limit: q.limit, total: summary.filtered }, summary, hours,
      lowestUnits: units.filter((u) => u.hadir < u.bhabin),
    };
  }

  /** Swafoto absensi untuk Bhabin pemiliknya atau pengguna dengan cakupan unitnya. */
  async selfie(me: AuthUser, id: string, thumb: boolean) {
    const att = await this.prisma.attendance.findUnique({ where: { id }, include: { selfie: true } });
    const allowed = att && (att.userId === me.id || (me.role !== UserRole.BHABIN && (await this.units.descendantIds(me.unitId)).includes(att.unitId)));
    if (!allowed || !att.selfie) throw new NotFoundException({ code: 'NOT_FOUND' });
    const key = thumb && att.selfie.thumbKey ? att.selfie.thumbKey : att.selfie.objectKey;
    if (!(await this.storage.exists(key))) throw new NotFoundException({ code: 'NOT_FOUND' });
    return { stream: this.storage.read(key), mime: thumb && att.selfie.thumbKey ? 'image/webp' : att.selfie.mime };
  }

  private toDto(a: { id: string; type: AttendanceType; workDate: Date; clientTime: Date; serverTime: Date; lat: number; lng: number; insideVillage: boolean | null; distanceM: number | null; isMockLocation: boolean; lateSync: boolean; selfieId: string | null }) {
    return {
      id: a.id, type: a.type, workDate: a.workDate.toISOString().slice(0, 10), clientTime: a.clientTime, serverTime: a.serverTime,
      lat: a.lat, lng: a.lng, insideVillage: a.insideVillage, distanceM: a.distanceM, isMockLocation: a.isMockLocation, lateSync: a.lateSync, hasSelfie: !!a.selfieId,
    };
  }
}

export interface DailyRow {
  user_id: string; nrp: string; nama: string; pangkat: string | null; unit: string; timezone: string;
  ci_id: string | null; ci_time: Date | null; ci_inside: boolean | null; ci_distance: number | null; ci_mock: boolean | null; ci_late_sync: boolean | null;
  ci_selfie: string | null; ci_lat: number | null; ci_lng: number | null; ci_desa: string | null; terlambat: boolean;
  co_id: string | null; co_time: Date | null; co_inside: boolean | null; co_mock: boolean | null; co_selfie: string | null;
  durasi_menit: number | null;
}
