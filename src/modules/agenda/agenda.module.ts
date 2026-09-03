import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { NewAgenda } from './entities/new-agenda.entity';
import { NewTrack } from './entities/new-track.entity';
import { NewSession } from './entities/new-session.entity';
import { SessionSpeaker } from './entities/session-speaker.entity';
import { EventsSpeaker } from './entities/events-speaker.entity';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NewAgenda, NewTrack, NewSession, SessionSpeaker, EventsSpeaker]),
    PassportModule,
  ],
  controllers: [AgendaController],
  providers: [AgendaService],
})
export class AgendaModule {}
