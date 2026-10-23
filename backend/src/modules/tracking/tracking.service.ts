import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { localDate } from '../../common/time';
import { PrismaService } from '../../prisma/prisma.service';
import { UnitsService } from '../units/units.service';

/** Tanpa pembaruan selama ini → status "terputus". */
const STALE_MIN = 5;

export interface PingInput { t: string; lat: number; lng: number; acc?: number; mock?: boolean }

/** Posisi realtime Bhabin selama jam dinas. Hanya titik terakhir yang disimpan (ditimpa), tanpa riwayat. */
@Injectable()
export class TrackingService {
  constructor(private prisma: PrismaService, private units: UnitsService) {}

  /** Simpan titik terbaru bila Bhabin sedang dinas (sudah absen masuk hari ini, belum pulang). */
  async update(me: AuthUser, p: PingInput) {
    const t = new Date(p.t);
    if (t.getTime() > Date.now() + 5 * 60_000) return { accepted: false };
    const date = localDate(new Date(), await this.units.timezoneOf(me.unitId));
    const att = await this.prisma.attendance.findMany({ where: { userId: me.id, workDate: new Date(date) }, select: { type: true } });
    if (!att.some((a) => a.type === 'CHECK_IN') || att.some((a) => a.type === 'CHECK_OUT')) return { accepted: false };
    const data = { unitId: me.unitId, clientTime: t, serverTime: new Date(), lat: p.lat, lng: p.lng, gpsAccuracyM: p.acc ?? null, isMockLocation: !!p.mock };
    // Titik lama dari antrean offline tidak menimpa yang lebih baru.
    const n = await this.prisma.lastLocation.updateMany({ where: { userId: me.id, clientTime: { lt: t } }, data });
    if (!n.count) await this.prisma.lastLocation.createMany({ data: [{ userId: me.id, ...data }], skipDuplicates: true });
    return { accepted: true };
  }

  /** Hapus posisi saat Bhabin selesai dinas. */
  clear(userId: string) {
    return this.prisma.lastLocation.deleteMany({ where: { userId } });
  }

  async live(me: AuthUser, unitId?: string) {
    if (unitId) await this.units.assertInScope(me.unitId, unitId);
    const root = unitId ?? me.unitId;
    const date = localDate(new Date(), await this.units.timezoneOf(me.unitId));
    const rows = await this.prisma.$queryRaw<LiveRow[]>`
      SELECT u.id AS user_id, u.nrp, u.nama, u.pangkat, un.nama AS unit,
             ci.client_time AS check_in, co.client_time AS check_out,
             l.client_time AS last_time, l.lat, l.lng, l.gps_accuracy_m AS acc, l.is_mock_location AS mock
      FROM users u
      JOIN units un ON un.id = u.unit_id
      JOIN attendances ci ON ci.user_id = u.id AND ci.work_date = ${date}::date AND ci.type = 'CHECK_IN'
      LEFT JOIN attendances co ON co.user_id = u.id AND co.work_date = ${date}::date AND co.type = 'CHECK_OUT'
      LEFT JOIN last_locations l ON l.user_id = u.id AND co.id IS NULL AND l.client_time >= ci.client_time
      WHERE u.role = 'BHABIN' AND u.unit_id IN (SELECT unit_subtree(${root}::uuid))
      ORDER BY u.nama`;
    const stale = Date.now() - STALE_MIN * 60_000;
    const data = rows.map((r) => ({
      ...r,
      status: r.check_out ? 'selesai' : !r.last_time ? 'belum_ada_titik' : r.last_time.getTime() < stale ? 'terputus' : 'aktif',
    }));
    const count = (s: string) => data.filter((d) => d.status === s).length;
    return { date, staleMinutes: STALE_MIN, data, summary: { dinas: data.length, aktif: count('aktif'), terputus: count('terputus') + count('belum_ada_titik'), selesai: count('selesai') } };
  }
}

interface LiveRow {
  user_id: string; nrp: string; nama: string; pangkat: string | null; unit: string;
  check_in: Date; check_out: Date | null; last_time: Date | null; lat: number | null; lng: number | null;
  acc: number | null; mock: boolean | null;
}
