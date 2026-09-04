import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MeetingsService, MeetingTabType } from './meetings.service';
import { ApproveMeetingDto } from './dto/approve-meeting.dto';
import { RejectMeetingDto } from './dto/reject-meeting.dto';
import { RescheduleMeetingDto } from './dto/reschedule-meeting.dto';
import { CurrentUser, CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

@ApiTags('Meeting')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  // Dua tab terpisah di UI: 'visitor' (E2V/V2E) dan 'exhibitor' (E2E).
  @Get()
  @ApiQuery({ name: 'type', enum: ['visitor', 'exhibitor'], required: true })
  @ApiQuery({ name: 'status', required: false, description: 'PE (pending) / AP (approved) / CL (cancelled)' })
  list(
    @CurrentUser() user: CurrentExhibitor,
    @Query('type') type: MeetingTabType,
    @Query('status') status?: string,
  ) {
    return this.meetingsService.list(user, type, status);
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
    @Body() dto: ApproveMeetingDto,
  ) {
    return this.meetingsService.approve(user, meetingId, dto);
  }

  @Post(':meetingId/reject')
  reject(
    @CurrentUser() user: CurrentExhibitor,
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Body() dto: RejectMeetingDto,
  ) {
    return this.meetingsService.reject(user, meetingId, dto);
  }

  // Reschedule - cuma untuk meeting yang sudah approved.
  @Post(':meetingId/reschedule')
  reschedule(
    @CurrentUser() user: CurrentExhibitor,
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Body() dto: RescheduleMeetingDto,
  ) {
    return this.meetingsService.reschedule(user, meetingId, dto);
  }
}
