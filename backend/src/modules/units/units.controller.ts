import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { TIMEZONES } from '../../common/time';
import { ALL_ROLES, AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { AggregatesService } from '../aggregates/aggregates.service';
import { UnitsService } from './units.service';

class CreateUnitDto {
  @IsUUID() parentId: string;
  @IsString() @Length(2, 32) kode: string;
  @IsString() @Length(2, 150) nama: string;
  @IsOptional() @IsIn(TIMEZONES, { message: 'Zona waktu harus Asia/Jakarta, Asia/Makassar, atau Asia/Jayapura' }) timezone?: string;
}

class TimezoneDto {
  @IsIn(TIMEZONES, { message: 'Zona waktu harus Asia/Jakarta, Asia/Makassar, atau Asia/Jayapura' }) timezone: string;
}

@Controller('units')
export class UnitsController {
  constructor(private units: UnitsService, private audit: AuditService, private aggregates: AggregatesService) {}

  @Get()
  @Roles(...ALL_ROLES)
  async list(@CurrentUser() me: AuthUser) {
    const units = await this.units.tree(me.unitId);
    const bhabin = await this.units.bhabinCounts(units.map((u) => u.id));
    return units.map(({ _count, ...u }) => ({ ...u, counts: { users: _count.users, villages: _count.villages, bhabin: bhabin.get(u.id) ?? 0 } }));
  }

  @Patch(':id/timezone')
  @HttpCode(200)
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN_UNIT)
  async setTimezone(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TimezoneDto) {
    const res = await this.units.setTimezone(me.unitId, id, dto.timezone);
    this.units.invalidate();
    // Batas hari lokal bergeser: hitung ulang agregat unit terkait di latar belakang.
    void this.aggregates.rebuild(await this.units.descendantIds(id)).catch(() => undefined);
    await this.audit.log({ actorId: me.id, action: 'UNIT_UPDATE', entity: 'unit', entityId: id, meta: { timezone: dto.timezone, updated: res.updated } });
    return res;
  }

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN_UNIT)
  async create(@CurrentUser() me: AuthUser, @Body() dto: CreateUnitDto) {
    const unit = await this.units.create(me.unitId, dto);
    await this.audit.log({ actorId: me.id, action: 'UNIT_CREATE', entity: 'unit', entityId: unit.id });
    return unit;
  }
}
