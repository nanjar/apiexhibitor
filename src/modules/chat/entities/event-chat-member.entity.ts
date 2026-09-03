import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('events_chatmember_v2')
export class EventChatMember {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'chat_id', type: 'int' })
  chatId: number;

  @PrimaryColumn({ name: 'chatmember_id', type: 'int' })
  chatmemberId: number;

  @Column({ name: 'guests_id', type: 'int' })
  guestsId: number;

  @Column({ name: 'member_id', type: 'int' })
  memberId: number;

  @Column({ name: 'unread', type: 'int', nullable: true })
  unread: number | null;

  @Column({ name: 'guest_level', type: 'varchar', length: 1, nullable: true })
  guestLevel: 'A' | 'R' | null; // A = Admin/PIC, R = Regular

  @Column({ name: 'usertype_id', type: 'varchar', length: 2, nullable: true })
  usertypeId: 'VI' | 'EX' | null;

  @Column({ name: 'company_id', type: 'int', nullable: true })
  companyId: number | null;
}
