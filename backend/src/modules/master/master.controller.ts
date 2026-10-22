import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { ALL_ROLES, AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

class UpdateCommodityDto {
  @IsOptional() @IsString() nama?: string;
  @IsOptional() @IsString() satuanDefault?: string;
  @IsOptional() @IsInt() urutan?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Controller()
export class MasterController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  @Get('commodities')
  @Roles(...ALL_ROLES)
  commodities() {
    return this.prisma.commodity.findMany({ where: { active: true }, orderBy: { urutan: 'asc' } });
  }

  @Patch('admin/commodities/:id')
  @Roles(UserRole.SUPERADMIN)
  async update(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCommodityDto) {
    const c = await this.prisma.commodity.update({ where: { id }, data: dto });
    await this.audit.log({ actorId: me.id, action: 'COMMODITY_UPDATE', entity: 'commodity', entityId: String(id) });
    return c;
  }
}
