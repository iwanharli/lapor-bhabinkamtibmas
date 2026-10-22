import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { LATE_AFTER } from '../attendances/attendances.service';
import { UnitsService } from '../units/units.service';

export const CATEGORY_LABEL: Record<string, string> = {
  SAMBANG: 'Sambang / DDS', DETEKSI_DINI: 'Deteksi Dini', PROBLEM_SOLVING: 'Problem Solving', PENYULUHAN: 'Penyuluhan',
  HARGA_PANGAN: 'Harga Pangan', MAPPING_KK: 'Mapping Data Keluarga', KETAHANAN_PANGAN: 'Ketahanan Pangan',
};
const CATEGORIES = Object.keys(CATEGORY_LABEL);
const LEVEL_LABEL: Record<string, string> = { MABES: 'Mabes', POLDA: 'Polda', POLRES: 'Polres', POLSEK: 'Polsek' };
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
/** Baris Bhabin di Excel; PDF hanya memuat yang perlu perhatian. */
const MAX_BHABIN = 60_000;

export interface MonthlyBhabin {
  nrp: string; nama: string; pangkat: string | null; satuan: string; desa: string | null;
  laporan: number; perKategori: Record<string, number>; lokasiJanggal: number; hadir: number; terlambat: number; terakhir: Date | null;
}
export interface MonthlyUnitRow {
  nama: string; level: string; bhabin: number; bhabinAktif: number; laporan: number; prioritas: number; lokasiJanggal: number;
  hadir: number; terlambat: number; kehadiranPersen: number | null;
}
export interface MonthlyReport {
  unit: { id: string; nama: string; level: string; levelLabel: string; timezone: string };
  bulan: string; bulanLabel: string; dari: string; sampai: string; hariKerja: number; berjalan: boolean;
  dibuat: Date; dibuatOleh: string;
  ringkasan: {
    laporan: number; laporanSebelumnya: number; prioritas: number; prioritasSebelumnya: number; lokasiJanggal: number;
    bhabin: number; bhabinAktif: number; hadir: number; terlambat: number; kehadiranPersen: number | null;
  };
  perKategori: { kategori: string; label: string; jumlah: number; sebelumnya: number; prioritas: number }[];
  perSatuan: MonthlyUnitRow[];
  bhabin: MonthlyBhabin[];
  bhabinTerpotong: boolean;
  prioritas: { nomor: string; tanggal: Date; kategori: string; desa: string; bhabin: string; ringkasan: string }[];
  harga: { komoditas: string; satuan: string; rata2: number | null; sebelumnya: number | null; perubahan: number | null; minimum: number | null; maksimum: number | null; sampel: number; kosong: number }[];
  keluarga: {
    kk: number; balita: number; stunting: number; berisiko: number; belumDitangani: number; ibuHamil: number; ibuKek: number;
    jambanTidakLayak: number; airTidakLayak: number; kkSanitasi: number;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Data laporan bulanan satu satuan (beserta turunannya) — sumber Excel & PDF. Tidak memuat NIK maupun data kesehatan per orang. */
@Injectable()
export class MonthlyReportService {
  constructor(private prisma: PrismaService, private units: UnitsService) {}

  async build(me: AuthUser, bulan: string, unitId?: string): Promise<MonthlyReport> {
    if (!/^\d{4}-\d{2}$/.test(bulan)) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Bulan harus YYYY-MM' });
    const target = unitId ?? me.unitId;
    if (unitId) await this.units.assertInScope(me.unitId, unitId);
    const unit = await this.prisma.unit.findUniqueOrThrow({ where: { id: target }, select: { id: true, nama: true, level: true, timezone: true } });
    const actor = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { nama: true, pangkat: true } });

    const [y, m] = bulan.split('-').map(Number);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: unit.timezone });
    const dari = `${bulan}-01`;
    if (dari > today) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Bulan belum berjalan' });
    const akhir = `${bulan}-${pad(lastDay(y, m))}`;
    const sampai = akhir < today ? akhir : today;
    const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
    const pDari = `${py}-${pad(pm)}-01`, pSampai = `${py}-${pad(pm)}-${pad(lastDay(py, pm))}`;
    let hariKerja = 0;
    for (let d = new Date(`${dari}T00:00:00Z`); d.toISOString().slice(0, 10) <= sampai; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() % 6 !== 0) hariKerja++;

    const scope = (col: string) => `${col} IN (SELECT unit_subtree($1::uuid))`;
    const q = <T>(sql: string, ...args: unknown[]) => this.prisma.$queryRawUnsafe<T[]>(sql, target, ...args);

    const [cats, prevCats, bhabinRows, prioritas, harga, prevHarga, [keluarga], childMap] = await Promise.all([
      q<{ category: string; jumlah: number; prioritas: number; lokasi: number }>(
        `SELECT category::text, sum(jumlah)::int jumlah, sum(prioritas)::int prioritas, sum(lokasi_janggal)::int lokasi
         FROM agg_unit_daily WHERE ${scope('unit_id')} AND status <> 'DRAFT' AND hari BETWEEN $2::date AND $3::date GROUP BY 1`, dari, sampai),
      q<{ category: string; jumlah: number; prioritas: number }>(
        `SELECT category::text, sum(jumlah)::int jumlah, sum(prioritas)::int prioritas
         FROM agg_unit_daily WHERE ${scope('unit_id')} AND status <> 'DRAFT' AND hari BETWEEN $2::date AND $3::date GROUP BY 1`, pDari, pSampai),
      q<{
        nrp: string; nama: string; pangkat: string | null; unit_id: string; satuan: string; desa: string | null; laporan: number; lokasi: number;
        sambang: number; deteksi_dini: number; problem_solving: number; penyuluhan: number; harga_pangan: number; mapping_kk: number; ketahanan_pangan: number;
        terakhir: Date | null; hadir: number; terlambat: number;
      }>(
        `SELECT u.nrp, u.nama, u.pangkat, u.unit_id, un.nama AS satuan,
           (SELECT v.nama FROM user_villages uv JOIN villages v ON v.id = uv.village_id WHERE uv.user_id = u.id AND uv.until IS NULL LIMIT 1) AS desa,
           coalesce(a.total, 0)::int laporan, coalesce(a.lokasi, 0)::int lokasi,
           coalesce(a.sambang, 0)::int sambang, coalesce(a.deteksi_dini, 0)::int deteksi_dini, coalesce(a.problem_solving, 0)::int problem_solving,
           coalesce(a.penyuluhan, 0)::int penyuluhan, coalesce(a.harga_pangan, 0)::int harga_pangan, coalesce(a.mapping_kk, 0)::int mapping_kk,
           coalesce(a.ketahanan_pangan, 0)::int ketahanan_pangan, a.terakhir,
           coalesce(t.hadir, 0)::int hadir, coalesce(t.terlambat, 0)::int terlambat
         FROM users u JOIN units un ON un.id = u.unit_id
         LEFT JOIN (
           SELECT user_id, sum(total) total, sum(lokasi_janggal) lokasi, sum(sambang) sambang, sum(deteksi_dini) deteksi_dini,
             sum(problem_solving) problem_solving, sum(penyuluhan) penyuluhan, sum(harga_pangan) harga_pangan, sum(mapping_kk) mapping_kk,
             sum(ketahanan_pangan) ketahanan_pangan, max(last_at) terakhir
           FROM agg_user_daily WHERE ${scope('unit_id')} AND hari BETWEEN $2::date AND $3::date GROUP BY user_id
         ) a ON a.user_id = u.id
         LEFT JOIN (
           SELECT at.user_id, count(*) hadir,
             count(*) FILTER (WHERE (at.client_time AT TIME ZONE au.timezone)::time > $4::time) terlambat
           FROM attendances at JOIN units au ON au.id = at.unit_id
           WHERE ${scope('at.unit_id')} AND at.type = 'CHECK_IN' AND at.work_date BETWEEN $2::date AND $3::date AND extract(isodow FROM at.work_date) < 6
           GROUP BY at.user_id
         ) t ON t.user_id = u.id
         WHERE ${scope('u.unit_id')} AND u.role = 'BHABIN' AND u.active
         ORDER BY laporan ASC, u.nama LIMIT ${MAX_BHABIN + 1}`, dari, sampai, LATE_AFTER),
      q<{ nomor: string; tanggal: Date; kategori: string; desa: string; bhabin: string; ringkasan: string | null; health: { belum_ditangani?: number } | null }>(
        `SELECT r.nomor, r.occurred_at tanggal, r.category::text kategori, v.nama desa, concat_ws(' ', u.pangkat, u.nama) bhabin,
           left(coalesce(r.data->>'uraian', r.data->>'tanggapan', r.data->>'permasalahan', r.data->>'catatan'), 160) ringkasan, r.health
         FROM reports r JOIN villages v ON v.id = r.village_id JOIN users u ON u.id = r.user_id JOIN units ru ON ru.id = r.unit_id
         WHERE ${scope('r.unit_id')} AND r.status = 'SUBMITTED' AND r.priority
           AND (r.occurred_at AT TIME ZONE ru.timezone)::date BETWEEN $2::date AND $3::date
         ORDER BY r.occurred_at DESC LIMIT 100`, dari, sampai),
      this.priceRows(target, dari, sampai),
      this.priceRows(target, pDari, pSampai),
      q<Record<string, number>>(
        `WITH k AS (
           SELECT DISTINCT ON (coalesce(r.kk_hash, r.id::text)) r.data, r.health FROM reports r JOIN units ru ON ru.id = r.unit_id
           WHERE ${scope('r.unit_id')} AND r.category = 'MAPPING_KK' AND r.status = 'SUBMITTED' AND r.schema_version = 2
             AND (r.occurred_at AT TIME ZONE ru.timezone)::date BETWEEN $2::date AND $3::date
           ORDER BY coalesce(r.kk_hash, r.id::text), r.submitted_at DESC)
         SELECT count(*)::int kk,
           ${['balita', 'stunting', 'berisiko', 'belum_ditangani', 'ibu_hamil', 'ibu_kek'].map((k) => `coalesce(sum((health->>'${k}')::int), 0)::int ${k}`).join(', ')},
           count(*) FILTER (WHERE data ? 'jamban' AND data->>'jamban' <> 'Jamban sendiri dengan septic tank')::int jamban_tidak_layak,
           count(*) FILTER (WHERE data->>'sumber_air_minum' IN ('Sumur/mata air tidak terlindung', 'Sungai/danau/irigasi'))::int air_tidak_layak,
           count(*) FILTER (WHERE data ? 'sumber_air_minum')::int kk_sanitasi
         FROM k`, dari, sampai),
      // Satuan bawahan langsung & seluruh turunannya (untuk rekap per satuan).
      q<{ unit_id: string; child_id: string; child_nama: string; child_level: string }>(
        `WITH RECURSIVE c AS (
           SELECT id AS unit_id, id AS child_id, nama AS child_nama, level::text AS child_level FROM units WHERE parent_id = $1::uuid AND deleted_at IS NULL
           UNION ALL
           SELECT u.id, c.child_id, c.child_nama, c.child_level FROM units u JOIN c ON u.parent_id = c.unit_id WHERE u.deleted_at IS NULL)
         SELECT * FROM c`),
    ]);

    const unitReports = await q<{ unit_id: string; jumlah: number; prioritas: number; lokasi: number }>(
      `SELECT unit_id, sum(jumlah)::int jumlah, sum(prioritas)::int prioritas, sum(lokasi_janggal)::int lokasi
       FROM agg_unit_daily WHERE ${scope('unit_id')} AND status <> 'DRAFT' AND hari BETWEEN $2::date AND $3::date GROUP BY unit_id`, dari, sampai);

    const bhabinTerpotong = bhabinRows.length > MAX_BHABIN;
    const bhabin: MonthlyBhabin[] = bhabinRows.slice(0, MAX_BHABIN).map((b) => ({
      nrp: b.nrp, nama: b.nama, pangkat: b.pangkat, satuan: b.satuan, desa: b.desa, laporan: b.laporan, lokasiJanggal: b.lokasi,
      hadir: b.hadir, terlambat: b.terlambat, terakhir: b.terakhir,
      perKategori: { SAMBANG: b.sambang, DETEKSI_DINI: b.deteksi_dini, PROBLEM_SOLVING: b.problem_solving, PENYULUHAN: b.penyuluhan,
        HARGA_PANGAN: b.harga_pangan, MAPPING_KK: b.mapping_kk, KETAHANAN_PANGAN: b.ketahanan_pangan },
    }));

    // Rekap per satuan bawahan langsung.
    const childOf = new Map(childMap.map((r) => [r.unit_id, r]));
    const perChild = new Map<string, MonthlyUnitRow>();
    for (const r of childMap) if (r.unit_id === r.child_id) perChild.set(r.child_id, { nama: r.child_nama, level: LEVEL_LABEL[r.child_level] ?? r.child_level, bhabin: 0, bhabinAktif: 0, laporan: 0, prioritas: 0, lokasiJanggal: 0, hadir: 0, terlambat: 0, kehadiranPersen: null });
    for (const r of unitReports) {
      const c = childOf.get(r.unit_id); const row = c && perChild.get(c.child_id);
      if (row) { row.laporan += r.jumlah; row.prioritas += r.prioritas; row.lokasiJanggal += r.lokasi; }
    }
    for (const b of bhabinRows.slice(0, MAX_BHABIN)) {
      const c = childOf.get(b.unit_id); const row = c && perChild.get(c.child_id);
      if (row) { row.bhabin++; if (b.laporan > 0) row.bhabinAktif++; row.hadir += b.hadir; row.terlambat += b.terlambat; }
    }
    const persen = (hadir: number, orang: number) => (orang && hariKerja ? Math.round((hadir / (orang * hariKerja)) * 1000) / 10 : null);
    const perSatuan = [...perChild.values()].map((r) => ({ ...r, kehadiranPersen: persen(r.hadir, r.bhabin) }))
      .sort((a, b) => b.laporan - a.laporan || a.nama.localeCompare(b.nama, 'id'));

    const prevBy = new Map(prevCats.map((c) => [c.category, c]));
    const catBy = new Map(cats.map((c) => [c.category, c]));
    const perKategori = CATEGORIES.map((k) => ({
      kategori: k, label: CATEGORY_LABEL[k], jumlah: catBy.get(k)?.jumlah ?? 0, sebelumnya: prevBy.get(k)?.jumlah ?? 0, prioritas: catBy.get(k)?.prioritas ?? 0,
    })).filter((c) => c.jumlah || c.sebelumnya);
    const sum = <T>(arr: T[], f: (x: T) => number) => arr.reduce((n, x) => n + f(x), 0);
    const hadir = sum(bhabin, (b) => b.hadir);

    const prevPrice = new Map(prevHarga.map((h) => [h.commodity_id, h]));
    return {
      unit: { ...unit, level: unit.level, levelLabel: LEVEL_LABEL[unit.level] ?? unit.level },
      bulan, bulanLabel: `${MONTHS[m - 1]} ${y}`, dari, sampai, hariKerja, berjalan: sampai < akhir,
      dibuat: new Date(), dibuatOleh: [actor.pangkat, actor.nama].filter(Boolean).join(' '),
      ringkasan: {
        laporan: sum(cats, (c) => c.jumlah), laporanSebelumnya: sum(prevCats, (c) => c.jumlah),
        prioritas: sum(cats, (c) => c.prioritas), prioritasSebelumnya: sum(prevCats, (c) => c.prioritas),
        lokasiJanggal: sum(cats, (c) => c.lokasi), bhabin: bhabin.length, bhabinAktif: bhabin.filter((b) => b.laporan > 0).length,
        hadir, terlambat: sum(bhabin, (b) => b.terlambat), kehadiranPersen: persen(hadir, bhabin.length),
      },
      perKategori, perSatuan, bhabin, bhabinTerpotong,
      prioritas: prioritas.map((p) => ({
        nomor: p.nomor, tanggal: p.tanggal, kategori: CATEGORY_LABEL[p.kategori] ?? p.kategori, desa: p.desa, bhabin: p.bhabin,
        ringkasan: p.kategori === 'MAPPING_KK' ? `Balita stunting/berisiko belum ditangani: ${p.health?.belum_ditangani ?? 0}` : (p.ringkasan ?? '').replace(/\s+/g, ' ').trim(),
      })),
      harga: harga.map((h) => {
        const prev = prevPrice.get(h.commodity_id);
        return {
          komoditas: h.nama, satuan: h.satuan, rata2: h.rata2, sebelumnya: prev?.rata2 ?? null,
          perubahan: h.rata2 && prev?.rata2 ? Math.round(((h.rata2 - prev.rata2) / prev.rata2) * 1000) / 10 : null,
          minimum: h.minimum, maksimum: h.maksimum, sampel: h.sampel, kosong: h.kosong,
        };
      }),
      keluarga: {
        kk: keluarga.kk, balita: keluarga.balita, stunting: keluarga.stunting, berisiko: keluarga.berisiko, belumDitangani: keluarga.belum_ditangani,
        ibuHamil: keluarga.ibu_hamil, ibuKek: keluarga.ibu_kek, jambanTidakLayak: keluarga.jamban_tidak_layak, airTidakLayak: keluarga.air_tidak_layak,
        kkSanitasi: keluarga.kk_sanitasi,
      },
    };
  }

  private priceRows(target: string, dari: string, sampai: string) {
    return this.prisma.$queryRawUnsafe<{ commodity_id: number; nama: string; satuan: string; rata2: number | null; minimum: number | null; maksimum: number | null; sampel: number; kosong: number }[]>(
      `SELECT c.id commodity_id, c.nama, c.satuan_default satuan,
         round(sum(a.jumlah_harga)::numeric / nullif(sum(a.sampel), 0))::int rata2, min(a.minimum)::int minimum, max(a.maksimum)::int maksimum,
         coalesce(sum(a.sampel), 0)::int sampel, coalesce(sum(a.kosong), 0)::int kosong
       FROM commodities c
       LEFT JOIN agg_price_daily a ON a.commodity_id = c.id AND a.unit_id IN (SELECT unit_subtree($1::uuid)) AND a.hari BETWEEN $2::date AND $3::date
       GROUP BY c.id ORDER BY c.urutan`, target, dari, sampai);
  }

  /** Peran yang boleh membuat laporan bulanan. */
  static readonly ROLES = [UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR];
}
