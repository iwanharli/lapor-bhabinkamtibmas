import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentSource, UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AttachmentsService, MAX_UPLOAD_BYTES } from './attachments.service';

class UploadDto {
  @IsString() @Length(1, 64) fieldKey: string;
  @IsOptional() @IsUUID() clientUuid?: string;
  @IsOptional() @IsDateString() capturedAt?: string;
  @IsOptional() @IsEnum(AttachmentSource) source?: AttachmentSource;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() watermarked?: boolean;
  @IsOptional() @Matches(/^[a-f0-9]{64}$/) sha256?: string;
}

const VIEWERS = [UserRole.BHABIN, UserRole.VERIFIKATOR, UserRole.PIMPINAN, UserRole.ADMIN_UNIT, UserRole.SUPERADMIN, UserRole.AUDITOR];

@Controller()
export class AttachmentsController {
  constructor(private attachments: AttachmentsService) {}

  @Post('reports/:id/attachments')
  @Roles(UserRole.BHABIN)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File, @Body() dto: UploadDto) {
    return this.attachments.upload(me, id, file, dto);
  }

  @Get('attachments/:id/file')
  @Roles(...VIEWERS)
  async file(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('thumb') thumb: string | undefined, @Res() res: Response) {
    const f = await this.attachments.open(me, id, thumb === '1');
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', `inline; filename="${f.name}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    f.stream.pipe(res);
  }
}
