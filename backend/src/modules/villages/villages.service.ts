import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UnitsService } from '../units/units.service';

/** Batas jumlah poligon desa per permintaan peta. */
const GEOJSON_MAX = 2000;

/** Nama satuan kawasan, bukan wilayah kecamatan. */
const KAWASAN = 'kawasan|pelabuhan|bandara|kp3|kspn';

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

  async distance(me: AuthUser, id: string, lat: number, lng: number) {
    // Bhabin hanya untuk desa binaannya; peran lain sebatas cakupan unitnya.
    if (me.role === UserRole.BHABIN) {
      const own = await this.prisma.userVillage.count({ where: { userId: me.id, villageId: id, until: null } });
      if (!own) throw new NotFoundException({ code: 'NOT_FOUND' });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new BadRequestException('Koordinat tidak valid');
    const [row] = await this.prisma.$queryRaw<{ d: number | null }[]>`
      SELECT round(ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography))::float AS d
      FROM villages WHERE id = ${id}::uuid AND geom IS NOT NULL`;
    const distanceM = row?.d ?? null;
    return { distanceM, insideVillage: distanceM == null ? null : distanceM <= 200 };
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
    return Prisma.sql`v.polsek_id IN (SELECT unit_subtree(${me.unitId}::uuid))`;
  }

  /** Anak satu wilayah untuk pohon desa, hanya yang berisi desa dalam cakupan: jumlah desa, yang terbina Bhabin, dan satuan Polri pembinanya. */
  async tree(me: AuthUser, parent?: string) {
    const scope = await this.scopeSql(me);
    const len = parent ? parent.length + 3 : 2;
    return this.prisma.$queryRaw<{ kode: string; nama: string; level: number; desa: number; terbina: number; satuan: string[] }[]>`
      SELECT r.kode, r.nama, r.level, c.desa, c.terbina,
             ARRAY(SELECT u.name FROM polri_wilayah m JOIN polri_units u ON u.id = m.unit_id
                   WHERE m.kode = r.kode AND m.method NOT IN ('via_polres', 'via_polsek') ORDER BY u.name) AS satuan
      FROM regions r
      JOIN (
        SELECT left(v.kecamatan_kode, ${len}::int) AS kode, count(*)::int AS desa,
               count(*) FILTER (WHERE EXISTS (
                 SELECT 1 FROM user_villages uv JOIN users us ON us.id = uv.user_id
                 WHERE uv.village_id = v.id AND uv.until IS NULL AND us.active))::int AS terbina
        FROM villages v
        WHERE ${scope} ${parent ? Prisma.sql`AND v.kecamatan_kode LIKE ${parent + '.%'}` : Prisma.empty}
        GROUP BY 1
      ) c ON c.kode = r.kode
      ORDER BY r.nama`;
  }

  /** Polsek tanpa pemetaan ke kecamatan, untuk ditinjau manual. Satuan kawasan (pelabuhan, bandara, dst.) memang bisa tidak punya kecamatan sendiri. */
  async polsekWithoutRegion(me: AuthUser, q: { q?: string; jenis?: string; page: number; limit: number }) {
    const kawasan = Prisma.sql`s.name ~* ${KAWASAN}`;
    const base = Prisma.sql`s.kind = 'POLSEK' AND NOT EXISTS (SELECT 1 FROM polri_wilayah m WHERE m.unit_id = s.id)
      ${me.role === UserRole.SUPERADMIN ? Prisma.empty : Prisma.sql`AND coalesce(s.unit_id, s.id) IN (SELECT unit_subtree(${me.unitId}::uuid))`}`;
    const search = Prisma.sql`${q.q ? Prisma.sql`AND (s.name ILIKE ${'%' + q.q + '%'} OR res.name ILIKE ${'%' + q.q + '%'} OR da.name ILIKE ${'%' + q.q + '%'})` : Prisma.empty}`;
    const from = Prisma.sql`FROM polri_units s JOIN polri_units res ON res.id = s.parent_id JOIN polri_units da ON da.id = res.parent_id`;
    const where = Prisma.sql`${base} ${search}
      ${q.jenis === 'kawasan' ? Prisma.sql`AND ${kawasan}` : q.jenis === 'biasa' ? Prisma.sql`AND NOT ${kawasan}` : Prisma.empty}`;
    const [data, [{ total }], [stats]] = await Promise.all([
      this.prisma.$queryRaw<unknown[]>`
        SELECT s.id, s.name AS nama, res.name AS polres, da.name AS polda, s.lat, s.lng, ${kawasan} AS kawasan
        ${from} WHERE ${where} ORDER BY da.name, res.name, s.name
        LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
      this.prisma.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${from} WHERE ${where}`,
      this.prisma.$queryRaw<{ total: number; kawasan: number }[]>`
        SELECT count(*)::int AS total, count(*) FILTER (WHERE ${kawasan})::int AS kawasan ${from} WHERE ${base}`,
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total }, stats };
  }

  async polsekList(me: AuthUser, q: { q?: string; koordinat?: string; page: number; limit: number }) {
    const where = Prisma.sql`s.kind = 'POLSEK'
      ${me.role === UserRole.SUPERADMIN ? Prisma.empty : Prisma.sql`AND coalesce(s.unit_id, s.id) IN (SELECT unit_subtree(${me.unitId}::uuid))`}
      ${q.q ? Prisma.sql`AND (s.name ILIKE ${'%' + q.q + '%'} OR res.name ILIKE ${'%' + q.q + '%'} OR da.name ILIKE ${'%' + q.q + '%'})` : Prisma.empty}
      ${q.koordinat === 'ada' ? Prisma.sql`AND s.lat IS NOT NULL` : q.koordinat === 'belum' ? Prisma.sql`AND s.lat IS NULL` : Prisma.empty}`;
    const from = Prisma.sql`FROM polri_units s JOIN polri_units res ON res.id = s.parent_id JOIN polri_units da ON da.id = res.parent_id`;
    const [data, [{ total }]] = await Promise.all([
      this.prisma.$queryRaw<unknown[]>`
        SELECT s.id, s.name AS nama, res.name AS polres, da.name AS polda, s.lat, s.lng, s.manual,
               ARRAY(SELECT r.nama FROM polri_wilayah m JOIN regions r ON r.kode = m.kode WHERE m.unit_id = s.id ORDER BY r.nama) AS kecamatan
        ${from} WHERE ${where} ORDER BY da.name, res.name, s.name
        LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
      this.prisma.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${from} WHERE ${where}`,
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }

  polriUnits(parent?: string) {
    return this.prisma.polriUnit.findMany({ where: parent ? { parentId: parent, kind: 'POLRES' } : { kind: 'POLDA' }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  }

  /** Unit padanan satuan nasional. */
  private async unitOfPolri(polriId: string) {
    const p = await this.prisma.polriUnit.findUnique({ where: { id: polriId }, select: { unitId: true } });
    return p?.unitId ? this.prisma.unit.findUnique({ where: { id: p.unitId } }) : null;
  }

  /** Kecamatan tempat titik berada, dalam cakupan kab/kota Polres-nya. */
  private async kecamatanAt(polresId: string, lat: number, lng: number) {
    const [row] = await this.prisma.$queryRaw<{ kode: string; nama: string }[]>`
      SELECT r.kode, r.nama FROM regions r
      WHERE r.level = 3 AND ST_Intersects(r.geom, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
        AND EXISTS (SELECT 1 FROM polri_wilayah p WHERE p.unit_id = ${polresId}::uuid AND p.kode = left(r.kode, 5))
      LIMIT 1`;
    return row ?? null;
  }

  /** Hubungkan Polsek ke kecamatan di titiknya bila salah satunya masih kosong, lalu isi desa kecamatan itu yang belum punya Polsek. */
  private async linkByPoint(polsekId: string, polresId: string, lat: number, lng: number) {
    const kec = await this.kecamatanAt(polresId, lat, lng);
    await this.prisma.polriWilayah.deleteMany({ where: { unitId: polsekId, method: 'koordinat' } });
    if (!kec) return null;
    const [mineCount, occupied] = await Promise.all([
      this.prisma.polriWilayah.count({ where: { unitId: polsekId } }),
      this.prisma.polriWilayah.count({ where: { kode: kec.kode } }),
    ]);
    if (mineCount === 0 || occupied === 0) {
      await this.prisma.polriWilayah.create({ data: { unitId: polsekId, kode: kec.kode, method: 'koordinat' } });
      const unit = occupied === 0 ? await this.unitOfPolri(polsekId) : null;
      if (unit) await this.prisma.village.updateMany({ where: { kecamatanKode: kec.kode, polsekId: null }, data: { polsekId: unit.id } });
    }
    return kec.nama;
  }

  async setPolsekPoint(me: AuthUser, polsekId: string, lat: number, lng: number) {
    const polsek = await this.polsekInScope(me, polsekId);
    await this.prisma.polriUnit.update({ where: { id: polsekId }, data: { lat, lng, manual: true } });
    const kecamatan = await this.linkByPoint(polsekId, polsek.polres_id, lat, lng);
    await this.audit.log({ actorId: me.id, action: 'POLSEK_POINT_SET', entity: 'polri_unit', entityId: polsekId, meta: { lat, lng, kecamatan } });
    return { id: polsekId, lat, lng, kecamatan };
  }

  async createPolsek(me: AuthUser, dto: { polresId: string; nama: string; lat?: number; lng?: number }) {
    if ((dto.lat == null) !== (dto.lng == null)) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Isi lintang dan bujur sekaligus.' });
    const polres = await this.prisma.polriUnit.findFirst({ where: { id: dto.polresId, kind: 'POLRES' } });
    const parent = polres && await this.unitOfPolri(polres.id);
    if (!polres || !parent) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Polres tidak ditemukan.' });
    await this.units.assertInScope(me.unitId, parent.id);
    const nama = dto.nama.trim();
    const twin = await this.prisma.polriUnit.count({ where: { parentId: polres.id, name: { equals: nama, mode: 'insensitive' } } });
    if (twin) throw new ConflictException({ code: 'DUPLICATE', message: `${nama} sudah ada di ${polres.name}.` });
    const id = randomUUID();
    const kode = `SEK-${id.replace(/-/g, '').slice(-12)}`;
    await this.prisma.$transaction([
      this.prisma.polriUnit.create({ data: { id, parentId: polres.id, kind: 'POLSEK', code: kode, name: nama, lat: dto.lat, lng: dto.lng, manual: true } }),
      this.prisma.unit.create({ data: { id, parentId: parent.id, level: 'POLSEK', kode, nama, timezone: parent.timezone } }),
      this.prisma.polriUnit.update({ where: { id }, data: { unitId: id } }),
    ]);
    this.units.invalidate();
    const kecamatan = dto.lat != null ? await this.linkByPoint(id, polres.id, dto.lat, dto.lng!) : null;
    await this.audit.log({ actorId: me.id, action: 'POLSEK_CREATE', entity: 'polri_unit', entityId: id, meta: { nama, polres: polres.name, kecamatan } });
    return { id, kode, nama, kecamatan };
  }

  /** Polsek dalam cakupan admin beserta induknya; 404 bila tidak ada. */
  private async polsekInScope(me: AuthUser, polsekId: string) {
    const [polsek] = await this.prisma.$queryRaw<{ polres_id: string; polda_id: string; source: boolean }[]>`
      SELECT s.parent_id AS polres_id, res.parent_id AS polda_id,
             EXISTS (SELECT 1 FROM polri_wilayah m WHERE m.unit_id = s.id AND m.method <> 'admin') AS source
      FROM polri_units s JOIN polri_units res ON res.id = s.parent_id
      WHERE s.id = ${polsekId}::uuid AND s.kind = 'POLSEK'
        ${me.role === UserRole.SUPERADMIN ? Prisma.empty : Prisma.sql`AND coalesce(s.unit_id, s.id) IN (SELECT unit_subtree(${me.unitId}::uuid))`}`;
    if (!polsek) throw new NotFoundException({ code: 'NOT_FOUND' });
    return polsek;
  }

  /** Tetapkan kecamatan Polsek secara manual. Harus di provinsi cakupan Polda-nya; cakupan Polres ikut bertambah bila kab/kotanya baru. */
  async assignPolsekRegions(me: AuthUser, polsekId: string, kodes: string[]) {
    const polsek = await this.polsekInScope(me, polsekId);
    if (polsek.source) throw new ConflictException({ code: 'ALREADY_MAPPED', message: 'Wilayah Polsek ini berasal dari data sumber dan tidak bisa diubah di sini.' });
    const unique = [...new Set(kodes)];
    const found = await this.prisma.region.count({ where: { kode: { in: unique }, level: 3 } });
    if (found !== unique.length) throw new BadRequestException({ code: 'INVALID_KODE', message: 'Kecamatan tidak ditemukan.' });
    const provinces = [...new Set(unique.map((k) => k.slice(0, 2)))];
    const inPolda = await this.prisma.polriWilayah.count({ where: { unitId: polsek.polda_id, kode: { in: provinces } } });
    if (inPolda !== provinces.length) throw new BadRequestException({ code: 'OUTSIDE_POLDA', message: 'Kecamatan berada di luar provinsi cakupan Polda satuan ini.' });
    await this.prisma.$transaction([
      this.prisma.polriWilayah.createMany({ data: unique.map((kode) => ({ unitId: polsekId, kode, method: 'admin' })), skipDuplicates: true }),
      this.prisma.polriWilayah.createMany({ data: unique.map((k) => ({ unitId: polsek.polres_id, kode: k.slice(0, 5), method: 'via_polsek' })), skipDuplicates: true }),
    ]);
    await this.audit.log({ actorId: me.id, action: 'POLSEK_REGION_SET', entity: 'polri_unit', entityId: polsekId, meta: { kecamatanKodes: unique } });
    return { id: polsekId, kecamatanKodes: unique };
  }

  async removePolsekRegion(me: AuthUser, polsekId: string, kode: string) {
    const polsek = await this.polsekInScope(me, polsekId);
    const { count } = await this.prisma.polriWilayah.deleteMany({ where: { unitId: polsekId, kode, method: 'admin' } });
    if (!count) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Penetapan manual ini tidak ditemukan.' });
    // Cakupan turunan Polres dilepas bila tidak ada lagi Polsek-nya di kab/kota itu.
    await this.prisma.$executeRaw`
      DELETE FROM polri_wilayah p
      WHERE p.unit_id = ${polsek.polres_id}::uuid AND p.kode = ${kode.slice(0, 5)} AND p.method = 'via_polsek'
        AND NOT EXISTS (SELECT 1 FROM polri_wilayah m JOIN polri_units s ON s.id = m.unit_id
                        WHERE s.parent_id = ${polsek.polres_id}::uuid AND m.kode LIKE ${kode.slice(0, 5) + '.%'})`;
    await this.audit.log({ actorId: me.id, action: 'POLSEK_REGION_REMOVE', entity: 'polri_unit', entityId: polsekId, meta: { kode } });
    return { id: polsekId, kode };
  }

  async polsekManual(me: AuthUser) {
    return this.prisma.$queryRaw<{ id: string; nama: string; polres: string; polda: string; wilayah: { kode: string; nama: string; chain: string }[] }[]>`
      SELECT s.id, s.name AS nama, res.name AS polres, da.name AS polda,
             json_agg(json_build_object('kode', r.kode, 'nama', r.nama, 'chain', r.chain) ORDER BY r.kode) AS wilayah
      FROM polri_wilayah m
      JOIN polri_units s ON s.id = m.unit_id JOIN polri_units res ON res.id = s.parent_id JOIN polri_units da ON da.id = res.parent_id
      JOIN regions r ON r.kode = m.kode
      WHERE m.method = 'admin' ${me.role === UserRole.SUPERADMIN ? Prisma.empty : Prisma.sql`AND coalesce(s.unit_id, s.id) IN (SELECT unit_subtree(${me.unitId}::uuid))`}
      GROUP BY s.id, s.name, res.name, da.name
      ORDER BY da.name, res.name, s.name`;
  }

  /** Daftar desa untuk halaman admin: status batas wilayah, jumlah Bhabin, dan laporan 30 hari. */
  async adminList(me: AuthUser, q: { q?: string; polsekId?: string; kecamatanKode?: string; batas?: string; page: number; limit: number }) {
    if (q.polsekId) await this.units.assertInScope(me.unitId, q.polsekId);
    const scope = await this.scopeSql(me);
    const where = Prisma.sql`${scope}
      ${q.polsekId ? Prisma.sql`AND v.polsek_id = ${q.polsekId}::uuid` : Prisma.empty}
      ${q.kecamatanKode ? Prisma.sql`AND v.kecamatan_kode = ${q.kecamatanKode}` : Prisma.empty}
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
      this.prisma.$queryRaw<{ total: number; dengan_polsek: number; kecamatan_tanpa_polsek: number; tanpa_bhabin: number }[]>`
        SELECT count(*)::int AS total, count(v.polsek_id)::int AS dengan_polsek,
               count(DISTINCT v.kecamatan_kode) FILTER (WHERE NOT EXISTS (SELECT 1 FROM polri_wilayah m WHERE m.kode = v.kecamatan_kode))::int AS kecamatan_tanpa_polsek,
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
    const where = Prisma.sql`${scope} AND v.geom IS NOT NULL ${polsekId ? Prisma.sql`AND v.polsek_id = ${polsekId}::uuid` : Prisma.empty}`;
    // Cakupan nasional bisa puluhan ribu poligon (ratusan MB): kirim kosong & minta pilih Polsek.
    const [{ n }] = await this.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM villages v WHERE ${where}`;
    if (n > GEOJSON_MAX) return { type: 'FeatureCollection', features: [], total: n, truncated: true };
    const rows = await this.prisma.$queryRaw<{ id: string; nama: string; kecamatan: string; geometry: string }[]>`
      SELECT v.id, v.nama, v.kecamatan, ST_AsGeoJSON(ST_SimplifyPreserveTopology(v.geom, 0.00005), 6) AS geometry
      FROM villages v WHERE ${where}`;
    return {
      type: 'FeatureCollection',
      total: n,
      truncated: false,
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
