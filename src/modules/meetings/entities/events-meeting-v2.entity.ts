import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('events_meeting_v2')
export class EventsMeetingV2 {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'id', type: 'int' })
  id: number;

  @Column({ name: 'meeting_title', type: 'varchar', length: 45, nullable: true })
  meetingTitle: string;

  @Column({ name: 'start_datetime', type: 'timestamp', nullable: true })
  startDatetime: Date;

  @Column({ name: 'end_datetime', type: 'timestamp', nullable: true })
  endDatetime: Date;

  @Column({ name: 'approval_status', type: 'varchar', length: 2 })
  approvalStatus: string;

  @Column({ name: 'Status', type: 'varchar', length: 10, nullable: true })
  status: string;

  @Column({ name: 'meeting_score', type: 'varchar', length: 50, nullable: true })
  meetingScore: string;

  @Column({ name: 'com_direction', type: 'varchar', length: 3, nullable: true })
  comDirection: string;
}
