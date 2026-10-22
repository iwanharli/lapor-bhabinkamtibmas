import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { ALL_ROLES, AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { UnitsService } from './units.service';

class CreateUnitDto {
  @IsUUID() parentId: string;
  @IsString() @Length(2, 32) kode: string;
  @IsString() @Length(2, 150) nama: string;
  @IsOptional() @IsString() timezone?: string;
}

@Controller('units')
export class UnitsController {
  constructor(private units: UnitsService, private audit: AuditService) {}

  @Get()
  @Roles(...ALL_ROLES)
  async list(@CurrentUser() me: AuthUser) {
    const units = await this.units.tree(me.unitId);
    const bhabin = await this.units.bhabinCounts(units.map((u) => u.id));
    return units.map(({ _count, ...u }) => ({ ...u, counts: { users: _count.users, villages: _count.villages, bhabin: bhabin.get(u.id) ?? 0 } }));
  }

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN_UNIT)
  async create(@CurrentUser() me: AuthUser, @Body() dto: CreateUnitDto) {
    const unit = await this.units.create(me.unitId, dto);
    await this.audit.log({ actorId: me.id, action: 'UNIT_CREATE', entity: 'unit', entityId: unit.id });
    return unit;
  }
}
