import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('events_chat')
export class EventChat {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'chat_id', type: 'int' })
  chatId: number;

  @Column({ name: 'chat_name', type: 'varchar', length: 255 })
  chatName: string;

  @Column({ name: 'created', type: 'timestamptz' })
  created: Date;

  @Column({ name: 'created_by', type: 'int' })
  createdBy: number;

  @Column({ name: 'lastSender', type: 'varchar', length: 200, nullable: true })
  lastSender: string | null;

  @Column({ name: 'message', type: 'varchar', length: 255, nullable: true })
  lastMessage: string | null;

  @Column({ name: 'totalPost', type: 'int', nullable: true })
  totalPost: number | null;

  @Column({ name: 'com_direction', type: 'varchar', length: 3, nullable: true })
  comDirection: string | null;

  @Column({ name: 'last_update', type: 'timestamptz' })
  lastUpdate: Date;
}
