import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { UnitLevel, UserRole } from '@prisma/client';
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

  /** GET /units/search?q=&level=POLSEK,POLRES&ids=&limit= — kolom pencarian unit. */
  @Get('search')
  @Roles(...ALL_ROLES)
  search(@CurrentUser() me: AuthUser, @Query() q: { q?: string; level?: string; ids?: string; limit?: string }) {
    const levels = q.level?.split(',').filter((l): l is UnitLevel => l in UnitLevel);
    const ids = q.ids?.split(',').filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    return this.units.search(me.unitId, { q: q.q, levels, ids, limit: Number(q.limit) || 20 });
  }

  /** GET /units/children?parentId= — anak langsung (tanpa parentId: unit akar pengguna). */
  @Get('children')
  @Roles(...ALL_ROLES)
  children(@CurrentUser() me: AuthUser, @Query('parentId') parentId?: string) {
    if (parentId && !/^[0-9a-f-]{36}$/i.test(parentId)) return [];
    return this.units.children(me.unitId, parentId || undefined);
  }

  /** GET /units/bounds?unitId= — kotak batas wilayah unit (w,s,e,n) untuk fokus awal peta; null = seluruh Indonesia. */
  @Get('bounds')
  @Roles(...ALL_ROLES)
  async bounds(@CurrentUser() me: AuthUser, @Query('unitId') unitId?: string) {
    if (unitId && !/^[0-9a-f-]{36}$/i.test(unitId)) return { bbox: null };
    if (unitId) await this.units.assertInScope(me.unitId, unitId);
    return { bbox: await this.units.bounds(unitId || me.unitId) };
  }

  /** GET /units/summary — ringkasan cakupan untuk halaman Unit. */
  @Get('summary')
  @Roles(...ALL_ROLES)
  summary(@CurrentUser() me: AuthUser) {
    return this.units.summary(me.unitId);
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
