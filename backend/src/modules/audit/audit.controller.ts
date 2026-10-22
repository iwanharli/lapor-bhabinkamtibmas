import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { UnitsService } from '../units/units.service';

@Controller('audit-logs')
export class AuditController {
  constructor(private prisma: PrismaService, private units: UnitsService) {}

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.AUDITOR, UserRole.ADMIN_UNIT)
  async list(@CurrentUser() me: AuthUser, @Query('action') action?: string, @Query('page') page = '1', @Query('limit') limit = '50') {
    const take = Math.min(Number(limit) || 50, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const scope = me.role === UserRole.SUPERADMIN ? undefined : { unitId: { in: await this.units.descendantIds(me.unitId) } };
    const where = { ...(action && { action }), ...(scope && { actor: scope }) };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { at: 'desc' }, take, skip, include: { actor: { select: { nrp: true, nama: true } } } }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data: data.map((a) => ({ ...a, id: a.id.toString() })), meta: { page: Number(page), limit: take, total } };
  }
}
