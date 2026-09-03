import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import { MeetingActionDto } from './dto/meeting-action.dto';
import { CurrentUser, CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

@ApiTags('Meeting')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false, description: 'PE (pending) / AP (approved) / CL (cancelled)' })
  list(@CurrentUser() user: CurrentExhibitor, @Query('status') status?: string) {
    return this.meetingsService.list(user, status);
  }

  @Get(':meetingId')
  detail(
    @CurrentUser() user: CurrentExhibitor,
    @Param('meetingId', ParseIntPipe) meetingId: number,
  ) {
    return this.meetingsService.detail(user, meetingId);
  }

  @Post(':meetingId/approve')
  approve(
    @CurrentUser() user: CurrentExhibitor,
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Body() dto: MeetingActionDto,
  ) {
    return this.meetingsService.approve(user, meetingId, dto);
  }

  @Post(':meetingId/reject')
  reject(
    @CurrentUser() user: CurrentExhibitor,
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Body() dto: MeetingActionDto,
  ) {
    return this.meetingsService.reject(user, meetingId, dto);
  }
}
