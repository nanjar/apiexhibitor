import { Entity, PrimaryColumn } from 'typeorm';

@Entity('session_speaker')
export class SessionSpeaker {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'session_id', type: 'int' })
  sessionId: number;

  @PrimaryColumn({ name: 'speaker_id', type: 'int' })
  speakerId: number;
}
