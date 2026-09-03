import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Native (bukan mirror) - satu baris per PENERIMA. Trigger: meeting
 * request baru & chat message baru dari visitor, di-INSERT langsung dari
 * apivisitor (shared DB, tidak lewat webhook). */
@Entity('exhibitor_notification')
export class ExhibitorNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'events_id', type: 'int' })
  eventsId: number;

  @Column({ name: 'exhibitor_id', type: 'int' })
  exhibitorId: number;

  @Column({ name: 'type', type: 'varchar', length: 30 })
  type: 'MEETING_REQUEST' | 'CHAT_MESSAGE';

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'body', type: 'varchar', length: 500, nullable: true })
  body: string | null;

  @Column({ name: 'data', type: 'jsonb', nullable: true })
  data: Record<string, any> | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
