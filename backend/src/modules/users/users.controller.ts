import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { CreateUserDto, ImportUsersDto, SetVillagesDto, UpdateUserDto } from './dto/user.dto';
import { UsersImportService } from './users-import.service';
import { UsersService } from './users.service';

const parseActive = (v?: string) => (v === 'true' ? true : v === 'false' ? false : undefined);

@Controller('admin/users')
@Roles(UserRole.SUPERADMIN, UserRole.ADMIN_UNIT)
export class UsersController {
  constructor(private users: UsersService, private importer: UsersImportService) {}

  @Get()
  list(
    @CurrentUser() me: AuthUser,
    @Query('q') q?: string,
    @Query('role') role?: UserRole,
    @Query('active') active?: string,
    @Query('unitId') unitId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.users.list(me, { q, role, active: parseActive(active), unitId: unitId || undefined, page: Math.max(Number(page) || 1, 1), limit: Math.min(Number(limit) || 20, 100) });
  }

  /** Impor massal: `dryRun: true` untuk pratinjau & validasi, tanpa menyimpan. */
  @Post('import')
  @HttpCode(200)
  import(@CurrentUser() me: AuthUser, @Body() dto: ImportUsersDto) {
    return dto.dryRun ? this.importer.preview(me, dto.rows) : this.importer.commit(me, dto.rows);
  }

  // Sebelum ':id' agar tidak tertangkap sebagai id.
  @Get('role-counts')
  roleCounts(@CurrentUser() me: AuthUser, @Query('q') q?: string, @Query('active') active?: string, @Query('unitId') unitId?: string) {
    return this.users.roleCounts(me, { q, active: parseActive(active), unitId: unitId || undefined });
  }

  @Get(':id')
  get(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(me, id);
  }

  @Post()
  create(@CurrentUser() me: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(me, dto);
  }

  @Patch(':id')
  update(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(me, id, dto);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  resetPassword(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.resetPassword(me, id);
  }

  @Put(':id/villages')
  setVillages(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetVillagesDto) {
    return this.users.setVillages(me, id, dto.villageIds);
  }

  @Get(':id/devices')
  devices(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.listDevices(me, id);
  }

  @Delete(':id/devices/:deviceId')
  @HttpCode(204)
  revokeDevice(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('deviceId', ParseUUIDPipe) deviceId: string) {
    return this.users.revokeDevice(me, id, deviceId);
  }
}
