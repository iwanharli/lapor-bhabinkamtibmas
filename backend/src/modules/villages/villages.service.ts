import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
}
