import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ALL_ROLES, AuthUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  /** GET /notifications?unread=true&page=&limit= */
  @Get()
  @Roles(...ALL_ROLES)
  list(@CurrentUser() me: AuthUser, @Query() q: { unread?: string; page?: string; limit?: string }) {
    return this.notifications.list(me, {
      unread: q.unread === 'true', page: Math.max(Number(q.page) || 1, 1), limit: Math.min(Number(q.limit) || 20, 100),
    });
  }

  @Get('unread-count')
  @Roles(...ALL_ROLES)
  async unread(@CurrentUser() me: AuthUser) {
    return { unread: await this.notifications.unreadCount(me) };
  }

  @Post('read-all')
  @HttpCode(200)
  @Roles(...ALL_ROLES)
  readAll(@CurrentUser() me: AuthUser) {
    return this.notifications.markAllRead(me);
  }

  @Post(':id/read')
  @HttpCode(200)
  @Roles(...ALL_ROLES)
  read(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(me, id);
  }
}
