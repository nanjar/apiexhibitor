import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { ExhcompanySpace } from '../venue/entities/exhcompany-space.entity';
import { VenueSpace } from '../venue/entities/venue-space.entity';
import { CheckinBooth } from '../booth/entities/checkin-booth.entity';
import { MeetingsModule } from '../meetings/meetings.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExhibitorCompany, ExhcompanySpace, VenueSpace, CheckinBooth]),
    PassportModule,
    MeetingsModule,
  ],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
