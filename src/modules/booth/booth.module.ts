import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ExhibitorLeadSync } from './entities/exhibitor-lead-sync.entity';
import { ExhibitorLeadAction } from './entities/exhibitor-lead-action.entity';
import { GuestsTicket } from '../guests/entities/guests-ticket.entity';
import { MeetingMemberV2 } from '../meetings/entities/meeting-member-v2.entity';
import { EventsMeetingV2 } from '../meetings/entities/events-meeting-v2.entity';
import { ExhibitorHaveCompany } from '../exhibitors/entities/exhibitor-have-company.entity';
import { BoothController } from './booth.controller';
import { BoothService } from './booth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExhibitorLeadSync,
      ExhibitorLeadAction,
      GuestsTicket,
      MeetingMemberV2,
      EventsMeetingV2,
      ExhibitorHaveCompany,
    ]),
    PassportModule,
  ],
  controllers: [BoothController],
  providers: [BoothService],
})
export class BoothModule {}
