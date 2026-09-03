import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { BoothModule } from '../booth/booth.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { LinkClickLog } from './entities/link-click-log.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LinkClickLog]),
    BoothModule,
    MeetingsModule,
    PassportModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
