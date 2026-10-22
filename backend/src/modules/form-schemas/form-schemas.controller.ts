import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ALL_ROLES, AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Controller()
export class FormSchemasController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** Skema aktif untuk dirender aplikasi mobile & dashboard. */
  @Get('form-schemas')
  @Roles(...ALL_ROLES)
  active() {
    return this.prisma.formSchema.findMany({ where: { status: 'ACTIVE' }, orderBy: [{ category: 'asc' }, { version: 'desc' }] });
  }

  @Get('admin/form-schemas')
  @Roles(UserRole.SUPERADMIN)
  all() {
    return this.prisma.formSchema.findMany({ orderBy: [{ category: 'asc' }, { version: 'desc' }] });
  }

  @Post('admin/form-schemas/:id/retire')
  @Roles(UserRole.SUPERADMIN)
  async retire(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) {
    const s = await this.prisma.formSchema.update({ where: { id }, data: { status: 'RETIRED' } });
    await this.audit.log({ actorId: me.id, action: 'SCHEMA_RETIRE', entity: 'form_schema', entityId: String(id) });
    return s;
  }
}
