import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, UnitLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const CHILD_LEVEL: Record<UnitLevel, UnitLevel | null> = {
  MABES: UnitLevel.POLDA,
  POLDA: UnitLevel.POLRES,
  POLRES: UnitLevel.POLSEK,
  POLSEK: null,
};

@Injectable()
export class UnitsService {
  private cache = new Map<string, { ids: string[]; exp: number }>();

  constructor(private prisma: PrismaService) {}

  /** ID unit beserta seluruh turunannya — dasar pembatasan cakupan wilayah. */
  async descendantIds(unitId: string): Promise<string[]> {
    const hit = this.cache.get(unitId);
    if (hit && hit.exp > Date.now()) return hit.ids;

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE tree AS (
        SELECT id FROM units WHERE id = ${unitId}::uuid AND deleted_at IS NULL
        UNION ALL
        SELECT u.id FROM units u JOIN tree t ON u.parent_id = t.id WHERE u.deleted_at IS NULL
      )
      SELECT id::text FROM tree`;
    const ids = rows.map((r) => r.id);
    this.cache.set(unitId, { ids, exp: Date.now() + 10 * 60_000 });
    return ids;
  }

  async assertInScope(actorUnitId: string, targetUnitId: string) {
    if (!(await this.descendantIds(actorUnitId)).includes(targetUnitId)) {
      throw new ForbiddenException({ code: 'OUT_OF_SCOPE' });
    }
  }

  invalidate() {
    this.cache.clear();
  }

  async tree(rootId: string) {
    const ids = await this.descendantIds(rootId);
    return this.prisma.unit.findMany({
      where: { id: { in: ids } },
      orderBy: [{ level: 'asc' }, { nama: 'asc' }],
      include: { _count: { select: { users: { where: { active: true } }, villages: true } } },
    });
  }

  /**
   * Cari unit dalam cakupan berdasarkan nama/kode (untuk kolom pencarian unit),
   * atau ambil unit tertentu lewat `ids` (label nilai terpilih). `path` = rantai nama induk.
   */
  async search(actorUnitId: string, opts: { q?: string; levels?: UnitLevel[]; ids?: string[]; limit?: number }) {
    const scope = await this.descendantIds(actorUnitId);
    const ids = opts.ids?.filter((id) => scope.includes(id));
    if (opts.ids && !ids?.length) return [];
    const q = opts.q?.trim();
    return this.prisma.$queryRaw<{ id: string; parentId: string | null; level: UnitLevel; kode: string; nama: string; timezone: string; path: string }[]>`
      SELECT u.id::text, u.parent_id::text AS "parentId", u.level, u.kode, u.nama, u.timezone,
             concat_ws(' › ', p3.nama, p2.nama, p1.nama) AS path
      FROM units u
      LEFT JOIN units p1 ON p1.id = u.parent_id
      LEFT JOIN units p2 ON p2.id = p1.parent_id
      LEFT JOIN units p3 ON p3.id = p2.parent_id
      WHERE u.deleted_at IS NULL AND u.id = ANY(${ids ?? scope}::uuid[])
        ${opts.levels?.length ? Prisma.sql`AND u.level::text = ANY(${opts.levels}::text[])` : Prisma.empty}
        ${q ? Prisma.sql`AND (u.nama ILIKE ${'%' + q + '%'} OR u.kode ILIKE ${q + '%'})` : Prisma.empty}
      ORDER BY (u.nama ILIKE ${(q ?? '') + '%'}) DESC, u.level, u.nama
      LIMIT ${Math.min(opts.limit ?? 20, 100)}`;
  }

  /** Anak langsung satu unit (atau unit akar pengguna) beserta jumlah — untuk pohon unit bertahap. */
  async children(actorUnitId: string, parentId?: string) {
    if (parentId) await this.assertInScope(actorUnitId, parentId);
    const rows = await this.prisma.unit.findMany({
      where: parentId ? { parentId, deletedAt: null } : { id: actorUnitId },
      orderBy: { nama: 'asc' },
      include: { _count: { select: { users: { where: { active: true } }, villages: true, children: { where: { deletedAt: null } } } } },
    });
    const bhabin = await this.bhabinCounts(rows.map((u) => u.id));
    return rows.map(({ _count, ...u }) => ({
      ...u,
      childCount: _count.children,
      counts: { users: _count.users, villages: _count.villages, bhabin: bhabin.get(u.id) ?? 0 },
    }));
  }

  /** Ringkasan seluruh cakupan: jumlah unit per level, personel, Bhabin, desa, Polsek tanpa Bhabin. */
  async summary(actorUnitId: string) {
    const scope = await this.descendantIds(actorUnitId);
    const [row] = await this.prisma.$queryRaw<
      { polda: number; polres: number; polsek: number; users: number; bhabin: number; villages: number; polsek_tanpa_bhabin: number }[]
    >`
      SELECT count(*) FILTER (WHERE u.level = 'POLDA')::int AS polda,
             count(*) FILTER (WHERE u.level = 'POLRES')::int AS polres,
             count(*) FILTER (WHERE u.level = 'POLSEK')::int AS polsek,
             (SELECT count(*) FROM users x WHERE x.unit_id = ANY(${scope}::uuid[]) AND x.active)::int AS users,
             (SELECT count(*) FROM users x WHERE x.unit_id = ANY(${scope}::uuid[]) AND x.active AND x.role = 'BHABIN')::int AS bhabin,
             (SELECT count(*) FROM villages v WHERE v.polsek_id = ANY(${scope}::uuid[]))::int AS villages,
             count(*) FILTER (WHERE u.level = 'POLSEK' AND NOT EXISTS (
               SELECT 1 FROM users x WHERE x.unit_id = u.id AND x.active AND x.role = 'BHABIN'))::int AS polsek_tanpa_bhabin
      FROM units u WHERE u.id = ANY(${scope}::uuid[]) AND u.deleted_at IS NULL`;
    return row;
  }

  /** Jumlah Bhabin aktif per unit (langsung, bukan termasuk turunan). */
  async bhabinCounts(unitIds: string[]) {
    const rows = await this.prisma.user.groupBy({ by: ['unitId'], where: { unitId: { in: unitIds }, role: 'BHABIN', active: true }, _count: { _all: true } });
    return new Map(rows.map((r) => [r.unitId, r._count._all]));
  }

  /** Zona waktu unit pengguna (untuk penanggalan lokal). */
  /** Batas desa-desa di bawah unit (w,s,e,n); null untuk tingkat nasional atau bila belum ada geometri desa. */
  async bounds(unitId: string): Promise<[number, number, number, number] | null> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId }, select: { parentId: true } });
    if (!unit?.parentId) return null;
    const [r] = await this.prisma.$queryRaw<{ w: number | null; s: number; e: number; n: number }[]>`
      SELECT ST_XMin(x.e) AS w, ST_YMin(x.e) AS s, ST_XMax(x.e) AS e, ST_YMax(x.e) AS n
      FROM (SELECT ST_Extent(geom) AS e FROM villages WHERE polsek_id IN (SELECT unit_subtree(${unitId}::uuid))) x`;
    return r?.w == null ? null : [r.w, r.s, r.e, r.n];
  }

  async timezoneOf(unitId: string) {
    return (await this.prisma.unit.findUnique({ where: { id: unitId }, select: { timezone: true } }))?.timezone ?? 'Asia/Jakarta';
  }

  /** Ubah zona waktu; turunan yang memakai zona lama ikut berubah. */
  async setTimezone(actorUnitId: string, id: string, timezone: string) {
    await this.assertInScope(actorUnitId, id);
    const unit = await this.prisma.unit.findUniqueOrThrow({ where: { id } });
    const ids = await this.descendantIds(id);
    const res = await this.prisma.unit.updateMany({ where: { id: { in: ids }, OR: [{ id }, { timezone: unit.timezone }] }, data: { timezone } });
    return { updated: res.count };
  }

  async create(actorUnitId: string, dto: { parentId: string; kode: string; nama: string; timezone?: string }) {
    await this.assertInScope(actorUnitId, dto.parentId);
    const parent = await this.prisma.unit.findUniqueOrThrow({ where: { id: dto.parentId } });
    const level = CHILD_LEVEL[parent.level];
    if (!level) throw new ForbiddenException({ code: 'INVALID_PARENT', message: 'Polsek tidak dapat memiliki unit turunan' });
    // Tanpa zona eksplisit, unit baru mewarisi zona waktu induknya.
    const unit = await this.prisma.unit.create({ data: { ...dto, level, timezone: dto.timezone ?? parent.timezone } });
    this.invalidate();
    return unit;
  }
}
