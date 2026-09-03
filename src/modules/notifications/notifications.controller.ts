import { Controller, Get, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser, CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: CurrentExhibitor) {
    return this.notificationsService.list(user);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: CurrentExhibitor) {
    return this.notificationsService.unreadCount(user);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: CurrentExhibitor, @Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.markRead(user, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: CurrentExhibitor) {
    return this.notificationsService.markAllRead(user);
  }
}
