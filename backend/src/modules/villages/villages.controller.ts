import { Body, Controller, Get, HttpCode, Param, Patch, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsBoolean, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { ALL_ROLES, AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { GeoFeature, VillagesService } from './villages.service';

class UpdateVillageDto {
  @IsOptional() @IsString() @Length(2, 120) nama?: string;
  @IsOptional() @IsString() kecamatan?: string;
  @IsOptional() @IsString() kabupaten?: string;
  @IsOptional() @IsString() provinsi?: string;
  @IsOptional() @IsUUID() polsekId?: string;
}

class ImportGeojsonDto {
  @IsUUID() polsekId: string;
  @IsArray() features: GeoFeature[];
  @IsOptional() @IsBoolean() dryRun?: boolean;
}

class AssignVillagesDto {
  @IsUUID() polsekId: string;
  @IsArray() @ArrayMaxSize(1000) @IsUUID('all', { each: true }) villageIds: string[];
}

class CreateVillageDto {
  @IsString() @Length(10, 13) kodeWilayah: string;
  @IsString() nama: string;
  @IsString() kecamatan: string;
  @IsString() kabupaten: string;
  @IsString() provinsi: string;
  @IsOptional() @IsUUID() polsekId?: string;
}

class GeometryDto {
  /** GeoJSON Polygon atau MultiPolygon (EPSG:4326). */
  @IsObject() geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
}

@Controller()
export class VillagesController {
  constructor(private villages: VillagesService) {}

  @Get('villages')
  @Roles(...ALL_ROLES)
  list(@CurrentUser() me: AuthUser, @Query('q') q?: string) {
    return this.villages.list(me, q);
  }

  @Get('admin/villages')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN_UNIT)
  adminList(@CurrentUser() me: AuthUser, @Query() q: { q?: string; polsekId?: string; batas?: string; page?: string; limit?: string }) {
    return this.villages.adminList(me, {
      q: q.q || undefined, polsekId: q.polsekId || undefined, batas: q.batas,
      page: Math.max(Number(q.page) || 1, 1), limit: Math.min(Number(q.limit) || 20, 100),
    });
  }

  /** Desa dalam satu kecamatan Kemendagri untuk ditetapkan ke Polsek. */
  @Get('admin/villages/by-kecamatan/:kode')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN_UNIT)
  byKecamatan(@CurrentUser() me: AuthUser, @Param('kode') kode: string) {
    return this.villages.byKecamatan(me, kode);
  }

  @Post('admin/villages/assign')
  @HttpCode(200)
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN_UNIT)
  assign(@CurrentUser() me: AuthUser, @Body() dto: AssignVillagesDto) {
    return this.villages.assign(me, dto);
  }

  @Get('villages/geojson')
  @Roles(UserRole.VERIFIKATOR, UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR)
  geojson(@CurrentUser() me: AuthUser, @Query('polsekId') polsekId?: string) {
    return this.villages.geojson(me, polsekId || undefined);
  }

  @Post('admin/villages/import')
  @HttpCode(200)
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN_UNIT)
  importGeojson(@CurrentUser() me: AuthUser, @Body() dto: ImportGeojsonDto) {
    return this.villages.importGeojson(me, dto);
  }

  @Patch('admin/villages/:id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN_UNIT)
  update(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVillageDto) {
    return this.villages.update(me, id, dto);
  }

  @Post('admin/villages')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN_UNIT)
  create(@CurrentUser() me: AuthUser, @Body() dto: CreateVillageDto) {
    return this.villages.create(me, dto);
  }

  @Put('admin/villages/:id/geometry')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN_UNIT)
  setGeometry(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GeometryDto) {
    return this.villages.setGeometry(me, id, dto.geometry);
  }
}
