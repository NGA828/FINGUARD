import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../common/guards';
import { NotificationsService } from './notifications.service';

/** Notifications — accessible à tous les rôles authentifiés, limité à l'utilisateur courant. */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return {
      items: this.notifications.forUser(user.sub),
      unreadCount: this.notifications.unreadCount(user.sub),
    };
  }

  @Get('unread-count')
  unread(@CurrentUser() user: any) {
    return { unreadCount: this.notifications.unreadCount(user.sub) };
  }

  @Post(':id/read')
  read(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notifications.markRead(user.sub, id);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: any) {
    return this.notifications.markAllRead(user.sub);
  }
}
