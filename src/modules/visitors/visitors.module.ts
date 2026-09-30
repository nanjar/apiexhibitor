import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { GuestsTicket } from '../guests/entities/guests-ticket.entity';
import { ExhibitorLeadSync } from '../booth/entities/exhibitor-lead-sync.entity';
import { ExhibitorLeadAction } from '../booth/entities/exhibitor-lead-action.entity';
import { BizmatchGuestsV2 } from './entities/bizmatch-guests-v2.entity';
import { VisitorsController } from './visitors.controller';
import { VisitorsService } from './visitors.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GuestsTicket,
      ExhibitorLeadSync,
      ExhibitorLeadAction,
      BizmatchGuestsV2,
    ]),
    PassportModule,
  ],
  controllers: [VisitorsController],
  providers: [VisitorsService],
})
export class VisitorsModule {}
