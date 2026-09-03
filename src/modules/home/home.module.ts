import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { ExhcompanySpace } from '../venue/entities/exhcompany-space.entity';
import { VenueSpace } from '../venue/entities/venue-space.entity';
import { CheckinBooth } from '../booth/entities/checkin-booth.entity';
import { EventsMeetingV2 } from '../meetings/entities/events-meeting-v2.entity';
import { MeetingMemberV2 } from '../meetings/entities/meeting-member-v2.entity';
import { GuestsTicket } from '../guests/entities/guests-ticket.entity';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExhibitorCompany,
      ExhcompanySpace,
      VenueSpace,
      CheckinBooth,
      EventsMeetingV2,
      MeetingMemberV2,
      GuestsTicket,
    ]),
    PassportModule,
  ],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
