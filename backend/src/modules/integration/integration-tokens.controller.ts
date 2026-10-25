import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { IntegrationTokensService } from './integration-tokens.service';

class CreateTokenDto {
  @IsUUID() userId: string;
  @IsString() @Length(2, 120) nama: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(50, { each: true }) allowedIps?: string[];
}

class UpdateTokenDto {
  @IsOptional() @IsString() @Length(2, 120) nama?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(50, { each: true }) allowedIps?: string[];
}

/** Token integrasi Command Center Pusat — hanya superadmin (token membuka data seluruh instance). */
@Controller('admin/integration-tokens')
@Roles(UserRole.SUPERADMIN)
export class IntegrationTokensController {
  constructor(private tokens: IntegrationTokensService) {}

  @Get()
  list() {
    return this.tokens.list();
  }

  @Post()
  create(@CurrentUser() me: AuthUser, @Body() dto: CreateTokenDto) {
    return this.tokens.create(me.id, dto);
  }

  @Patch(':id')
  @HttpCode(204)
  update(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTokenDto) {
    return this.tokens.update(me.id, id, dto);
  }

  @Post(':id/reveal')
  @HttpCode(200)
  reveal(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tokens.reveal(me.id, id);
  }

  @Post(':id/revoke')
  @HttpCode(204)
  async revoke(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.tokens.revoke(me.id, id);
  }
}
