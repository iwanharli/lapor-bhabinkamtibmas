import { Controller, Get, Query } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { UnitsService } from '../units/units.service';

interface AuditQuery {
  action?: string;
  entity?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}

@Controller('audit-logs')
@Roles(UserRole.SUPERADMIN, UserRole.AUDITOR, UserRole.ADMIN_UNIT)
export class AuditController {
  constructor(private prisma: PrismaService, private units: UnitsService) {}

  /** Selain superadmin, hanya aktivitas pelaku di unit & turunannya (dan kejadian tanpa pelaku dikecualikan). */
  private async scope(me: AuthUser): Promise<Prisma.AuditLogWhereInput> {
    if (me.role === UserRole.SUPERADMIN) return {};
    return { actor: { unitId: { in: await this.units.descendantIds(me.unitId) } } };
  }

  @Get()
  async list(@CurrentUser() me: AuthUser, @Query() q: AuditQuery) {
    const take = Math.min(Number(q.limit) || 20, 100);
    const page = Math.max(Number(q.page) || 1, 1);
    const where: Prisma.AuditLogWhereInput = {
      AND: [
        await this.scope(me),
        {
          ...(q.action && { action: q.action }),
          ...(q.entity && { entity: q.entity }),
          ...((q.from || q.to) && { at: { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: new Date(q.to) }) } }),
          ...(q.q && {
            OR: [
              { actor: { nama: { contains: q.q, mode: 'insensitive' } } },
              { actor: { nrp: { contains: q.q } } },
              { entityId: { contains: q.q } },
            ],
          }),
        },
      ],
    };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { at: 'desc' },
        take,
        skip: (page - 1) * take,
        include: { actor: { select: { id: true, nrp: true, nama: true, pangkat: true, role: true, unit: { select: { nama: true } } } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data: data.map((a) => ({ ...a, id: a.id.toString() })), meta: { page, limit: take, total } };
  }

  /** Daftar aksi yang pernah tercatat (untuk pilihan filter) beserta jumlahnya. */
  @Get('actions')
  async actions(@CurrentUser() me: AuthUser) {
    const rows = await this.prisma.auditLog.groupBy({ by: ['action'], where: await this.scope(me), _count: { _all: true }, orderBy: { action: 'asc' } });
    return rows.map((r) => ({ action: r.action, count: r._count._all }));
  }
}
