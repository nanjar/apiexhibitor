import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('chat_message')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'events_id', type: 'int' })
  eventsId: number;

  @Column({ name: 'chat_id', type: 'int' })
  chatId: number;

  @Column({ name: 'sender_member_id', type: 'int' })
  senderMemberId: number;

  @Column({ name: 'sender_name', type: 'varchar', length: 200 })
  senderName: string;

  @Column({ name: 'sender_type', type: 'varchar', length: 2 })
  senderType: 'VI' | 'EX';

  @Column({ name: 'message', type: 'text' })
  message: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
