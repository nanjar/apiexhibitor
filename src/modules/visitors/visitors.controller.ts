import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { VisitorsService } from './visitors.service';
import { CurrentUser, CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

@ApiTags('Visitors')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('visitors')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  // Directory/browse semua visitor event ini - buat exhibitor cari calon
  // lead sebelum scan. Beda dari booth/leads (cuma yang sudah di-scan).
  @Get()
  @ApiQuery({ name: 'search', required: false, description: 'Cari by nama atau company' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(
    @CurrentUser() user: CurrentExhibitor,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.visitorsService.list(user, search, page, limit);
  }
}
