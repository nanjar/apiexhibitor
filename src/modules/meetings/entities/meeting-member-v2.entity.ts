import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('meeting_member_v2')
export class MeetingMemberV2 {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'meeting_id', type: 'int' })
  meetingId: number;

  @PrimaryColumn({ name: 'guests_id', type: 'int' })
  guestsId: number;

  @PrimaryColumn({ name: 'member_guests_id', type: 'int' })
  memberGuestsId: number;

  @Column({ name: 'guest_level', type: 'varchar', length: 1, nullable: true })
  guestLevel: string;

  @Column({ name: 'approval_status', type: 'varchar', length: 2, nullable: true })
  approvalStatus: string;

  @Column({ name: 'usertype_id', type: 'varchar', length: 2, nullable: true })
  usertypeId: string;

  @Column({ name: 'company_id', type: 'int', nullable: true })
  companyId: number;
}
