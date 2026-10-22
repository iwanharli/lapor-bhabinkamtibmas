import { Controller, HttpCode, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { AggregatesService } from './aggregates.service';

@Controller('admin/aggregates')
@Roles(UserRole.SUPERADMIN)
export class AggregatesController {
  constructor(private aggregates: AggregatesService, private audit: AuditService) {}

  /** Bangun ulang seluruh agregat analitik (mis. setelah impor data besar). */
  @Post('rebuild')
  @HttpCode(200)
  async rebuild(@CurrentUser() me: AuthUser) {
    const pairs = await this.aggregates.rebuild();
    await this.audit.log({ actorId: me.id, action: 'AGGREGATES_REBUILD', meta: { pairs } });
    return { pairs };
  }
}
