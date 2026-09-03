import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportRangeDto } from './dto/report-range.dto';
import { CurrentUser, CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: CurrentExhibitor, @Query() query: ReportRangeDto) {
    return this.reportsService.getSummary(user, query.from, query.to);
  }

  @Get('leads/export')
  async exportLeads(
    @CurrentUser() user: CurrentExhibitor,
    @Query() query: ReportRangeDto,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportLeadsXlsx(user, query.from, query.to);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="leads-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
