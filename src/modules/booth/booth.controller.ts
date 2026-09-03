import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BoothService } from './booth.service';
import { ScanLeadDto } from './dto/scan-lead.dto';
import { ManualLeadDto } from './dto/manual-lead.dto';
import { UpdateLeadNotesDto } from './dto/update-lead-notes.dto';
import { CurrentUser, CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

@ApiTags('My Booth')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('booth')
export class BoothController {
  constructor(private readonly boothService: BoothService) {}

  @Get('leads')
  @ApiQuery({ name: 'temperature', enum: ['Hot', 'Warm', 'Cold'], required: false })
  @ApiQuery({ name: 'today', required: false, type: Boolean })
  listLeads(
    @CurrentUser() user: CurrentExhibitor,
    @Query('temperature') temperature?: 'Hot' | 'Warm' | 'Cold',
    @Query('today') today?: string,
  ) {
    return this.boothService.listLeads(user, temperature, today === 'true');
  }

  // Scan QR visitor - input token, sistem resolve ke detail visitor.
  @Post('leads/scan')
  scan(@CurrentUser() user: CurrentExhibitor, @Body() dto: ScanLeadDto) {
    return this.boothService.scan(user, dto);
  }

  // Input manual bebas ketik - belum tentu visitor terdaftar.
  @Post('leads/manual')
  addManual(@CurrentUser() user: CurrentExhibitor, @Body() dto: ManualLeadDto) {
    return this.boothService.addManual(user, dto);
  }

  // Isi/edit notes - cuma untuk lead yang sudah confirmed (punya id asli).
  @Patch('leads/:leadId/notes')
  updateNotes(
    @CurrentUser() user: CurrentExhibitor,
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: UpdateLeadNotesDto,
  ) {
    return this.boothService.updateNotes(user, leadId, dto);
  }
}
