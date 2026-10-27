import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { LATE_AFTER } from '../attendances/attendances.service';
import { UnitsService } from '../units/units.service';

/** Statistik kinerja Bhabin sendiri (tab Statistik di aplikasi HP): laporan, hari aktif, kehadiran, per kategori & per hari. */
@Injectable()
export class MeStatsService {
  constructor(private prisma: PrismaService, private units: UnitsService) {}

  async stats(me: AuthUser, days: number) {
    const tz = await this.units.timezoneOf(me.unitId);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    const shift = (iso: string, n: number) => {
      const d = new Date(`${iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const dari = shift(today, -(days - 1));
    const pDari = shift(dari, -days), pSampai = shift(dari, -1);
    // Tanggal kegiatan dihitung di zona waktu satuan (WIB/WITA/WIT).
    const localDay = `(r.occurred_at AT TIME ZONE '${tz}')::date`;

    const [harian, kategori, [prev], [absen]] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ hari: string; jumlah: number; prioritas: number }[]>(
        `SELECT ${localDay}::text hari, count(*)::int jumlah, count(*) FILTER (WHERE r.priority)::int prioritas
         FROM reports r WHERE r.user_id = $1::uuid AND r.status = 'SUBMITTED' AND ${localDay} BETWEEN $2::date AND $3::date GROUP BY 1`, me.id, dari, today),
      this.prisma.$queryRawUnsafe<{ kategori: string; jumlah: number }[]>(
        `SELECT r.category::text kategori, count(*)::int jumlah FROM reports r
         WHERE r.user_id = $1::uuid AND r.status = 'SUBMITTED' AND ${localDay} BETWEEN $2::date AND $3::date GROUP BY 1 ORDER BY 2 DESC`, me.id, dari, today),
      this.prisma.$queryRawUnsafe<{ jumlah: number }[]>(
        `SELECT count(*)::int jumlah FROM reports r WHERE r.user_id = $1::uuid AND r.status = 'SUBMITTED' AND ${localDay} BETWEEN $2::date AND $3::date`, me.id, pDari, pSampai),
      this.prisma.$queryRawUnsafe<{ hadir: number; terlambat: number }[]>(
        `SELECT count(DISTINCT a.work_date)::int hadir,
           count(DISTINCT a.work_date) FILTER (WHERE (a.client_time AT TIME ZONE '${tz}')::time > $4::time)::int terlambat
         FROM attendances a WHERE a.user_id = $1::uuid AND a.type = 'CHECK_IN' AND a.work_date BETWEEN $2::date AND $3::date`, me.id, dari, today, LATE_AFTER),
    ]);

    const byDay = new Map(harian.map((h) => [h.hari, h]));
    const series: { hari: string; jumlah: number }[] = [];
    let hariKerja = 0;
    for (let i = 0; i < days; i++) {
      const hari = shift(dari, i);
      series.push({ hari, jumlah: byDay.get(hari)?.jumlah ?? 0 });
      if (new Date(`${hari}T00:00:00Z`).getUTCDay() % 6 !== 0) hariKerja++;
    }
    const laporan = harian.reduce((n, h) => n + h.jumlah, 0);
    return {
      days, dari, sampai: today, timezone: tz,
      laporan, sebelumnya: prev?.jumlah ?? 0,
      prioritas: harian.reduce((n, h) => n + h.prioritas, 0),
      hariAktif: harian.length,
      hadir: absen?.hadir ?? 0, terlambat: absen?.terlambat ?? 0, hariKerja,
      perKategori: kategori,
      harian: series,
    };
  }
}
