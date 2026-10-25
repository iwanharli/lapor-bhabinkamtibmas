import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ReportCategory } from '@prisma/client';
import { SensitiveDataService } from '../../common/crypto/sensitive-data.service';
import { DEFAULT_TZ, isoLocal, localDate } from '../../common/time';
import { PrismaService } from '../../prisma/prisma.service';
import { mergeSensitive } from '../reports/report-validator';

export interface PageQuery {
  limit?: number;
  cursor?: string;
  updatedSince?: string;
}

export interface RangeQuery extends PageQuery {
  date?: string;
  from?: string;
  to?: string;
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
  generatedAt: string;
}

/** Baris mentah halaman: `k` kunci urut stabil (teks), `cur_u` updatedAt presisi mikrodetik untuk kursor. */
type Keyed = { k: string; cur_u: string };

/** Isian kesehatan per orang tidak dikirim ke Pusat (cukup ringkasan family-summary). */
const HEALTH_KEYS = ['status_stunting', 'stunting_ditangani', 'stunting_ket', 'risiko_ibu', 'kk_risiko_ibu'];
/** Dari bagian terenkripsi Mapping KK hanya No. KK yang dibuka (nama anggota memang tersimpan sebagai data biasa). */
const MAPPING_SECRET_KEYS = ['no_kk'];

const JUDUL: Partial<Record<ReportCategory, (d: Record<string, any>) => unknown>> = {
  SAMBANG: (d) => d.jenis_sasaran && `Sambang ${d.jenis_sasaran}`,
  DETEKSI_DINI: (d) => d.kategori_kerawanan,
  PROBLEM_SOLVING: (d) => d.pokok_masalah,
  PENYULUHAN: (d) => d.tema,
  HARGA_PANGAN: (d) => d.nama_pasar || d.jenis_lokasi,
  MAPPING_KK: (d) => (d.kk_nama || d.nama_kk) && `KK ${d.kk_nama || d.nama_kk}`,
  KETAHANAN_PANGAN: (d) => d.jenis_usaha,
};
const LABEL: Record<ReportCategory, string> = {
  SAMBANG: 'Sambang', DETEKSI_DINI: 'Deteksi dini', PROBLEM_SOLVING: 'Problem solving', PENYULUHAN: 'Penyuluhan',
  HARGA_PANGAN: 'Harga pangan', MAPPING_KK: 'Mapping KK', KETAHANAN_PANGAN: 'Ketahanan pangan',
};

const kode10 = (kodeWilayah: string) => kodeWilayah.replace(/\D/g, '');
const num = (v: unknown) => (v == null ? null : Number(v));

@Injectable()
export class IntegrationService {
  private rootTz?: string;

  constructor(private prisma: PrismaService, private crypto: SensitiveDataService) {}

  /** Zona waktu instance: zona unit Polda (atau unit akar) — dipakai untuk generatedAt & periode bawaan. */
  async instanceTz() {
    if (!this.rootTz) {
      const u = await this.prisma.unit.findFirst({ where: { deletedAt: null, OR: [{ level: 'POLDA' }, { parentId: null }] }, orderBy: [{ level: 'desc' }, { kode: 'asc' }] });
      this.rootTz = u?.timezone ?? DEFAULT_TZ;
    }
    return this.rootTz;
  }

  async units() {
    const rows = await this.prisma.$queryRaw<{ id: string; kode: string; level: string; nama: string; parent_id: string | null; timezone: string; kode_polda: string | null }[]>`
      WITH RECURSIVE t AS (
        SELECT id, kode, level, nama, parent_id, timezone, CASE WHEN level = 'POLDA' THEN kode END AS kode_polda
        FROM units WHERE parent_id IS NULL AND deleted_at IS NULL
        UNION ALL
        SELECT c.id, c.kode, c.level, c.nama, c.parent_id, c.timezone, coalesce(t.kode_polda, CASE WHEN c.level = 'POLDA' THEN c.kode END)
        FROM units c JOIN t ON c.parent_id = t.id WHERE c.deleted_at IS NULL
      )
      SELECT id::text, kode, level::text, nama, parent_id::text, timezone, kode_polda FROM t ORDER BY level, kode`;
    return this.wrap(rows.map((u) => ({
      id: u.id, kode: u.kode, level: u.level, nama: u.nama, parentId: u.parent_id, zonaWaktu: u.timezone, kodePolda: u.kode_polda,
    })), null);
  }

  async villages(q: PageQuery) {
    const rows = await this.page<Keyed & { nama: string; kode_wilayah: string; lat: number | null; lng: number | null; polsek_id: string | null; bhabin_id: string | null; upd: Date; tz: string }>(Prisma.sql`
      SELECT v.id::text AS k, v.updated_at AS upd, v.nama, v.kode_wilayah, ST_Y(v.centroid::geometry) AS lat, ST_X(v.centroid::geometry) AS lng,
        v.polsek_id::text, coalesce(p.timezone, ${DEFAULT_TZ}) AS tz,
        (SELECT uv.user_id::text FROM user_villages uv JOIN users b ON b.id = uv.user_id AND b.role = 'BHABIN'
          WHERE uv.village_id = v.id AND uv.until IS NULL ORDER BY uv.since DESC LIMIT 1) AS bhabin_id
      FROM villages v LEFT JOIN units p ON p.id = v.polsek_id`, q);
    return this.wrap(rows.data.map((v) => {
      const kode = kode10(v.kode_wilayah);
      return {
        id: v.k, nama: v.nama, kodeKabupaten: kode.slice(0, 4), kodeKecamatan: kode.slice(0, 6), kodeDesa: kode,
        lat: num(v.lat), lng: num(v.lng), polsekId: v.polsek_id, bhabinId: v.bhabin_id, updatedAt: isoLocal(v.upd, v.tz),
      };
    }), rows.nextCursor);
  }

  async bhabins(q: PageQuery) {
    const rows = await this.page<Keyed & { pangkat: string | null; nama: string; nrp: string; unit_id: string; desa_ids: string[]; active: boolean; upd: Date; tz: string }>(Prisma.sql`
      SELECT b.id::text AS k, b.updated_at AS upd, b.pangkat, b.nama, b.nrp, b.unit_id::text, b.active, u.timezone AS tz,
        coalesce((SELECT array_agg(uv.village_id::text ORDER BY uv.since) FROM user_villages uv WHERE uv.user_id = b.id AND uv.until IS NULL), '{}') AS desa_ids
      FROM users b JOIN units u ON u.id = b.unit_id WHERE b.role = 'BHABIN'`, q);
    return this.wrap(rows.data.map((b) => ({
      id: b.k, pangkat: b.pangkat, nama: b.nama, nrp: b.nrp, polsekId: b.unit_id, desaIds: b.desa_ids, aktif: b.active, updatedAt: isoLocal(b.upd, b.tz),
    })), rows.nextCursor);
  }

  async reports(q: RangeQuery & { category?: ReportCategory }) {
    const rows = await this.page<Keyed & {
      nomor: string | null; category: ReportCategory; status: string; priority: boolean; occurred_at: Date; lat: number; lng: number;
      gps_accuracy_m: number | null; is_mock_location: boolean; inside_village: boolean | null; village_id: string; user_id: string;
      schema_version: number; data: Record<string, any>; sensitive: Buffer | null; foto: number; upd: Date; tz: string;
    }>(Prisma.sql`
      SELECT r.id::text AS k, r.updated_at AS upd, r.nomor, r.category, r.status::text, r.priority, r.occurred_at, r.lat, r.lng, r.gps_accuracy_m,
        r.is_mock_location, r.inside_village, r.village_id::text, r.user_id::text, r.schema_version, r.data,
        CASE WHEN r.category = 'MAPPING_KK' THEN r.sensitive END AS sensitive, u.timezone AS tz,
        (SELECT count(*)::int FROM attachments a WHERE a.report_id = r.id) AS foto
      FROM reports r JOIN units u ON u.id = r.unit_id
      WHERE r.status <> 'DRAFT'
        ${q.category ? Prisma.sql`AND r.category = ${q.category}::report_category` : Prisma.empty}
        ${this.dateFilter(Prisma.sql`(r.occurred_at AT TIME ZONE u.timezone)::date`, q)}`, q);
    return this.wrap(rows.data.map((r) => {
      const urgensi = r.category === 'DETEKSI_DINI' && typeof r.data?.urgensi === 'string' ? r.data.urgensi.toUpperCase() : null;
      return {
        id: r.k, nomor: r.nomor, kategori: r.category, waktu: isoLocal(r.occurred_at, r.tz),
        judul: String(JUDUL[r.category]?.(r.data ?? {}) || LABEL[r.category]),
        urgensi, prioritas: r.priority, lat: r.lat, lng: r.lng, akurasiGps: num(r.gps_accuracy_m),
        lokasiDicek: r.is_mock_location || r.inside_village === false,
        desaId: r.village_id, bhabinId: r.user_id, jumlahFoto: r.foto, skemaVersi: r.schema_version,
        isian: this.isian(r.category, r.data ?? {}, r.sensitive), status: r.status,
        updatedAt: isoLocal(r.upd, r.tz), deleted: r.status === 'REJECTED',
      };
    }), rows.nextCursor);
  }

  /** Satu baris per Bhabin per tanggal kerja (gabungan absen masuk & pulang). */
  async attendance(q: RangeQuery) {
    const since = this.since(q);
    const rows = await this.page<Keyed & {
      user_id: string; work_date: string; tz: string; upd: Date; masuk: Date | null; pulang: Date | null;
      lat_in: number | null; lng_in: number | null; in_in: boolean | null; lat_out: number | null; lng_out: number | null; in_out: boolean | null; palsu: boolean;
    }>(Prisma.sql`
      SELECT a.user_id::text || ':' || a.work_date::text AS k, max(a.server_time) AS upd, a.user_id::text, a.work_date::text, u.timezone AS tz,
        max(a.client_time) FILTER (WHERE a.type = 'CHECK_IN') AS masuk, max(a.client_time) FILTER (WHERE a.type = 'CHECK_OUT') AS pulang,
        max(a.lat) FILTER (WHERE a.type = 'CHECK_IN') AS lat_in, max(a.lng) FILTER (WHERE a.type = 'CHECK_IN') AS lng_in,
        bool_or(a.inside_village) FILTER (WHERE a.type = 'CHECK_IN') AS in_in,
        max(a.lat) FILTER (WHERE a.type = 'CHECK_OUT') AS lat_out, max(a.lng) FILTER (WHERE a.type = 'CHECK_OUT') AS lng_out,
        bool_or(a.inside_village) FILTER (WHERE a.type = 'CHECK_OUT') AS in_out,
        bool_or(a.is_mock_location) AS palsu
      FROM attendances a JOIN units u ON u.id = a.unit_id
      WHERE TRUE ${this.dateFilter(Prisma.sql`a.work_date`, q)}
        ${since ? Prisma.sql`AND (a.user_id, a.work_date) IN (SELECT user_id, work_date FROM attendances WHERE server_time >= ${since})` : Prisma.empty}
      GROUP BY a.user_id, a.work_date, u.timezone`, q);
    const loc = (lat: number | null, lng: number | null, inside: boolean | null) => (lat == null ? null : { lat, lng, didalamDesa: inside });
    return this.wrap(rows.data.map((a) => ({
      id: `ABS-${a.work_date.replace(/-/g, '')}-${a.user_id}`, bhabinId: a.user_id, tanggal: a.work_date,
      jamMasuk: isoLocal(a.masuk, a.tz), jamPulang: isoLocal(a.pulang, a.tz),
      lokasiMasuk: loc(a.lat_in, a.lng_in, a.in_in), lokasiPulang: loc(a.lat_out, a.lng_out, a.in_out),
      lokasiPalsu: a.palsu, updatedAt: isoLocal(a.upd, a.tz),
    })), rows.nextCursor);
  }

  /** Satu baris per komoditas per laporan Harga Pangan (tanpa dirata-rata). */
  async prices(q: RangeQuery) {
    const rows = await this.page<Keyed & {
      report_id: string; tanggal: string; kode: string; nama: string; satuan: string; harga: number; stok: string;
      village_id: string; user_id: string; status: string; upd: Date; tz: string;
    }>(Prisma.sql`
      SELECT r.id::text || ':' || c.kode AS k, r.updated_at AS upd, r.id::text AS report_id, (r.occurred_at AT TIME ZONE u.timezone)::date::text AS tanggal,
        c.kode, c.nama, i.satuan, i.harga, i.stok::text, r.village_id::text, r.user_id::text, r.status::text, u.timezone AS tz
      FROM report_items i JOIN reports r ON r.id = i.report_id JOIN commodities c ON c.id = i.commodity_id JOIN units u ON u.id = r.unit_id
      WHERE r.category = 'HARGA_PANGAN' AND r.status <> 'DRAFT'
        ${this.dateFilter(Prisma.sql`(r.occurred_at AT TIME ZONE u.timezone)::date`, q)}`, q);
    return this.wrap(rows.data.map((p) => ({
      id: p.k, laporanId: p.report_id, tanggal: p.tanggal, komoditas: p.kode, namaKomoditas: p.nama, satuan: p.satuan, harga: p.harga, stok: p.stok,
      desaId: p.village_id, bhabinId: p.user_id, updatedAt: isoLocal(p.upd, p.tz), deleted: p.status === 'REJECTED',
    })), rows.nextCursor);
  }

  async commodities() {
    const rows = await this.prisma.commodity.findMany({ orderBy: [{ urutan: 'asc' }, { kode: 'asc' }] });
    return this.wrap(rows.map((c) => ({ komoditas: c.kode, namaKomoditas: c.nama, satuan: c.satuanDefault, aktif: c.active })), null);
  }

  /**
   * Ringkasan keluarga per desa pada akhir `periode` (YYYY-MM, bawaan bulan berjalan): KK hasil Mapping v2 terkirim
   * dengan waktu kegiatan sebelum akhir bulan; KK yang dilaporkan ulang (sidik No. KK sama) dihitung dari laporan terbarunya.
   * Definisi sama dengan dashboard Stunting (AnalyticsService.stunting).
   */
  async familySummary(q: PageQuery & { periode?: string }) {
    const periode = q.periode ?? localDate(new Date(), await this.instanceTz()).slice(0, 7);
    const [y, m] = periode.split('-').map(Number);
    const end = `${m === 12 ? y + 1 : y}-${String((m % 12) + 1).padStart(2, '0')}-01`;
    const rows = await this.page<Keyed & Record<string, number> & { upd: Date }>(Prisma.sql`
      WITH k AS (
        SELECT DISTINCT ON (coalesce(r.kk_hash, r.id::text)) r.village_id, r.data, r.health, r.updated_at FROM reports r JOIN units u ON u.id = r.unit_id
        WHERE r.category = 'MAPPING_KK' AND r.status = 'SUBMITTED' AND r.schema_version = 2 AND r.occurred_at < (${end}::timestamp AT TIME ZONE u.timezone)
        ORDER BY coalesce(r.kk_hash, r.id::text), r.submitted_at DESC
      )
      SELECT village_id::text AS k, max(updated_at) AS upd, count(*)::int AS kk,
        coalesce(sum((health->>'balita')::int), 0)::int AS balita,
        coalesce(sum((health->>'stunting')::int), 0)::int AS stunting,
        coalesce(sum((health->>'berisiko')::int), 0)::int AS berisiko,
        coalesce(sum((health->>'belum_ditangani')::int), 0)::int AS belum_ditangani,
        coalesce(sum((health->>'ibu_hamil')::int), 0)::int AS ibu_hamil,
        coalesce(sum((health->>'ibu_kek')::int), 0)::int AS kek,
        coalesce(sum((health->>'remaja_anemia')::int), 0)::int AS anemia,
        coalesce(sum((SELECT count(*) FROM jsonb_array_elements(coalesce(data->'anggota', '[]'::jsonb)) a WHERE a->>'calon_pengantin' = 'Ya')), 0)::int AS catin,
        count(*) FILTER (WHERE data->>'jamban' = 'Jamban sendiri dengan septic tank')::int AS sanitasi_layak,
        count(*) FILTER (WHERE data ? 'jamban' AND data->>'jamban' <> 'Jamban sendiri dengan septic tank')::int AS sanitasi_tidak_layak
      FROM k GROUP BY village_id`, q);
    const tz = await this.instanceTz();
    return this.wrap(rows.data.map((r) => ({
      desaId: r.k, periode, kk: r.kk, balita: r.balita, stunting: r.stunting, berisikoStunting: r.berisiko, belumDitangani: r.belum_ditangani,
      ibuHamil: r.ibu_hamil, kek: r.kek, anemia: r.anemia, calonPengantin: r.catin,
      sanitasiLayak: r.sanitasi_layak, sanitasiTidakLayak: r.sanitasi_tidak_layak, updatedAt: isoLocal(r.upd, tz),
    })), rows.nextCursor);
  }

  /** Isian laporan untuk Pusat: data biasa; untuk Mapping KK ditambah No. KK terdekripsi, tanpa isian kesehatan per orang. */
  private isian(category: ReportCategory, data: Record<string, any>, sensitive: Buffer | null) {
    if (category !== 'MAPPING_KK') return data;
    const secret = sensitive ? this.crypto.decrypt(Buffer.from(sensitive)) : {};
    const out = mergeSensitive(data, Object.fromEntries(MAPPING_SECRET_KEYS.filter((k) => k in secret).map((k) => [k, secret[k]])));
    const strip = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([k]) => !HEALTH_KEYS.includes(k)));
    const res = strip(out);
    if (Array.isArray(res.anggota)) res.anggota = (res.anggota as Record<string, unknown>[]).map((a) => strip(a ?? {}));
    return res;
  }

  private dateFilter(col: Prisma.Sql, q: RangeQuery) {
    const from = q.date ?? q.from;
    const to = q.date ?? q.to;
    return Prisma.sql`${from ? Prisma.sql`AND ${col} >= ${from}::date` : Prisma.empty} ${to ? Prisma.sql`AND ${col} <= ${to}::date` : Prisma.empty}`;
  }

  private since(q: PageQuery) {
    if (!q.updatedSince) return null;
    const d = new Date(q.updatedSince);
    if (Number.isNaN(d.getTime())) throw new BadRequestException({ code: 'INVALID_UPDATED_SINCE', message: 'updatedSince harus ISO 8601' });
    return d;
  }

  /**
   * Paginasi kursor atas kueri dasar yang memiliki kolom `k` (kunci teks) & `upd` (updated_at).
   * Urutan (upd, k COLLATE "C") stabil; kursor menyimpan upd presisi mikrodetik agar tidak ada baris terulang/terlewat.
   */
  private async page<T extends Keyed>(base: Prisma.Sql, q: PageQuery) {
    const limit = q.limit ?? 500;
    const since = this.since(q);
    let cur: { u: string; i: string } | null = null;
    if (q.cursor) {
      try {
        cur = JSON.parse(Buffer.from(q.cursor, 'base64url').toString('utf8'));
        if (typeof cur?.u !== 'string' || typeof cur?.i !== 'string' || Number.isNaN(Date.parse(cur.u))) throw new Error();
      } catch {
        throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'Kursor tidak valid' });
      }
    }
    const rows = await this.prisma.$queryRaw<T[]>`
      SELECT q.*, to_char(q.upd AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cur_u FROM (${base}) q
      WHERE TRUE
        ${since ? Prisma.sql`AND q.upd >= ${since}` : Prisma.empty}
        ${cur ? Prisma.sql`AND (q.upd > ${cur.u}::timestamptz OR (q.upd = ${cur.u}::timestamptz AND q.k COLLATE "C" > ${cur.i}))` : Prisma.empty}
      ORDER BY q.upd, q.k COLLATE "C"
      LIMIT ${limit + 1}`;
    const more = rows.length > limit;
    const data = more ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    return { data, nextCursor: more ? Buffer.from(JSON.stringify({ u: last.cur_u, i: last.k })).toString('base64url') : null };
  }

  private async wrap<T>(data: T[], nextCursor: string | null): Promise<Page<T>> {
    return { data, nextCursor, generatedAt: isoLocal(new Date(), await this.instanceTz())! };
  }
}
