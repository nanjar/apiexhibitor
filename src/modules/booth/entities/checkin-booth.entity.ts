import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('checkin_booth')
export class CheckinBooth {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'company_id', type: 'int' })
  companyId: number;

  @PrimaryColumn({ name: 'guests_id', type: 'int' })
  guestsId: number;

  @Column({ name: 'venue_id', type: 'int' })
  venueId: number;

  @Column({ name: 'space_id', type: 'int' })
  spaceId: number;

  @Column({ name: 'scan_by', type: 'varchar', length: 45, nullable: true })
  scanBy: string;

  @Column({ name: 'checkin_datetime', type: 'timestamp', nullable: true })
  checkinDatetime: Date;

  @Column({ name: 'member_id', type: 'int' })
  memberId: number;

  @Column({ name: 'visitor_notes', type: 'text', nullable: true })
  visitorNotes: string;
}
