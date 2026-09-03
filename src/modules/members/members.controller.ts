import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MembersService } from './members.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { CurrentUser, CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';
import { OwnerGuard } from '../../common/guards/owner.guard';

@ApiTags('User Management')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  // Semua member (staff + owner) boleh lihat daftar anggota.
  @Get()
  list(@CurrentUser() user: CurrentExhibitor) {
    return this.membersService.listMembers(user);
  }

  // Di bawah ini cuma pemilik booth (isOwner) yang boleh.
  @Post('invite')
  @UseGuards(OwnerGuard)
  invite(@CurrentUser() user: CurrentExhibitor, @Body() dto: InviteMemberDto) {
    return this.membersService.invite(user, dto);
  }

  @Post(':exhibitorId/remove')
  @UseGuards(OwnerGuard)
  remove(
    @CurrentUser() user: CurrentExhibitor,
    @Param('exhibitorId', ParseIntPipe) exhibitorId: number,
  ) {
    return this.membersService.remove(user, exhibitorId);
  }

  @Post(':exhibitorId/restore')
  @UseGuards(OwnerGuard)
  restore(
    @CurrentUser() user: CurrentExhibitor,
    @Param('exhibitorId', ParseIntPipe) exhibitorId: number,
  ) {
    return this.membersService.restore(user, exhibitorId);
  }

  @Patch(':exhibitorId/permission')
  @UseGuards(OwnerGuard)
  updatePermission(
    @CurrentUser() user: CurrentExhibitor,
    @Param('exhibitorId', ParseIntPipe) exhibitorId: number,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.membersService.updatePermission(user, exhibitorId, dto);
  }
}
