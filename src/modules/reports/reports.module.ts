import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { BoothModule } from '../booth/booth.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [BoothModule, MeetingsModule, PassportModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
