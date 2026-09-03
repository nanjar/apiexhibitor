import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AgendaService } from './agenda.service';
import { CurrentUser, CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

@ApiTags('Agenda')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('agenda')
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Get()
  getAgenda(@CurrentUser() user: CurrentExhibitor) {
    return this.agendaService.getAgenda(user);
  }
}
