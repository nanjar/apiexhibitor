import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('events_speakers')
export class EventsSpeaker {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'speaker_id', type: 'int' })
  speakerId: number;

  @Column({ name: 'speaker_name', type: 'varchar', length: 200 })
  speakerName: string;

  @Column({ name: 'job_title', type: 'varchar', length: 200, nullable: true })
  jobTitle: string;
}
