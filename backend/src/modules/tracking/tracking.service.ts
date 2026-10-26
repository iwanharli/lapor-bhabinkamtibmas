import { Injectable, MessageEvent } from '@nestjs/common';
import { filter, interval, map, merge, Observable, Subject } from 'rxjs';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { localDate } from '../../common/time';
import { PrismaService } from '../../prisma/prisma.service';
import { UnitsService } from '../units/units.service';

/** Tanpa pembaruan selama ini → status "terputus". */
const STALE_MIN = 5;

export interface PingInput { t: string; lat: number; lng: number; acc?: number; mock?: boolean }

/** Perubahan yang didorong ke layar Monitoring: posisi baru, atau daftar dinas berubah (absen masuk/pulang). */
type LiveEvent =
  | { type: 'pos'; unitId: string; data: { user_id: string; last_time: string; lat: number; lng: number; acc: number | null; mock: boolean } }
  | { type: 'roster'; unitId: string; data: { user_id: string } };

/** Posisi realtime Bhabin selama jam dinas. Hanya titik terakhir yang disimpan (ditimpa), tanpa riwayat. */
@Injectable()
export class TrackingService {
  /** Bus di dalam proses (API berjalan sebagai satu proses); untuk beberapa instance API perlu Postgres LISTEN/NOTIFY atau Redis. */
  private events = new Subject<LiveEvent>();

  constructor(private prisma: PrismaService, private units: UnitsService) {}

  /** Aliran SSE untuk Monitoring Personel: hanya Bhabin di dalam cakupan unit penonton, plus detak tiap 20 detik agar proksi tidak memutus. */
  async stream(me: AuthUser, unitId?: string): Promise<Observable<MessageEvent>> {
    if (unitId) await this.units.assertInScope(me.unitId, unitId);
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`SELECT unit_subtree(${unitId ?? me.unitId}::uuid)::text AS id`;
    const scope = new Set(rows.map((r) => r.id));
    return merge(
      this.events.pipe(filter((e) => scope.has(e.unitId)), map((e): MessageEvent => ({ type: e.type, data: e.data }))),
      interval(20_000).pipe(map((): MessageEvent => ({ type: 'ping', data: String(Date.now()) }))),
    );
  }

  /** Absen masuk/pulang: layar Monitoring memuat ulang daftar dinas. */
  rosterChanged(me: AuthUser) {
    this.events.next({ type: 'roster', unitId: me.unitId, data: { user_id: me.id } });
  }

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
    if (!n.count) {
      const c = await this.prisma.lastLocation.createMany({ data: [{ userId: me.id, ...data }], skipDuplicates: true });
      if (!c.count) return { accepted: true }; // titik lebih lama dari yang tersimpan: tidak disiarkan
    }
    this.events.next({ type: 'pos', unitId: me.unitId, data: { user_id: me.id, last_time: t.toISOString(), lat: p.lat, lng: p.lng, acc: p.acc ?? null, mock: !!p.mock } });
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
