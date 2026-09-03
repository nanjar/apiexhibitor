import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('new_session')
export class NewSession {
  @PrimaryColumn({ name: 'id', type: 'int' })
  id: number;

  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @Column({ name: 'track_id', type: 'int' })
  trackId: number;

  @Column({ name: 'agenda_id', type: 'int' })
  agendaId: number;

  @Column({ name: 'session_topic', type: 'varchar', length: 100, nullable: true })
  sessionTopic: string;

  @Column({ name: 'session_brief', type: 'text', nullable: true })
  sessionBrief: string;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime: string;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime: string;

  @Column({ name: 'poster', type: 'varchar', length: 100, nullable: true })
  poster: string;

  @Column({ name: 'moderator', type: 'varchar', length: 150, nullable: true })
  moderator: string;

  @Column({ name: 'session_category', type: 'varchar', length: 250, nullable: true })
  sessionCategory: string;

  @Column({ name: 'sort_no', type: 'int', default: 1 })
  sortNo: number;
}
