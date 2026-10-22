import { ForbiddenException, Injectable } from '@nestjs/common';
import { UnitLevel } from '@prisma/client';
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

  /** Jumlah Bhabin aktif per unit (langsung, bukan termasuk turunan). */
  async bhabinCounts(unitIds: string[]) {
    const rows = await this.prisma.user.groupBy({ by: ['unitId'], where: { unitId: { in: unitIds }, role: 'BHABIN', active: true }, _count: { _all: true } });
    return new Map(rows.map((r) => [r.unitId, r._count._all]));
  }

  async create(actorUnitId: string, dto: { parentId: string; kode: string; nama: string; timezone?: string }) {
    await this.assertInScope(actorUnitId, dto.parentId);
    const parent = await this.prisma.unit.findUniqueOrThrow({ where: { id: dto.parentId } });
    const level = CHILD_LEVEL[parent.level];
    if (!level) throw new ForbiddenException({ code: 'INVALID_PARENT', message: 'Polsek tidak dapat memiliki unit turunan' });
    const unit = await this.prisma.unit.create({ data: { ...dto, level } });
    this.invalidate();
    return unit;
  }
}
