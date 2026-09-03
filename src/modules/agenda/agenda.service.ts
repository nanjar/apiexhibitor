import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewAgenda } from './entities/new-agenda.entity';
import { NewTrack } from './entities/new-track.entity';
import { NewSession } from './entities/new-session.entity';
import { SessionSpeaker } from './entities/session-speaker.entity';
import { EventsSpeaker } from './entities/events-speaker.entity';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

/**
 * Agenda = read-only, semua sumber datanya MIRROR (pull-sync, sudah ada
 * dari batch sync awal - new_agenda, new_track, new_session,
 * session_speaker, events_speakers). Tidak butuh staging/push-job sama
 * sekali, ini murni tampilan.
 *
 * Struktur bertingkat: Hari (agenda) -> Track -> Session (+ pembicara).
 */
@Injectable()
export class AgendaService {
  constructor(
    @InjectRepository(NewAgenda)
    private readonly agendaRepo: Repository<NewAgenda>,
    @InjectRepository(NewTrack)
    private readonly trackRepo: Repository<NewTrack>,
    @InjectRepository(NewSession)
    private readonly sessionRepo: Repository<NewSession>,
    @InjectRepository(SessionSpeaker)
    private readonly sessionSpeakerRepo: Repository<SessionSpeaker>,
    @InjectRepository(EventsSpeaker)
    private readonly speakerRepo: Repository<EventsSpeaker>,
  ) {}

  async getAgenda(user: CurrentExhibitor) {
    const [agendas, tracks, sessions] = await Promise.all([
      this.agendaRepo.find({
        where: { eventsId: user.eventsId },
        order: { sortNo: 'ASC' },
      }),
      this.trackRepo.find({
        where: { eventsId: user.eventsId },
        order: { sortNo: 'ASC' },
      }),
      this.sessionRepo.find({
        where: { eventsId: user.eventsId },
        order: { sortNo: 'ASC' },
      }),
    ]);

    if (sessions.length === 0) {
      return agendas.map((agenda) => ({
        agendaId: agenda.id,
        agendaName: agenda.aliasName || agenda.agendaName,
        agendaDate: agenda.agendaDate,
        tracks: [],
      }));
    }

    const sessionIds = sessions.map((s) => s.id);
    const sessionSpeakers = await this.sessionSpeakerRepo
      .createQueryBuilder('ss')
      .where('ss.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('ss.sessionId IN (:...ids)', { ids: sessionIds })
      .getMany();

    const speakerIds = [...new Set(sessionSpeakers.map((ss) => ss.speakerId))];
    const speakers = speakerIds.length
      ? await this.speakerRepo
          .createQueryBuilder('sp')
          .where('sp.eventsId = :eventsId', { eventsId: user.eventsId })
          .andWhere('sp.speakerId IN (:...ids)', { ids: speakerIds })
          .getMany()
      : [];

    return agendas.map((agenda) => {
      const agendaTracks = tracks.filter((t) => t.agendaId === agenda.id);

      return {
        agendaId: agenda.id,
        agendaName: agenda.aliasName || agenda.agendaName,
        agendaDate: agenda.agendaDate,
        tracks: agendaTracks.map((track) => {
          const trackSessions = sessions.filter(
            (s) => s.agendaId === agenda.id && s.trackId === track.id,
          );

          return {
            trackId: track.id,
            trackName: track.aliasName || track.trackName,
            logo: track.logo,
            sessions: trackSessions.map((session) => {
              const speakerLinks = sessionSpeakers.filter((ss) => ss.sessionId === session.id);
              const sessionSpeakerNames = speakerLinks
                .map((link) => speakers.find((sp) => sp.speakerId === link.speakerId))
                .filter((sp): sp is EventsSpeaker => !!sp)
                .map((sp) => ({ speakerId: sp.speakerId, name: sp.speakerName, jobTitle: sp.jobTitle }));

              return {
                sessionId: session.id,
                topic: session.sessionTopic,
                brief: session.sessionBrief,
                startTime: session.startTime,
                endTime: session.endTime,
                poster: session.poster,
                moderator: session.moderator,
                category: session.sessionCategory,
                speakers: sessionSpeakerNames,
              };
            }),
          };
        }),
      };
    });
  }
}
