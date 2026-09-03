import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { EventsMeetingV2 } from './entities/events-meeting-v2.entity';
import { MeetingMemberV2 } from './entities/meeting-member-v2.entity';
import { ExhibitorMeetingAction } from './entities/exhibitor-meeting-action.entity';
import { GuestsTicket } from '../guests/entities/guests-ticket.entity';
import { ExhibitorHaveCompany } from '../exhibitors/entities/exhibitor-have-company.entity';
import { ExhibitorContact } from '../exhibitors/entities/exhibitor-contact.entity';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventsMeetingV2,
      MeetingMemberV2,
      ExhibitorMeetingAction,
      GuestsTicket,
      ExhibitorHaveCompany,
      ExhibitorContact,
      ExhibitorCompany,
    ]),
    PassportModule,
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
