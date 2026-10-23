import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { localDate } from '../../common/time';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UnitsService } from '../units/units.service';

/** Masa simpan jejak lokasi (hari). */
export const RETENTION_DAYS = 30;
/** Tanpa titik baru selama ini → status "hilang sinyal / pelacakan berhenti". */
const STALE_MIN = 15;

export interface PingInput { t: string; lat: number; lng: number; acc?: number; mock?: boolean; battery?: number }

@Injectable()
export class TrackingService {
  private log = new Logger('Tracking');

  constructor(private prisma: PrismaService, private units: UnitsService, private audit: AuditService) {}

  /**
   * Simpan titik yang jatuh di jam dinas (setelah check-in hari itu, sebelum check-out).
   * Idempoten per (user, waktu) sehingga kiriman ulang dari antrean offline aman.
   */
  async ingest(me: AuthUser, points: PingInput[]) {
    const now = Date.now();
    const valid = points.filter((p) => {
      const t = new Date(p.t).getTime();
      return t <= now + 5 * 60_000 && now - t <= RETENTION_DAYS * 86_400_000;
    });
    if (!valid.length) return { accepted: 0 };
    const tz = await this.units.timezoneOf(me.unitId);
    const rows = valid.map((p) => Prisma.sql`(${me.id}::uuid, ${me.unitId}::uuid, ${localDate(new Date(p.t), tz)}::date, ${new Date(p.t)}::timestamptz,
      ${p.lat}::float8, ${p.lng}::float8, ${p.acc ?? null}::real, ${!!p.mock}, ${p.battery ?? null}::smallint)`);
    const accepted = await this.prisma.$executeRaw`
      INSERT INTO location_pings (user_id, unit_id, work_date, client_time, lat, lng, gps_accuracy_m, is_mock_location, battery)
      SELECT v.* FROM (VALUES ${Prisma.join(rows)}) AS v(user_id, unit_id, work_date, client_time, lat, lng, acc, mock, battery)
      JOIN attendances ci ON ci.user_id = v.user_id AND ci.work_date = v.work_date AND ci.type = 'CHECK_IN' AND v.client_time >= ci.client_time
      LEFT JOIN attendances co ON co.user_id = v.user_id AND co.work_date = v.work_date AND co.type = 'CHECK_OUT'
      WHERE co.id IS NULL OR v.client_time <= co.client_time
      ON CONFLICT (user_id, client_time) DO NOTHING`;
    return { accepted };
  }

  async live(me: AuthUser, unitId?: string) {
    if (unitId) await this.units.assertInScope(me.unitId, unitId);
    const root = unitId ?? me.unitId;
    const date = localDate(new Date(), await this.units.timezoneOf(me.unitId));
    const rows = await this.prisma.$queryRaw<LiveRow[]>`
      SELECT u.id AS user_id, u.nrp, u.nama, u.pangkat, un.nama AS unit,
             ci.client_time AS check_in, co.client_time AS check_out,
             p.client_time AS last_time, p.lat, p.lng, p.gps_accuracy_m AS acc, p.is_mock_location AS mock, p.battery,
             (SELECT count(*)::int FROM location_pings x WHERE x.user_id = u.id AND x.work_date = ${date}::date) AS points
      FROM users u
      JOIN units un ON un.id = u.unit_id
      JOIN attendances ci ON ci.user_id = u.id AND ci.work_date = ${date}::date AND ci.type = 'CHECK_IN'
      LEFT JOIN attendances co ON co.user_id = u.id AND co.work_date = ${date}::date AND co.type = 'CHECK_OUT'
      LEFT JOIN LATERAL (SELECT * FROM location_pings x WHERE x.user_id = u.id AND x.work_date = ${date}::date ORDER BY x.client_time DESC LIMIT 1) p ON true
      WHERE u.role = 'BHABIN' AND u.unit_id IN (SELECT unit_subtree(${root}::uuid))
      ORDER BY u.nama`;
    const stale = Date.now() - STALE_MIN * 60_000;
    const data = rows.map((r) => ({
      ...r,
      status: r.check_out ? 'selesai' : !r.last_time ? 'belum_ada_titik' : r.last_time.getTime() < stale ? 'terputus' : 'aktif',
    }));
    const count = (s: string) => data.filter((d) => d.status === s).length;
    return { date, staleMinutes: STALE_MIN, retentionDays: RETENTION_DAYS, data, summary: { dinas: data.length, aktif: count('aktif'), terputus: count('terputus') + count('belum_ada_titik'), selesai: count('selesai') } };
  }

  async route(me: AuthUser, userId: string, date?: string) {
    if (!/^[0-9a-f-]{36}$/i.test(userId ?? '')) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'userId tidak valid' });
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, nrp: true, nama: true, pangkat: true, unitId: true, role: true } });
    if (!user || user.role !== 'BHABIN' || !(await this.units.descendantIds(me.unitId)).includes(user.unitId)) throw new NotFoundException({ code: 'NOT_FOUND' });
    const day = date ?? localDate(new Date(), await this.units.timezoneOf(user.unitId));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Tanggal harus YYYY-MM-DD' });
    const [points, att] = await Promise.all([
      this.prisma.locationPing.findMany({
        where: { userId, workDate: new Date(day) }, orderBy: { clientTime: 'asc' },
        select: { clientTime: true, lat: true, lng: true, gpsAccuracyM: true, isMockLocation: true, battery: true },
      }),
      this.prisma.attendance.findMany({ where: { userId, workDate: new Date(day) }, select: { type: true, clientTime: true, lat: true, lng: true } }),
    ]);
    await this.audit.log({ actorId: me.id, action: 'TRACKING_VIEW', entity: 'user', entityId: userId, meta: { date: day, points: points.length } });
    let km = 0;
    for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
    return { user: { id: user.id, nrp: user.nrp, nama: user.nama, pangkat: user.pangkat }, date: day, retentionDays: RETENTION_DAYS, distanceKm: Math.round(km * 10) / 10, attendance: att, points };
  }

  /** Hapus jejak lebih tua dari masa simpan, tiap hari 02.30. */
  @Cron('30 2 * * *')
  async purge() {
    const n = await this.prisma.$executeRaw`DELETE FROM location_pings WHERE client_time < now() - make_interval(days => ${RETENTION_DAYS})`;
    if (n) this.log.log(`Jejak lokasi dihapus: ${n} titik (> ${RETENTION_DAYS} hari)`);
  }
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
}

interface LiveRow {
  user_id: string; nrp: string; nama: string; pangkat: string | null; unit: string;
  check_in: Date; check_out: Date | null; last_time: Date | null; lat: number | null; lng: number | null;
  acc: number | null; mock: boolean | null; battery: number | null; points: number;
}
