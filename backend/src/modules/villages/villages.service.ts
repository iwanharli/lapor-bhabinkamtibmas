import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UnitsService } from '../units/units.service';

@Injectable()
export class VillagesService {
  constructor(private prisma: PrismaService, private units: UnitsService, private audit: AuditService) {}

  async list(me: AuthUser, q?: string) {
    const where: Prisma.VillageWhereInput =
      me.role === UserRole.BHABIN
        ? { userVillages: { some: { userId: me.id, until: null } } }
        : { polsekId: { in: await this.units.descendantIds(me.unitId) } };
    if (q) where.nama = { contains: q, mode: 'insensitive' };
    return this.prisma.village.findMany({ where, orderBy: [{ kabupaten: 'asc' }, { kecamatan: 'asc' }, { nama: 'asc' }], take: 500 });
  }

  async create(me: AuthUser, dto: Prisma.VillageUncheckedCreateInput) {
    if (dto.polsekId) await this.units.assertInScope(me.unitId, dto.polsekId);
    const v = await this.prisma.village.create({ data: dto });
    await this.audit.log({ actorId: me.id, action: 'VILLAGE_CREATE', entity: 'village', entityId: v.id });
    return v;
  }

  async setGeometry(me: AuthUser, id: string, geometry: { type: string; coordinates: unknown }) {
    if (!['Polygon', 'MultiPolygon'].includes(geometry?.type)) {
      throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Geometri harus Polygon/MultiPolygon' });
    }
    const v = await this.prisma.village.findUnique({ where: { id } });
    if (!v || (v.polsekId && !(await this.units.descendantIds(me.unitId)).includes(v.polsekId))) {
      throw new NotFoundException({ code: 'NOT_FOUND' });
    }
    const geojson = JSON.stringify(geometry);
    await this.prisma.$executeRaw`
      UPDATE villages
      SET geom = ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326))),
          centroid = ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326))::geography
      WHERE id = ${id}::uuid`;
    await this.audit.log({ actorId: me.id, action: 'VILLAGE_GEOMETRY_SET', entity: 'village', entityId: id });
    return { id, updated: true };
  }

  /** Cakupan desa untuk admin: desa milik Polsek dalam cakupan (superadmin: semua). */
  private async scopeSql(me: AuthUser) {
    if (me.role === UserRole.SUPERADMIN) return Prisma.sql`TRUE`;
    return Prisma.sql`v.polsek_id = ANY(${await this.units.descendantIds(me.unitId)}::uuid[])`;
  }

  /** Daftar desa untuk halaman admin: status batas wilayah, jumlah Bhabin, dan laporan 30 hari. */
  async adminList(me: AuthUser, q: { q?: string; polsekId?: string; batas?: string; page: number; limit: number }) {
    if (q.polsekId) await this.units.assertInScope(me.unitId, q.polsekId);
    const scope = await this.scopeSql(me);
    const where = Prisma.sql`${scope}
      ${q.polsekId ? Prisma.sql`AND v.polsek_id = ${q.polsekId}::uuid` : Prisma.empty}
      ${q.q ? Prisma.sql`AND (v.nama ILIKE ${'%' + q.q + '%'} OR v.kecamatan ILIKE ${'%' + q.q + '%'} OR v.kode_wilayah LIKE ${q.q + '%'})` : Prisma.empty}
      ${q.batas === 'ada' ? Prisma.sql`AND v.geom IS NOT NULL` : q.batas === 'belum' ? Prisma.sql`AND v.geom IS NULL` : Prisma.empty}`;
    const [data, [{ total }], [stats]] = await Promise.all([
      this.prisma.$queryRaw<unknown[]>`
        SELECT v.id, v.kode_wilayah AS "kodeWilayah", v.nama, v.kecamatan, v.kabupaten, v.provinsi, v.polsek_id AS "polsekId",
               u.nama AS polsek, v.geom IS NOT NULL AS "hasGeometry",
               round((ST_Area(v.geom::geography) / 1e6)::numeric, 2)::float AS "luasKm2",
               (SELECT count(*) FROM user_villages uv JOIN users us ON us.id = uv.user_id WHERE uv.village_id = v.id AND uv.until IS NULL AND us.active)::int AS bhabin,
               (SELECT count(*) FROM reports r WHERE r.village_id = v.id AND r.status <> 'DRAFT' AND r.occurred_at > now() - interval '30 days')::int AS laporan
        FROM villages v LEFT JOIN units u ON u.id = v.polsek_id
        WHERE ${where}
        ORDER BY v.kabupaten, v.kecamatan, v.nama
        LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
      this.prisma.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM villages v WHERE ${where}`,
      this.prisma.$queryRaw<{ total: number; dengan_batas: number; tanpa_bhabin: number }[]>`
        SELECT count(*)::int AS total, count(*) FILTER (WHERE v.geom IS NOT NULL)::int AS dengan_batas,
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM user_villages uv JOIN users us ON us.id = uv.user_id WHERE uv.village_id = v.id AND uv.until IS NULL AND us.active))::int AS tanpa_bhabin
        FROM villages v WHERE ${scope}`,
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total }, stats };
  }

  async update(me: AuthUser, id: string, dto: { nama?: string; kecamatan?: string; kabupaten?: string; provinsi?: string; polsekId?: string }) {
    const v = await this.prisma.village.findUnique({ where: { id } });
    const scope = await this.units.descendantIds(me.unitId);
    if (!v || (me.role !== UserRole.SUPERADMIN && (!v.polsekId || !scope.includes(v.polsekId)))) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (dto.polsekId) await this.units.assertInScope(me.unitId, dto.polsekId);
    if (dto.polsekId && dto.polsekId !== v.polsekId) {
      // Pindah Polsek: penugasan Bhabin lama tidak lagi sesuai wilayah.
      const assigned = await this.prisma.userVillage.count({ where: { villageId: id, until: null } });
      if (assigned) throw new ConflictException({ code: 'CONFLICT', message: `Desa masih dibina ${assigned} Bhabin; lepaskan penugasan dulu sebelum memindah Polsek` });
    }
    const updated = await this.prisma.village.update({ where: { id }, data: dto });
    await this.audit.log({ actorId: me.id, action: 'VILLAGE_UPDATE', entity: 'village', entityId: id, meta: { fields: Object.keys(dto) } });
    return updated;
  }

  /**
   * Desa satu kecamatan dari data Kemendagri (seed:wilayah) untuk ditetapkan ke Polsek.
   * `assignable`: belum punya Polsek, atau Polsek-nya dalam cakupan admin.
   */
  async byKecamatan(me: AuthUser, kecamatanKode: string) {
    const scope = me.role === UserRole.SUPERADMIN ? null : await this.units.descendantIds(me.unitId);
    const rows = await this.prisma.$queryRaw<{ id: string; kodeWilayah: string; nama: string; polsekId: string | null; polsek: string | null; bhabin: number; batas: boolean }[]>`
      SELECT v.id::text, v.kode_wilayah AS "kodeWilayah", v.nama, v.polsek_id::text AS "polsekId", u.nama AS polsek,
             (SELECT count(*) FROM user_villages uv WHERE uv.village_id = v.id AND uv.until IS NULL)::int AS bhabin,
             v.geom IS NOT NULL AS batas
      FROM villages v LEFT JOIN units u ON u.id = v.polsek_id
      WHERE v.kecamatan_kode = ${kecamatanKode}
      ORDER BY v.kode_wilayah`;
    return rows.map((r) => ({ ...r, assignable: !r.polsekId || !scope || scope.includes(r.polsekId) }));
  }

  /** Tetapkan banyak desa ke satu Polsek. Desa milik Polsek di luar cakupan atau masih dibina Bhabin Polsek lain ditolak. */
  async assign(me: AuthUser, dto: { polsekId: string; villageIds: string[] }) {
    await this.units.assertInScope(me.unitId, dto.polsekId);
    const polsek = await this.prisma.unit.findUnique({ where: { id: dto.polsekId } });
    if (polsek?.level !== 'POLSEK') throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Desa hanya dapat ditetapkan ke Polsek' });
    const scope = me.role === UserRole.SUPERADMIN ? null : await this.units.descendantIds(me.unitId);
    const villages = await this.prisma.village.findMany({
      where: { id: { in: dto.villageIds } },
      select: { id: true, nama: true, polsekId: true, _count: { select: { userVillages: { where: { until: null } } } } },
    });
    const problems = villages.flatMap((v) => {
      if (v.polsekId === dto.polsekId) return [];
      if (v.polsekId && scope && !scope.includes(v.polsekId)) return [`${v.nama}: dibina Polsek di luar cakupan Anda`];
      if (v.polsekId && v._count.userVillages) return [`${v.nama}: masih dibina ${v._count.userVillages} Bhabin Polsek lain`];
      return [];
    });
    if (villages.length !== dto.villageIds.length) problems.push('Sebagian desa tidak ditemukan');
    if (problems.length) throw new ConflictException({ code: 'CONFLICT', message: 'Sebagian desa tidak dapat ditetapkan', details: problems });

    const ids = villages.filter((v) => v.polsekId !== dto.polsekId).map((v) => v.id);
    if (ids.length) await this.prisma.village.updateMany({ where: { id: { in: ids } }, data: { polsekId: dto.polsekId } });
    await this.audit.log({ actorId: me.id, action: 'VILLAGE_UPDATE', entity: 'unit', entityId: dto.polsekId, meta: { assigned: ids.length, villageIds: ids } });
    return { assigned: ids.length };
  }

  /** Batas desa (GeoJSON, disederhanakan) untuk peta. */
  async geojson(me: AuthUser, polsekId?: string) {
    if (polsekId) await this.units.assertInScope(me.unitId, polsekId);
    const scope = await this.scopeSql(me);
    const rows = await this.prisma.$queryRaw<{ id: string; nama: string; kecamatan: string; geometry: string }[]>`
      SELECT v.id, v.nama, v.kecamatan, ST_AsGeoJSON(ST_SimplifyPreserveTopology(v.geom, 0.00005), 6) AS geometry
      FROM villages v
      WHERE ${scope} AND v.geom IS NOT NULL ${polsekId ? Prisma.sql`AND v.polsek_id = ${polsekId}::uuid` : Prisma.empty}`;
    return {
      type: 'FeatureCollection',
      features: rows.map((r) => ({ type: 'Feature', id: r.id, properties: { id: r.id, nama: r.nama, kecamatan: r.kecamatan }, geometry: JSON.parse(r.geometry) })),
    };
  }

  /**
   * Impor desa dari GeoJSON FeatureCollection. Properti yang dikenali: kode_wilayah|kode, nama, kecamatan, kabupaten, provinsi.
   * Desa dibuat/diperbarui berdasarkan kode wilayah dan ditempatkan di `polsekId`. `dryRun` hanya memvalidasi.
   */
  async importGeojson(me: AuthUser, dto: { polsekId: string; features: GeoFeature[]; dryRun?: boolean }) {
    await this.units.assertInScope(me.unitId, dto.polsekId);
    const polsek = await this.prisma.unit.findUniqueOrThrow({ where: { id: dto.polsekId } });
    if (polsek.level !== 'POLSEK') throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Desa harus ditempatkan di Polsek' });
    if (!dto.features.length || dto.features.length > 2000) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Jumlah fitur harus 1–2.000' });

    const prop = (p: Record<string, unknown>, ...keys: string[]) => {
      for (const k of keys) {
        const hit = Object.entries(p).find(([pk]) => pk.toLowerCase() === k);
        if (hit && hit[1] != null && String(hit[1]).trim()) return String(hit[1]).trim();
      }
      return '';
    };
    const codes = dto.features.map((f) => prop(f.properties ?? {}, 'kode_wilayah', 'kode', 'kd_desa', 'kode_desa'));
    const existing = new Map((await this.prisma.village.findMany({ where: { kodeWilayah: { in: codes.filter(Boolean) } } })).map((v) => [v.kodeWilayah, v]));
    const seen = new Set<string>();

    const rows = dto.features.map((f, i) => {
      const p = f.properties ?? {};
      const kode = codes[i];
      const row = {
        row: i + 1, kode, nama: prop(p, 'nama', 'desa', 'nama_desa', 'namobj'), kecamatan: prop(p, 'kecamatan', 'kec', 'wadmkc'),
        kabupaten: prop(p, 'kabupaten', 'kab', 'kota', 'wadmkk'), provinsi: prop(p, 'provinsi', 'prov', 'wadmpr'),
        action: 'baru' as 'baru' | 'perbarui', errors: [] as string[],
      };
      if (!/^\d{2}(\.\d{2}){2}\.\d{4}$/.test(kode)) row.errors.push('kode wilayah harus format 32.01.01.2001');
      else if (seen.has(kode)) row.errors.push('kode wilayah ganda dalam file');
      seen.add(kode);
      if (!row.nama) row.errors.push('nama desa kosong');
      if (!row.kecamatan || !row.kabupaten || !row.provinsi) row.errors.push('kecamatan/kabupaten/provinsi wajib');
      if (!f.geometry || !['Polygon', 'MultiPolygon'].includes(f.geometry.type)) row.errors.push('geometri harus Polygon/MultiPolygon');
      const ex = existing.get(kode);
      if (ex) {
        row.action = 'perbarui';
        if (ex.polsekId && ex.polsekId !== dto.polsekId) row.errors.push('desa sudah terdaftar di Polsek lain');
      }
      return row;
    });

    const valid = rows.every((r) => !r.errors.length);
    if (dto.dryRun || !valid) {
      if (!dto.dryRun) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Masih ada fitur yang belum valid', details: rows.filter((r) => r.errors.length).slice(0, 20).map((r) => `Fitur ${r.row}: ${r.errors.join('; ')}`) });
      return { valid, total: rows.length, errorCount: rows.filter((r) => r.errors.length).length, rows };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [i, r] of rows.entries()) {
        const geo = JSON.stringify(dto.features[i].geometry);
        await tx.$executeRaw`
          INSERT INTO villages (id, kode_wilayah, nama, kecamatan, kabupaten, provinsi, polsek_id, geom, centroid)
          VALUES (gen_random_uuid(), ${r.kode}, ${r.nama}, ${r.kecamatan}, ${r.kabupaten}, ${r.provinsi}, ${dto.polsekId}::uuid,
                  ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geo}), 4326))),
                  ST_PointOnSurface(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geo}), 4326)))::geography)
          ON CONFLICT (kode_wilayah) DO UPDATE SET nama = EXCLUDED.nama, kecamatan = EXCLUDED.kecamatan, kabupaten = EXCLUDED.kabupaten,
            provinsi = EXCLUDED.provinsi, polsek_id = EXCLUDED.polsek_id, geom = EXCLUDED.geom, centroid = EXCLUDED.centroid`;
      }
      await this.audit.log({ actorId: me.id, action: 'VILLAGE_IMPORT', entity: 'village', meta: { count: rows.length, polsekId: dto.polsekId } }, tx);
    }, { timeout: 120_000 });
    return { imported: rows.length, created: rows.filter((r) => r.action === 'baru').length, updated: rows.filter((r) => r.action === 'perbarui').length };
  }
}

export interface GeoFeature {
  type?: string;
  properties?: Record<string, unknown>;
  geometry?: { type: string; coordinates: unknown };
}
