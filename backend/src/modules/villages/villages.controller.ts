import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { ALL_ROLES, AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { VillagesService } from './villages.service';

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
