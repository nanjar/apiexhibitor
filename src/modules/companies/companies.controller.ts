import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { CurrentUser, CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

@ApiTags('Companies')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // Directory company exhibitor LAIN di event ini (company sendiri
  // dikecualikan) - buat cari calon business matching partner.
  @Get()
  list(@CurrentUser() user: CurrentExhibitor, @Query() query: ListCompaniesQueryDto) {
    return this.companiesService.list(user, query);
  }

  @Get(':id')
  getDetail(@CurrentUser() user: CurrentExhibitor, @Param('id', ParseIntPipe) id: number) {
    return this.companiesService.getDetail(user, id);
  }
}
